import {
  Config,
  Console,
  Duration,
  Effect,
  Function,
  Layer,
  Match,
  Option,
  pipe,
} from "effect";
import * as M from "./model";
import * as S from "@effect/schema/Schema";
import { BunRuntime, BunContext, BunFileSystem } from "@effect/platform-bun";
import { FileSystem, Path } from "@effect/platform";
import * as Http from "@effect/platform/HttpClient";
import { Command, Options, Args } from "@effect/cli";
import { ParseResult } from "@effect/schema";

const main = Effect.gen(function* (_) {
  const options = yield* _(M.CLIOptions);

  // const fetch = yield* _(Http.client.Client);

  // const a = pipe(Http.request.get(""), fetch);

  const fetch = (url: URL) =>
    Http.request
      .get(url.toString())
      .pipe(
        Http.client.fetchOk(),
        Http.response.text,
        Effect.timeout("2 seconds")
      );

  // const client = pipe(
  //   Http.client.fetch(),
  //   Http.client.mapEffectScoped((_) => _.json)
  // );

  const res = yield* _(fetch(options.url));

  yield* _(
    Option.match(options.output, {
      onSome: (output) =>
        Effect.gen(function* (_) {
          const fs = yield* _(FileSystem.FileSystem);
          const path = yield* _(Path.Path);
          const outputPath = path.resolve(import.meta.dirname, output);
          yield* _(fs.writeFileString(outputPath, res));
        }),
      onNone: () => Console.log(res),
    })
  );
});

type URL = import("url").URL;

const URLFromSelf = S.declare(
  (input: unknown): input is URL => input instanceof URL
);

const URLFromString = S.transformOrFail(
  S.string,
  URLFromSelf,
  (value, _, ast) =>
    ParseResult.try({
      try: () => new URL(value),
      catch: () => ParseResult.type(ast, value, "String is not a valid URL"),
    }),
  (url) => ParseResult.succeed(url.toString())
).pipe(S.identifier("URLFromString"));

const urlArg = Args.text({ name: "url" }).pipe(
  Args.withDescription("The URL to send the request to"),
  Args.withSchema(URLFromString)
);

const outputOption = Options.file("output").pipe(
  Options.withAlias("o"),
  Options.withDescription("The file to write the response to"),
  Options.optional
);

const cli = pipe(
  Command.make("root", { url: urlArg, output: outputOption }),
  Command.withHandler(() => main),
  Command.provideSync(M.CLIOptions, (_) => _),
  Command.run({
    name: "bend",
    version: "1.0.0",
  }),
  (run) =>
    Effect.suspend(() => {
      return run(process.argv);
    })
);

pipe(cli, Effect.provide(BunContext.layer), BunRuntime.runMain);
