import { Effect, Equal, HashSet, Hash, Data, Brand, pipe } from "effect";
import * as S from "@effect/schema/Schema";
import assert from "node:assert";

// Exercise 1
// implement equals and hash for the Transaction class
class Transaction implements Equal.Equal, Hash.Hash {
  constructor(
    public readonly id: string,
    public readonly amount: number,
    public readonly time: Date
  ) {}
  [Equal.symbol](that: unknown): boolean {
    return (
      that instanceof Transaction &&
      that.id === this.id &&
      that.amount === this.amount &&
      that.time.getTime() === this.time.getTime()
    );
  }

  [Hash.symbol](): number {
    return pipe(
      Hash.string(this.id),
      Hash.combine(Hash.number(this.amount)),
      Hash.combine(Hash.number(this.time.getTime()))
    );
    // return Hash.structure({
    //   id: this.id,
    //   amount: this.amount,
    //   time: this.time,
    // });
  }
}

assert(
  Equal.equals(
    new Transaction("1", 1, new Date(3)),
    new Transaction("1", 1, new Date(3))
  )
);

assert(
  Hash.hash(new Transaction("1", 1, new Date(3))) ===
    Hash.hash(new Transaction("1", 1, new Date(3)))
);

// Exercise 2
// Create a datatype for a string that has been guaranteed to be only ascii
// Here is a regex for you to use : /^[\x00-\x7F]*$/

class ASCIIString extends Data.TaggedClass("ASCIIString")<{
  readonly self: string;
}> {
  static of(self: string): ASCIIString {
    if (/^[\x00-\x7F]*$/.test(self)) {
      return new ASCIIString({ self });
    } else {
      throw new Error("Not an ASCII string");
    }
  }
}

const string1 = ASCIIString.of("hello");
// const string2 = ASCIIString.of("hello🌍");

// With a brand

type ASCIIString2 = string & Brand.Brand<ASCIIString2>;

const make_ASCIIString2 = Brand.refined<ASCIIString2>(
  (s) => /^[\x00-\x7F]*$/.test(s),
  (s) => Brand.error(`${s} is not ASCII`)
);

const s1 = make_ASCIIString2("hello");
// const s2 = make_ASCIIString2("hello🌍");

// With schema

const ASCIIString3Brand = Symbol.for("ASCIIString3"); // Ensure uniqueness
const ASCIIString3 = S.string.pipe(
  S.pattern(/^[\x00-\x7F]*$/),
  S.brand(ASCIIString3Brand)
);

type ASCIIString3 = S.Schema.Type<typeof ASCIIString3>; // string & Brand<"ASCIIString3">

const s22 = ASCIIString3("hello🌍");
