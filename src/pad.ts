import { Effect } from "effect";

const fail1 = Effect.fail("Oh uh!");
const fail2 = Effect.fail("Oh no!");

const program = Effect.all([fail1, fail2]).pipe(
  Effect.asUnit,
  Effect.parallelErrors
);

Effect.runPromise(program).then(console.log, console.error);
