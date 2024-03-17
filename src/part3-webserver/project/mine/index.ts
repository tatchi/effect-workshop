import { createServer } from "http";
import * as M from "./model";
import { WebSocketServer } from "ws";
import * as S from "@effect/schema/Schema";
import { Config, Context, Effect, Layer, pipe } from "effect";
import { BunRuntime } from "@effect/platform-bun";

class HttpServer extends Context.Tag("HttpServer")<
  HttpServer,
  ReturnType<typeof createServer>
>() {
  static readonly Live = Layer.sync(HttpServer, createServer);
}

class WSSServer extends Context.Tag("WSSServer")<WSSServer, WebSocketServer>() {
  // private static readonly make = Effect.gen(function* (_) {
  //   const server = yield* _(HttpServer);

  //   return new WebSocketServer({ server });
  // });
  static readonly Live = Layer.effect(
    WSSServer,
    HttpServer.pipe(Effect.map((server) => new WebSocketServer({ server })))
  );
}

const ListenLive = Layer.effectDiscard(
  Effect.gen(function* (_) {
    const port = yield* _(
      Config.integer("PORT").pipe(Config.withDefault(3000))
    );

    const server = yield* _(HttpServer);

    yield* _(
      Effect.sync(() =>
        server.listen(port, () => console.log("Server started on port ", port))
      )
    );
  })
);

const main = Layer.effectDiscard(
  Effect.gen(function* (_) {
    const currentConnections: Map<string, M.WebSocketConnection> = new Map();
    function broadcastMessage(message: M.ServerOutgoingMessage) {
      const msg = JSON.stringify(message);

      currentConnections.forEach((conn) => {
        conn._rawWS.send(msg);
      });
    }

    const http = yield* _(HttpServer);
    http.on("request", (req, res) => {
      if (req.url !== "/colors") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const currentColors = Array.from(currentConnections.values()).map(
        (conn) => conn.color
      );

      const availableColors = M.colors.filter(
        (color) => !currentColors.includes(color)
      );

      const message: M.AvailableColorsResponse = {
        _tag: "availableColors",
        colors: availableColors,
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(message));
    });

    const wss = yield* _(WSSServer);

    wss.on("connection", (ws: WebSocket) => {
      let connectionName: string;
      ws.on("message", (data) => {
        try {
          const message: unknown = JSON.parse(data.toString());
          const parsedMessage = S.decodeUnknownSync(
            S.union(M.StartupMessage, M.ServerIncomingMessage)
          )(message);

          switch (parsedMessage._tag) {
            case "startup": {
              const { color, name } = parsedMessage;

              if (!M.colors.includes(color) || currentConnections.has(name)) {
                ws.close(); // Close the connection if the color is not available or the name is already taken
                console.log(
                  "Closing because color not available or user already connected"
                );

                return;
              }

              connectionName = name;
              console.log(`New connection: ${name}`);

              currentConnections.set(name, {
                _rawWS: ws,
                name,
                color,
                timeConnected: Date.now(),
              });
              broadcastMessage({ _tag: "join", name, color });
              break;
            }

            case "message": {
              if (connectionName) {
                const conn = currentConnections.get(connectionName);

                if (conn) {
                  broadcastMessage({
                    _tag: "message",
                    name: conn.name,
                    color: conn.color,
                    message: parsedMessage.message,
                    timestamp: Date.now(),
                  });
                }
              }
              break;
            }
          }
        } catch (error) {
          console.error("Failed to process message:", error);
        }
      });

      ws.on("close", () => {
        if (connectionName) {
          const conn = currentConnections.get(connectionName);
          if (conn) {
            broadcastMessage({
              _tag: "leave",
              name: conn.name,
              color: conn.color,
            });
            currentConnections.delete(connectionName);
            console.log(`Connection closed: ${connectionName}`);
          }
        }
      });
    });

    let lastPrintedNbConnections: number | null = null;

    setInterval(() => {
      if (lastPrintedNbConnections !== currentConnections.size) {
        lastPrintedNbConnections = currentConnections.size;
        console.log("Current connections:", currentConnections.size);
      }
    }, 1000);
  })
);

const run = () =>
  pipe(
    Layer.merge(main, ListenLive),
    Layer.provide(WSSServer.Live),
    Layer.provide(HttpServer.Live),
    Layer.launch,
    BunRuntime.runMain
  );

run();
