import type { ParseError } from "@effect/schema/ParseResult";
import * as S from "@effect/schema/Schema";
import {
  Context,
  PubSub,
  HashMap,
  Ref,
  Stream,
  Data,
  Fiber,
  Queue,
  Effect,
} from "effect";

export const colors = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const;
export type Color = (typeof colors)[number];
export const Color = S.literal(...colors);

export const StartupMessage = S.struct({
  _tag: S.literal("startup"),
  color: Color,
  name: S.string,
});

export const StartupMessageFromJSON = S.parseJson(StartupMessage);

export type StartupMessage = S.Schema.Type<typeof StartupMessage>;

export class BadStartupMessageError extends Data.TaggedError(
  "BadStartupMessage"
)<{
  readonly error:
    | {
        readonly _tag: "parseError";
        readonly parseError: ParseError;
      }
    | {
        readonly _tag: "colorAlreadyTaken";
        readonly color: Color;
      };
}> {}

export const ServerIncomingMessage = S.union(
  S.struct({
    _tag: S.literal("message"),
    message: S.string,
  })
);

export const ServerIncomingMessageFromJSON = S.parseJson(ServerIncomingMessage);

export type ServerIncomingMessage = S.Schema.Type<typeof ServerIncomingMessage>;

export class UnknownIncomingMessageError extends Data.TaggedError(
  "UnknownIncomingMessage"
)<{
  readonly rawMessage: string;
  readonly parseError: ParseError;
}> {}

export class WebSocketError extends Data.TaggedError("WebSocketError")<{
  readonly error: Error;
}> {}

export const ServerOutgoingMessage = S.union(
  S.struct({
    _tag: S.literal("message"),
    name: S.string,
    color: Color,
    message: S.string,
    timestamp: S.number,
  }),
  S.struct({
    _tag: S.literal("join"),
    name: S.string,
    color: Color,
  }),
  S.struct({
    _tag: S.literal("leave"),
    name: S.string,
    color: Color,
  })
);
export const ServerOutgoingMessageFromJSON = S.parseJson(ServerOutgoingMessage);
export type ServerOutgoingMessage = S.Schema.Type<typeof ServerOutgoingMessage>;

export interface WebSocketConnection<Incoming, Outgoing> {
  readonly _rawWS: WebSocket;
  readonly name: string;
  readonly color: Color;
  readonly timeConnected: number;
  readonly messages: Stream.Stream<Incoming>;
  readonly send: Queue.Enqueue<Outgoing>;
  readonly sendFiber: Fiber.Fiber<void, never>;
  readonly close: Effect.Effect<void>;
}

export const AvailableColorsResponse = S.struct({
  _tag: S.literal("availableColors"),
  colors: S.array(Color),
});

export type AvailableColorsResponse = S.Schema.Type<
  typeof AvailableColorsResponse
>;
