import { Effect, Either, Option, ReadonlyArray } from "effect";
import * as T from "../../testDriver";

// Exercise 1
// Come up with a way to run this effect until it succeeds, no matter how many times it fails

let i = 0;
const eventuallySuceeds = Effect.suspend(() =>
  i++ < 100 ? Effect.fail("error") : Effect.succeed(5)
);

// const testOne = eventuallySuceeds.pipe(
//   Effect.retry({ times: Number.MAX_SAFE_INTEGER })
// );
const testOne = eventuallySuceeds.pipe(Effect.retry({ while: (e) => true }));

await T.testRunAssert(1, testOne, { success: 5 });

// Exercise 2
// Instead of short circuiting on the first error, collect all errors and fail with an array of them

const maybeFail = (j: number) =>
  j % 2 !== 0 ? Effect.fail(`odd ${j}`) : Effect.succeed(j);
const maybeFailArr = new Array(10).fill(0).map((_, i) => maybeFail(i + 1));

// It needs concurrency to work
// const testTwo = Effect.all(maybeFailArr, { concurrency: "unbounded" }).pipe(
//   Effect.parallelErrors
// );

const testTwo = Effect.validateAll(
  Array.from({ length: 10 }, (_v, i) => i + 1),
  maybeFail
);

await T.testRunAssert(2, testTwo, {
  failure: ["odd 1", "odd 3", "odd 5", "odd 7", "odd 9"],
});

// Exercise 3
// Now succeed with both a array of success values and an array of errors

const testThree = Effect.all(maybeFailArr, { mode: "either" }).pipe(
  Effect.andThen((result) => ({
    success: ReadonlyArray.filterMap(result, Either.getRight),
    failure: result.filter(Either.isLeft).map((_) => _.left),
  }))
);

await T.testRunAssert(3, testThree, {
  success: {
    success: [2, 4, 6, 8, 10],
    failure: ["odd 1", "odd 3", "odd 5", "odd 7", "odd 9"],
  },
});
