import { Resolver, Router, Rpc } from "@effect/rpc";
import * as S from "@effect/schema/Schema";
import { Context, Effect } from "effect";

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

Effect.runPromise(mainToHandler());
