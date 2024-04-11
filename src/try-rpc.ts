import { Resolver, Router, Rpc } from "@effect/rpc";
import * as S from "@effect/schema/Schema";
import * as HttpServer from "@effect/platform/HttpServer";
import * as HttpClient from "@effect/platform/HttpClient";
import {
  Console,
  Context,
  Effect,
  Fiber,
  FiberRef,
  Layer,
  ReadonlyArray,
  Stream,
  pipe,
} from "effect";
import { HttpResolver, HttpRouter } from "@effect/rpc-http";
import { createServer } from "http";
import { NodeHttpServer, NodeRuntime } from "@effect/platform-node";
import { ServerRequest } from "@effect/platform/Http/ServerRequest";

function mainToHandler() {
  class Greet extends S.TaggedRequest<Greet>()("Greet", S.never, S.string, {
    name: S.string,
  }) {}

  class GetName extends S.TaggedRequest<GetName>()(
    "GetName",
    S.never,
    S.string,
    {}
  ) {}

  class Repo extends Context.Tag("Repo")<
    Repo,
    { readonly getUser: () => Effect.Effect<string> }
  >() {}

  const router = Router.make(
    Rpc.effect(Greet, ({ name }) => Effect.succeed(`Hello ${name}!`)),
    Rpc.effect(GetName, () =>
      Effect.gen(function* (_) {
        const { getUser } = yield* _(Repo);
        return yield* _(getUser());
      })
    )
  ).pipe(
    Router.provideService(Repo, { getUser: () => Effect.succeed("Morgane") })
  );

  const handler = Router.toHandler(router);

  const resolver = Resolver.make(handler)<typeof router>();

  const client = Resolver.toClient(resolver);

  return Effect.gen(function* (_) {
    const greet = yield* _(
      // Rpc.call(new Greet({ name: "Corentin" }), resolver)
      client(new Greet({ name: "Corentin!" }))
    );

    const getName = yield* _(
      // Rpc.call(new Greet({ name: "Corentin" }), resolver)
      client(new GetName())
    );

    console.log({ greet, getName });
  });
}

const UserId = S.number.pipe(S.int(), S.brand("UserId"));
type UserId = S.Schema.Type<typeof UserId>;

class User extends S.Class<User>("User")({ id: UserId, name: S.string }) {}

class GetUserIds extends Rpc.StreamRequest<GetUserIds>()(
  "GetUserIds",
  S.never,
  UserId,
  {}
) {}

class GetUser extends S.TaggedRequest<GetUser>()("GetUser", S.never, User, {
  id: UserId,
}) {}

const router = Router.make(
  Rpc.stream(GetUserIds, () =>
    Stream.fromIterable(ReadonlyArray.makeBy(2, UserId))
  ),
  Rpc.effect(GetUser, ({ id }) =>
    Effect.succeed(new User({ id, name: "Corentin" })).pipe(
      Effect.tap(Console.log(`Request for ${id}`))
    )
  )
);

export const fullLogger = HttpServer.middleware.make((httpApp) => {
  return Effect.withFiberRuntime((fiber) => {
    const context = fiber.getFiberRef(FiberRef.currentContext);
    const request = Context.unsafeGet(context, ServerRequest);

    return pipe(
      request.text,
      Effect.tap((body) =>
        Console.log(`Got request to ${request.url} - body = ${body}`)
      ),
      Effect.flatMap(() => httpApp)
    );
  });
});

// Create the http server
const HttpLive = HttpServer.router.empty.pipe(
  HttpServer.router.post("/rpc", HttpRouter.toHttpApp(router)),
  HttpServer.server.serve(fullLogger),
  HttpServer.server.withLogAddress,
  Layer.provide(NodeHttpServer.server.layer(createServer, { port: 3000 }))
);

// const client = HttpResolver.makeClient<typeof router>("http://localhost:3000/rpc")
let client = HttpResolver.make<typeof router>(
  HttpClient.client
    .fetchOk()
    .pipe(
      HttpClient.client.mapRequest(
        HttpClient.request.prependUrl("http://localhost:3000/rpc")
      )
    )
).pipe(Resolver.toClient);

let clientFiber = client(new GetUserIds()).pipe(
  Stream.runCollect,
  Effect.flatMap(
    Effect.forEach((id) => client(new GetUser({ id })), {
      batching: true,
      concurrency: 10,
    })
  ),
  Effect.tap(Console.log),
  Effect.runFork
);

Fiber.join(clientFiber);

NodeRuntime.runMain(Layer.launch(HttpLive));
