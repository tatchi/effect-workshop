import { Context, Data, Duration, Option } from "effect";
type URL = import("url").URL;

export class CLIOptions extends Context.Tag("CLIOptions")<
  CLIOptions,
  {
    readonly url: URL;
    readonly output: Option.Option<string>;
  }
>() {}
