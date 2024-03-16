import { ParseResult } from "@effect/schema";
import * as S from "@effect/schema/Schema";
import { Types } from "effect";
import * as T from "../../testDriver";
import { ParseError } from "@effect/schema/ParseResult";

// Exercise 1
// Make a schema that parses to each of the following types

const res = Bun.pathToFileURL("/path/to/file.txt");

type A = {
  readonly bool: boolean;
  readonly num: number;
  readonly str: string;
  readonly sym: symbol;
};

const A = S.struct({
  bool: S.boolean,
  num: S.number,
  str: S.string,
  sym: S.symbol,
});

type B = "a" | "b" | "c";

const B = S.literal("a", "b", "c");

type C = {
  readonly code: `${B}-${B}-${number}`;
  readonly data: readonly [ReadonlyArray<A>, keyof A];
};

const Cs = S.struct({
  code: S.templateLiteral(B, S.literal("-"), B, S.literal("-"), S.number),
  data: S.tuple(S.array(A), S.keyof(A)),
});

type D = {
  readonly value: string;
  readonly next: D | null;
};

const D: S.Schema<D> = S.struct({
  value: S.string,
  next: S.nullable(S.suspend(() => D)),
});

type E = {
  readonly ab: A | B;
  readonly partial: Partial<A>;
};

const E = S.struct({ ab: S.union(A, B), partial: S.partial(A) });

type AllTrue<T extends boolean[]> = T extends [infer First, ...infer Rest]
  ? First extends true
    ? Rest extends boolean[]
      ? AllTrue<Rest>
      : never
    : false
  : true;
type TestA = Types.Equals<A, S.Schema.To<typeof A>>;
type TestB = Types.Equals<B, S.Schema.To<typeof B>>;
type TestC = Types.Equals<C, S.Schema.To<typeof C>>;
type TestD = Types.Equals<D, S.Schema.To<typeof D>>;
type TestE = Types.Equals<E, S.Schema.To<typeof E>>;

type AllTests = AllTrue<[TestA, TestB, TestC, TestD, TestE]>;
//  ^^ This should be true

// Exercise 2

// First write a schema that transforms a string to a `URL` (I've provide a URL schema for you)
// if you can: consider how to handle the URL constructor throwing an error

type URL = import("url").URL;
const URLSchema = S.declare((input): input is URL => input instanceof URL);

const URLFromString = S.transformOrFail(
  S.string,
  URLSchema,
  (input, _, ast) =>
    ParseResult.try({
      try: () => new URL(input),
      catch: (e) =>
        ParseResult.type(
          ast,
          input,
          e instanceof Error ? e.message : undefined
        ),
    }),
  (url) => ParseResult.succeed(url.toString())
);

// Now write a schema that filters out URLs that are not https
const IsHttps: S.Schema<URL, URL> = URLSchema.pipe(
  S.filter((url) => url.protocol === "https:")
);

// Now using those, create a schema that can decode a string and asserts that it is a valid https URL
const HttpsURL = S.compose(URLFromString, IsHttps);

const goodInput = "https://example.com";
const badInput = "http://example.com";
const reallyBadInput = "not a url";

const testOne = S.decode(HttpsURL)(goodInput);
const testTwo = S.decode(HttpsURL)(badInput);
const testThree = S.decode(HttpsURL)(reallyBadInput);

await T.testRunAssert(1, testOne, {
  successIs: (url) => url instanceof URL,
});

await T.testRunAssert(2, testTwo, {
  failureIs: (error) => error instanceof ParseError,
});

await T.testRunAssert(3, testThree, {
  failureIs: (error) => error instanceof ParseError,
});
