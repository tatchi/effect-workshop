import type { ParseError } from "@effect/schema/ParseResult";
import * as S from "@effect/schema/Schema";
import { Data, Stream, type Effect, Queue } from "effect";

export const colors = [
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
] as const;

export const Color = S.literal(...colors);

export type Color = S.Schema.To<typeof Color>;

export interface WebSocketConnection {
  readonly _rawWS: WebSocket;
  readonly name: string;
  readonly color: Color;
  readonly timeConnected: number;
  readonly messages: Stream.Stream<
    ServerIncomingMessage,
    UnknownIncomingMessageError
  >;
  readonly sendQueue: Queue.Enqueue<ServerOutgoingMessage>;
  readonly close: Effect.Effect<void>;
}

export const StartupMessage = S.struct({
  _tag: S.literal("startup"),
  color: Color,
  name: S.string,
});

export type StartupMessage = S.Schema.To<typeof StartupMessage>;

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

export type ServerIncomingMessage = S.Schema.To<typeof ServerIncomingMessage>;

export class UnknownIncomingMessageError extends Data.TaggedError(
  "UnknownIncomingMessage"
)<{
  readonly parseError: ParseError | Error;
}> {}

export const ServerOutgoingMessage = S.union(
  S.struct({
    _tag: S.literal("message"),
    name: S.string,
    color: Color,
    message: S.string,
    timestamp: S.number,
  }),
  S.struct({ _tag: S.literal("join"), name: S.string, color: Color }),
  S.struct({ _tag: S.literal("leave"), name: S.string, color: Color })
);

export type ServerOutgoingMessage = S.Schema.To<typeof ServerOutgoingMessage>;

export const AvailableColorsResponse = S.struct({
  _tag: S.literal("availableColors"),
  colors: S.array(Color),
});

export type AvailableColorsResponse = S.Schema.To<
  typeof AvailableColorsResponse
>;

// export class AvailableColorsResponse extends S.TaggedClass<AvailableColorsResponse>()(
//   "AvailableColorsResponse",
//   {
//     colors: S.array(Color),
//   }
// ) {}
