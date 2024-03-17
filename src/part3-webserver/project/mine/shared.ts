import { createServer } from "http";
import { Config, Context, Effect, Layer } from "effect";
import * as M from "./model";
import { WebSocketServer } from "ws";

export class HttpServer extends Context.Tag("HttpServer")<
  HttpServer,
  ReturnType<typeof createServer>
>() {
  static readonly Live = Layer.sync(HttpServer, createServer);
}

export class WSSServer extends Context.Tag("WSSServer")<
  WSSServer,
  WebSocketServer
>() {
  // private static readonly make = Effect.gen(function* (_) {
  //   const server = yield* _(HttpServer);

  //   return new WebSocketServer({ server });
  // });
  static readonly Live = Layer.effect(
    WSSServer,
    HttpServer.pipe(Effect.map((server) => new WebSocketServer({ server })))
  );
}

export class CurrentConnections extends Context.Tag("CurrentConnections")<
  CurrentConnections,
  Map<string, M.WebSocketConnection>
>() {
  static readonly Live = Layer.sync(CurrentConnections, () => new Map());
}

export const ListenLive = Layer.effectDiscard(
  Effect.gen(function* (_) {
    const port = yield* _(
      Config.integer("PORT").pipe(Config.withDefault(3000))
    );

    const server = yield* _(HttpServer);
    const currentConnections = yield* _(CurrentConnections);

    yield* _(
      Effect.sync(() =>
        server.listen(port, () => console.log("Server started on port ", port))
      )
    );

    yield* _(
      Effect.sync(() => {
        let lastPrintedNbConnections: number | null = null;

        setInterval(() => {
          if (lastPrintedNbConnections !== currentConnections.size) {
            lastPrintedNbConnections = currentConnections.size;
            console.log("Current connections:", currentConnections.size);
          }
        }, 1000);
      })
    );
  })
);

export const getAvailableColors = Effect.gen(function* (_) {
  const currentConnections = yield* _(CurrentConnections);
  const currentColors = Array.from(currentConnections.values()).map(
    (conn) => conn.color
  );

  const availableColors = M.colors.filter(
    (color) => !currentColors.includes(color)
  );

  return availableColors;
});
