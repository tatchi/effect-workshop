import {
  Chunk,
  Console,
  Effect,
  Fiber,
  FiberSet,
  HashMap,
  Layer,
  Option,
  PubSub,
  Queue,
  Ref,
  Schedule,
  Stream,
  pipe,
} from "effect";
import { CurrentConnections, WSSServer, getAvailableColors } from "./shared";
import { WebSocket, type WebSocketServer } from "ws";
import * as M from "./model";
import * as S from "@effect/schema/Schema";
import { ParseError } from "@effect/schema/ParseResult";

const createConnectionsStream = (wss: WebSocketServer) =>
  Stream.async<WebSocket, Error>((emit) => {
    wss.on("connection", (ws: WebSocket) => {
      emit(Effect.succeed(Chunk.of(ws)));
    });
    wss.on("error", (err) => {
      emit(Effect.fail(Option.some(err)));
    });
    wss.on("close", () => {
      emit(Effect.fail(Option.none()));
    });
  }).pipe(Stream.tap(() => Console.log("New connection")));

const parseMessage = pipe(S.parseJson(M.ServerIncomingMessage), S.decode);

const encodeMessage = pipe(S.parseJson(M.ServerOutgoingMessage), S.encode);

const parseStartupMessage = pipe(S.parseJson(M.StartupMessage), S.decode);

const initializeConnection = (
  ws: WebSocket,
  sendToWsQueue: Queue.Dequeue<M.ServerOutgoingMessage>,
  broadcastQueue: Queue.Enqueue<M.ServerOutgoingMessage>
) =>
  Effect.gen(function* (_) {
    console.log("Initializing connection");
    const connectionsRef = yield* _(CurrentConnections);

    const { color, name } = yield* _(
      Effect.async<M.StartupMessage, ParseError>((emit) => {
        ws.once("message", (data) => {
          emit(parseStartupMessage(data.toString()));
        });
      }).pipe(
        Effect.mapError(
          (parseError) =>
            new M.BadStartupMessageError({
              error: { _tag: "parseError", parseError },
            })
        ),
        Effect.flatMap((message) =>
          Effect.gen(function* (_) {
            const availableColors = yield* _(getAvailableColors);
            if (!availableColors.includes(message.color)) {
              yield* _(
                new M.BadStartupMessageError({
                  error: { _tag: "colorAlreadyTaken", color: message.color },
                })
              );
            }
            return message;
          })
        )
      )
    );

    yield* _(Console.log(`New connection: ${name} (${color})`));
    yield* _(Queue.offer(broadcastQueue, { _tag: "join", name, color }));

    const rawMessagesStream = Stream.async<string, Error>((emit) => {
      ws.on("message", (data) => {
        emit(Effect.succeed(Chunk.of(data.toString())));
      });
      ws.on("error", (err) => {
        emit(Effect.fail(Option.some(err)));
      });
      ws.on("close", () => {
        emit(Effect.fail(Option.none()));
      });
    });

    const parsedMessagesStream = pipe(
      rawMessagesStream,
      Stream.mapEffect(parseMessage),
      Stream.mapError(
        (parseError) => new M.UnknownIncomingMessageError({ parseError })
      )
    );

    const messagesWithInfoStream = parsedMessagesStream.pipe(
      Stream.map((message) => {
        const messageToPublish: M.ServerOutgoingMessage = {
          ...message,
          name,
          color,
          timestamp: Date.now(),
        };
        return messageToPublish;
      }),
      Stream.concat(Stream.make({ _tag: "leave", name, color } as const)),
      Stream.tapError((err) => Console.error(err))
    );

    const broadcastFiber = yield* _(
      Stream.runForEach(messagesWithInfoStream, (message) =>
        Queue.offer(broadcastQueue, message)
      ),
      Effect.fork
    );

    const manualSendQueue = yield* _(
      Queue.unbounded<M.ServerOutgoingMessage>()
    );

    const toSendStream = Stream.fromQueue(manualSendQueue).pipe(
      Stream.merge(Stream.fromQueue(sendToWsQueue))
    );

    const sendToWsFiber = yield* _(
      Stream.runForEach(toSendStream, (message) =>
        encodeMessage(message).pipe(Effect.andThen((msg) => ws.send(msg)))
      ),
      Effect.fork
    );

    const connection: M.WebSocketConnection = {
      _rawWS: ws,
      name,
      color,
      timeConnected: Date.now(),
      messages: parsedMessagesStream,
      sendQueue: manualSendQueue,
      close: Effect.sync(() => ws.close()),
    };

    yield* _(Effect.addFinalizer(() => connection.close));

    yield* _(
      Ref.update(connectionsRef, (connections) =>
        HashMap.set(connections, name, connection)
      )
    );

    yield* _(Fiber.join(Fiber.zip(broadcastFiber, sendToWsFiber)));
  });

export const Live = Layer.scopedDiscard(
  Effect.gen(function* (_) {
    const wss = yield* _(WSSServer);
    const connectionsRef = yield* _(CurrentConnections);

    const fiberSet = yield* _(
      FiberSet.make<
        void,
        M.UnknownIncomingMessageError | M.BadStartupMessageError | ParseError
      >()
    );

    const pubsub = yield* _(PubSub.unbounded<M.ServerOutgoingMessage>());

    const connectionsStream = createConnectionsStream(wss).pipe(
      Stream.tapError((err) => Console.error(err))
    );

    const initializeConnectionsFiber = yield* _(
      connectionsStream,
      Stream.runForEach((ws) =>
        Effect.gen(function* (_) {
          const subscription = yield* _(pubsub.subscribe);

          const fiber = yield* _(
            initializeConnection(ws, subscription, pubsub),
            Effect.fork
          );

          yield* _(FiberSet.add(fiberSet, fiber));
        })
      ),
      Effect.fork
    );

    const connectionLogFiber = yield* _(
      Effect.gen(function* (_) {
        const connections = yield* _(Ref.get(connectionsRef));

        yield* _(
          Console.log(`Current connections: ${HashMap.size(connections)}`)
        );

        HashMap.forEach(connections, (connection, name) => {
          Effect.gen(function* (_) {
            yield* _(
              Console.log(
                `Connection: ${name} (${connection.color}) - ${Math.floor(
                  (Date.now() - connection.timeConnected) / 1000
                )}s`
              )
            );
          });
        });
      }),
      Effect.repeat(Schedule.spaced("2 seconds")),
      Effect.fork
    );

    yield* _(
      Fiber.join(Fiber.zip(initializeConnectionsFiber, connectionLogFiber))
    );
  })
);
