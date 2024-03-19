import { createServer } from "http";
import * as M from "./model";
import { WebSocketServer } from "ws";
import * as S from "@effect/schema/Schema";
import { Config, Console, Context, Effect, Layer, pipe } from "effect";
import { BunRuntime } from "@effect/platform-bun";
import * as Http from "@effect/platform/HttpServer";
import * as HTTP from "./http";
import * as WS from "./ws";
import * as SERVER from "./shared";

const serversLayer = Layer.merge(HTTP.Live, WS.Live);

const StartMessage = Layer.effectDiscard(
  Effect.gen(function* (_) {
    const httpServer = yield* _(Http.server.Server);
    const wssServer = yield* _(SERVER.WSSServer);
    const httpPort =
      httpServer.address._tag === "TcpAddress"
        ? httpServer.address.port
        : "unknown";

    yield* _(Console.log(`HTTP server listening on port ${httpPort}`));
    const wssAdress = wssServer.address();
    const wssPort =
      typeof wssAdress === "string" ? wssAdress : wssAdress.port.toString();
    yield* _(Console.log(`WebSocket server listening on port ${wssPort}`));
  })
);

const run = () =>
  pipe(
    Layer.merge(serversLayer, StartMessage),
    Layer.provide(SERVER.WSSServer.Live),
    Layer.provide(HTTP.HTTPServerLive),
    Layer.provide(SERVER.HttpServer.Live),
    Layer.provide(SERVER.CurrentConnections.Live),
    Layer.launch,
    BunRuntime.runMain
  );

run();
