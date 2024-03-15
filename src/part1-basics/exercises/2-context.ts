import { Effect, Context, Layer } from "effect";
import * as T from "../../testDriver";

class Foo extends Context.Tag("Foo")<Foo, { readonly bar: string }>() {
  static readonly Live = Layer.succeed(this, { bar: "imFromContext!" });
}

// Exercise 1
// `Tag` being a subtype of `Effect` is a bit too easy
// Get the `Foo` service from context manually :)

const test1 = Effect.gen(function* (_) {
  const foo = yield* _(Foo);
  // const context = yield* _(Effect.context<Foo>());
  return foo.bar;
}).pipe(Effect.provide(Foo.Live));

await T.testRunAssert(1, test1, { success: "imFromContext!" });

// Exercise 2

class Random extends Context.Tag("Random")<
  Random,
  {
    readonly nextInt: Effect.Effect<number>;
    readonly nextBool: Effect.Effect<boolean>;
    readonly nextIntBetween: (
      min: number,
      max: number
    ) => Effect.Effect<number>;
  }
>() {
  static readonly Mock = Layer.succeed(Random, {
    nextInt: Effect.succeed(42),
    nextBool: Effect.succeed(true),
    nextIntBetween: (min, max) => Effect.succeed(min + max),
  });
}

// Having to get the service, just to use a single property or function is a bit annoying
// For convenience lets create Effects (or functions that return Effects) themselves already depend on the service

declare const nextInt: Effect.Effect<number, never, Random>;
declare const nextBool: Effect.Effect<boolean, never, Random>;
declare const nextIntBetween: (
  min: number,
  max: number
) => Effect.Effect<number, never, Random>;

const test2 = Effect.gen(function* (_) {
  const { nextInt, nextBool, nextIntBetween } = yield* _(Random);
  const int = yield* _(nextInt);
  const bool = yield* _(nextBool);
  const intBetween = yield* _(nextIntBetween(10, 20));
  return { int, bool, intBetween };
}).pipe(Effect.provide(Random.Mock));

await T.testRunAssert(2, test2, {
  success: { int: 42, bool: true, intBetween: 30 },
});
