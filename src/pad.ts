import { Console, Effect, Fiber, Queue, Ref, Schedule } from "effect";

const fiber = (queue: Queue.Dequeue<string>) =>
  Effect.gen(function* (_) {
    yield* _(Console.log("Waiting to take value from queue"));
    let res = yield* _(Queue.take(queue));

    yield* _(Console.log(`Got ${res} from queue`));
  }).pipe(Effect.forever);

// const program = Effect.gen(function* (_) {
//   const queue = yield* _(Queue.unbounded<string>());

//   const readFiber = yield* _(Effect.fork(fiber(queue)));

//   const sendFiber = yield* _(
//     Effect.fork(
//       Console.log("Sending value").pipe(
//         Effect.andThen((_) => Queue.offer(queue, "hello from Coco"))
//       )
//     )
//   );

//   yield* _(Fiber.join(Fiber.zip(readFiber, sendFiber)));

//   yield* _(Console.log("Stop program"));
// });

// const program = Effect.gen(function* (_) {
//   const counter = yield* _(Ref.make(1));
//   const queue = yield* _(Queue.unbounded<string>());

//   const f1 = yield* _(Effect.fork(fiber(queue)));

//   const sendEffect = Effect.gen(function* (_) {
//     yield* _(Console.log("In sendEffect"));

//     let count = yield* _(Ref.get(counter));

//     yield* _(Queue.offer(queue, `Hello ${count}`));
//     yield* _(Ref.update(counter, (c) => c + 1));
//   }).pipe(Effect.repeat({ times: 2, schedule: Schedule.fixed(500) }));

//   const f2 = yield* _(Effect.fork(sendEffect));

//   yield* _(Console.log("print before joinAll"));

//   yield* _(Fiber.joinAll([f1, f2]));
//   yield* _(Console.log("Stop program"));
// });

const program = Effect.gen(function* (_) {
  const counter = yield* _(Ref.make(1));
  const queue = yield* _(Queue.unbounded<string>());

  const f1 = fiber(queue);

  const sendEffect = Effect.gen(function* (_) {
    yield* _(Console.log("In sendEffect"));

    let count = yield* _(Ref.get(counter));

    yield* _(Queue.offer(queue, `Hello ${count}`));
    yield* _(Ref.update(counter, (c) => c + 1));
  }).pipe(Effect.repeat({ times: 2, schedule: Schedule.fixed(500) }));

  yield* _(Console.log("print before all"));

  yield* _(Effect.zip(f1, sendEffect, { concurrent: true }));
  yield* _(Console.log("Stop program"));
});

Effect.runPromise(program);
