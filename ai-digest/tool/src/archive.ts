// archive: move the spool into the data repository, commit and push.
//
// One commit per run. A failed push is reported but is not an error: the
// commit stays in the clone and the next run pushes it with its own.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Digest, Weather } from "../../shared/types.ts";
import { ASSETS, type Config, Failure, dayDir, dirs, log, now, readJson } from "./common.ts";

const AUTHOR = ["-c", "user.name=ai-digest", "-c", "user.email=ai-digest@localhost"];

export function git(args: string[], options: { check?: boolean; env?: NodeJS.ProcessEnv } = {}) {
  const result = spawnSync("git", ["-C", dirs.data, ...AUTHOR, ...args], {
    encoding: "utf8", env: options.env ?? process.env,
  });
  if (result.error) throw new Failure(`git: ${result.error.message}`);
  if ((options.check ?? true) && result.status !== 0) {
    throw new Failure(`git ${args[0]}: ${(result.stderr || result.stdout).trim()}`);
  }
  return result;
}

/** Push with the deploy key and GitHub's published host key only: no agent,
 * no user configuration, no trust on first use. */
function sshEnv(): NodeJS.ProcessEnv {
  const key = path.join(dirs.secrets, "deploy_key");
  if (!fs.existsSync(key)) throw new Failure(`${key} not found; mount the data repository's deploy key there`);
  const known = path.join(ASSETS, "known_hosts");
  return {
    ...process.env,
    GIT_SSH_COMMAND: `ssh -F /dev/null -i ${key} -o IdentitiesOnly=yes -o IdentityAgent=none`
      + ` -o UserKnownHostsFile=${known} -o StrictHostKeyChecking=yes`,
  };
}

/** [spool path, repository path] for every file this run produced. */
function collect(config: Config, today: string): [string, string][] {
  const moves: [string, string][] = [];
  const target = dayDir(dirs.data, today);
  const weather = path.join(dirs.spool, "weather.json");
  if (readJson<Weather>(weather)?.date === today) moves.push([weather, path.join(target, "weather.json")]);
  for (const user of Object.keys(config.users)) {
    for (const suffix of [".json", ".pulled.jsonl"]) {
      const file = path.join(dirs.spool, user + suffix);
      if (fs.existsSync(file)) moves.push([file, path.join(target, user + suffix)]);
    }
  }
  const prompts = path.join(dirs.spool, "prompts");
  if (fs.existsSync(prompts)) {
    for (const name of fs.readdirSync(prompts).sort()) {
      moves.push([path.join(prompts, name), path.join(dirs.data, "prompts", name)]);
    }
  }
  return moves;
}

function message(config: Config, today: string): string {
  const counts = Object.keys(config.users).flatMap((user) => {
    const digest = readJson<Digest>(path.join(dayDir(dirs.data, today), `${user}.json`));
    return digest?.date === today ? [`${user} ${digest.stats.selected}`] : [];
  });
  return `${today}: ${counts.join(", ") || "no digests"}`;
}

export function run(config: Config): void {
  if (!fs.existsSync(path.join(dirs.data, ".git"))) {
    throw new Failure(`${dirs.data} is not a clone of the data repository`);
  }
  const today = now(config).date;
  const env = sshEnv();

  const moves = collect(config, today);
  for (const [source, target] of moves) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  }
  git(["add", "--all", "--", "."]);
  if (git(["diff", "--cached", "--quiet"], { check: false }).status === 0) {
    log("archive", "nothing new to commit");
  } else {
    git(["commit", "--quiet", "-m", message(config, today)]);
    log("archive", `committed ${moves.length} files for ${today}`);
  }
  // Only now, once they are committed, do the spool files go.
  for (const [source] of moves) fs.rmSync(source);

  const pushed = git(["push", "--quiet", "origin", `HEAD:${config.data.branch}`], { check: false, env });
  if (pushed.status !== 0) log("archive", `push failed; the commit stays local: ${pushed.stderr.trim()}`);
}
