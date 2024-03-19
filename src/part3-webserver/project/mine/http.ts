import { Effect, Layer } from "effect";
import { HttpServer, getAvailableColors } from "./shared";
import * as M from "./model";
import * as C from "./config";
import * as Http from "@effect/platform/HttpServer";
import { NodeHttpServer } from "@effect/platform-node";

export const HTTPServerLive = Layer.scoped(
  Http.server.Server,
  HttpServer.pipe(
    Effect.zip(C.PORT),
    Effect.flatMap(([server, port]) =>
      NodeHttpServer.server.make(() => server, { port })
    )
  )
).pipe(Http.server.withLogAddress);

export const Live = Http.router.empty.pipe(
  Http.router.get(
    "/colors",
    Effect.gen(function* (_) {
      const availableColors = yield* _(getAvailableColors);
      return yield* _(
        Http.response.schemaJson(M.AvailableColorsResponse)({
          _tag: "availableColors",
          colors: availableColors,
        })
      );
    })
  ),
  Http.server.serve(Http.middleware.logger)
);
