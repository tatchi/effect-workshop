import { Effect, Layer } from "effect";
import { CurrentConnections, WSSServer } from "./shared";
import * as M from "./model";
import * as S from "@effect/schema/Schema";

export const Live = Layer.effectDiscard(
  Effect.gen(function* (_) {
    const wss = yield* _(WSSServer);
    const currentConnections = yield* _(CurrentConnections);
    function broadcastMessage(message: M.ServerOutgoingMessage) {
      const msg = JSON.stringify(message);

      currentConnections.forEach((conn) => {
        conn._rawWS.send(msg);
      });
    }

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
  })
);
