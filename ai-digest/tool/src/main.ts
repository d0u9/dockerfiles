#!/usr/bin/env node
// ai-digest: pull, digest, archive and index a daily RSS digest.
//
// Each subcommand runs in its own one-shot container with only the mounts it
// needs; see DESIGN.md section 8.

import { parseArgs } from "node:util";
import * as archive from "./archive.ts";
import { Failure, VERSION, loadConfig } from "./common.ts";
import * as digest from "./digest.ts";
import * as importer from "./import.ts";
import * as indexer from "./indexer.ts";
import * as publishWeb from "./publish-web.ts";
import * as pull from "./pull.ts";

const USAGE = `usage: ai-digest <command> [options]

  pull --user U       fetch U's articles from FreshRSS into the spool
  digest --user U     have codex digest U's articles; fetch the day's weather
  archive             commit the spool to the data repository and push
  index [--all]       generate the website's data from the data repository
  publish-web         copy the pages into the web root
  import --from DIR   convert the first version's digests
  --version`;

export async function main(argv: string[]): Promise<void> {
  const [command, ...rest] = argv;
  if (command === "--version") {
    console.log(VERSION);
    return;
  }
  const { values } = parseArgs({
    args: rest,
    options: {
      user: { type: "string" },
      all: { type: "boolean", default: false },
      from: { type: "string" },
    },
    strict: true,
  });
  const need = (name: "user" | "from"): string => {
    const value = values[name];
    if (!value) throw new Failure(`--${name} is required`);
    return value;
  };

  switch (command) {
    case "pull": return pull.run(loadConfig(), need("user"));
    case "digest": return digest.run(loadConfig(), need("user"));
    case "archive": return archive.run(loadConfig());
    case "index": return indexer.run(loadConfig(), values.all);
    case "publish-web": return publishWeb.run();
    case "import": {
      const source = need("from");
      loadConfig();
      return importer.run(source);
    }
    default:
      throw new Failure(`unknown command ${JSON.stringify(command ?? "")}\n${USAGE}`);
  }
}

if (import.meta.main) {
  main(process.argv.slice(2)).catch((e: unknown) => {
    if (!(e instanceof Failure) && !(e instanceof TypeError && "code" in e)) throw e;
    process.stderr.write(`ai-digest ${process.argv[2] ?? ""}: ${e.message}\n`);
    process.exitCode = 1;
  });
}
