// End-to-end tests with a fake codex, a fake FreshRSS and a local data
// repository. Run from tool/: npm test

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, test } from "node:test";
import type { Digest, Month, PulledArticle, SiteIndex } from "../../shared/types.ts";
import * as archive from "../src/archive.ts";
import { Failure, articleId, dayDir, loadConfig, writeJson, zoned } from "../src/common.ts";
import * as digest from "../src/digest.ts";
import * as indexer from "../src/indexer.ts";
import * as pull from "../src/pull.ts";

const FAKE_CODEX = `#!/usr/bin/env node
const fs = require("node:fs");
const args = process.argv;
const out = args[args.indexOf("--output-last-message") + 1];
const schema = JSON.parse(fs.readFileSync(args[args.indexOf("--output-schema") + 1], "utf8"));
const lines = fs.readFileSync(0, "utf8").split("\\n").filter(Boolean).map((l) => JSON.parse(l));
const title = (schema.properties.groups.items.properties.title.enum ?? ["Misc"]).at(-1);
fs.writeFileSync(out, JSON.stringify({
  summary: "s", highlights: [{ ref: 0, why: "w" }],
  groups: [{ title, summary: "g", items: lines.map((l) => ({ ref: l.n, note: "n" })) }],
}));
`;

const CONFIG = {
  timezone: "UTC",
  freshrss: { url: "http://freshrss.invalid" },
  users: { alice: { sections: ["World", "Other"], skip_feeds: ["skip.example"] }, bob: {} },
};

const item = (n: number, host = "news.example"): pull.Item => ({
  title: `Story ${n}`,
  published: 1790000000 + n,
  canonical: [{ href: `https://${host}/${n}?utm_source=x` }],
  origin: { title: host, htmlUrl: `https://${host}/` },
  summary: { content: `<p>Body ${n}</p><script>x</script>` },
});

const source = (items: pull.Item[]): pull.Source => ({
  async login() {},
  async *items() { yield* items; },
});

let root = "";
let saved: NodeJS.ProcessEnv;
const dir = (name: string) => path.join(root, name);
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

beforeEach(() => {
  saved = { ...process.env };
  root = fs.mkdtempSync(path.join(os.tmpdir(), "ai-digest-test-"));
  for (const d of ["config/prompts", "spool", "web", "secrets/freshrss", "bin"]) {
    fs.mkdirSync(dir(d), { recursive: true });
  }
  fs.writeFileSync(dir("config/config.json"), JSON.stringify(CONFIG));
  fs.writeFileSync(dir("config/prompts/shared.md"), "Prefer local news.\n");
  for (const u of ["alice", "bob"]) fs.writeFileSync(dir(`secrets/freshrss/${u}`), "pw\n");
  fs.writeFileSync(dir("secrets/deploy_key"), "");
  fs.writeFileSync(dir("bin/codex"), FAKE_CODEX, { mode: 0o755 });
  git(["init", "-q", "--bare", "-b", "main", dir("remote")]);
  git(["clone", "-q", dir("remote"), dir("data")]);
  for (const k of ["config", "spool", "data", "web", "secrets"]) {
    process.env[`AI_DIGEST_${k.toUpperCase()}`] = dir(k);
  }
  process.env.PATH = dir("bin") + path.delimiter + process.env.PATH;
});

afterEach(() => {
  process.env = saved;
  fs.rmSync(root, { recursive: true, force: true });
});

/** Runs git for the test setup, failing loudly: without git every later
 * archive step would fail with a misleading message. */
function git(args: string[]): void {
  const r = spawnSync("git", args, { stdio: ["ignore", "ignore", "pipe"], encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed: ${r.error?.message ?? r.stderr}`);
}

test("IDs ignore tracking parameters, case, default port and fragment", () => {
  const a = articleId("https://News.Example:443/a?b=2&utm_source=x&a=1#frag");
  assert.equal(a, articleId("https://news.example/a?a=1&b=2"));
  assert.equal(a.length, 12);
});

test("zoned times carry the zone's offset", () => {
  const m = zoned(Date.parse("2026-09-27T20:30:00Z"), "Asia/Tokyo");
  assert.equal(m.date, "2026-09-28");
  assert.equal(m.iso, "2026-09-28T05:30:00+09:00");
});

test("configuration rejects unknown keys", () => {
  fs.writeFileSync(dir("config/config.json"), JSON.stringify({ ...CONFIG, extra: 1 }));
  assert.throws(() => loadConfig(), Failure);
});

test("digest refuses to run without the shared prompt", async () => {
  fs.rmSync(dir("config/prompts/shared.md"));
  await pull.run(loadConfig(), "bob", source([item(1)]));
  await assert.rejects(digest.run(loadConfig(), "bob"), Failure);
  assert.ok(!fs.existsSync(dir("spool/bob.json")));
});

test("a daily run: pull, digest, archive, index", async () => {
  const config = loadConfig();
  await pull.run(config, "alice", source([item(1), item(2), item(3, "skip.example"), item(1)]));
  await digest.run(config, "alice");

  const d = read<Digest>(dir("spool/alice.json"));
  assert.deepEqual(d.stats, { pulled: 3, skipped: 1, sent: 2, selected: 2 });
  assert.deepEqual(d.sections.map((s) => s.title), ["Other"]);
  const pulled = fs.readFileSync(dir("spool/alice.pulled.jsonl"), "utf8").trim().split("\n")
    .map((l) => JSON.parse(l) as PulledArticle & { text?: string });
  assert.deepEqual(pulled.map((p) => p.status), ["selected", "selected", "skipped"]);
  assert.equal(pulled[0]!.text, undefined);
  const prompt = fs.readFileSync(dir(`spool/prompts/${d.run.prompt_sha256}.md`), "utf8");
  assert.ok(prompt.indexOf("Output rules") < prompt.indexOf("- World"));
  assert.ok(prompt.indexOf("- World") < prompt.indexOf("Prefer local news."));

  archive.run(config);
  assert.ok(fs.existsSync(path.join(dayDir(dir("data"), d.date), "alice.json")));
  assert.ok(!fs.existsSync(dir("spool/alice.json")));
  const log = spawnSync("git", ["-C", dir("remote"), "log", "--format=%s", "main"], { encoding: "utf8" });
  assert.match(log.stdout, /alice 2/);

  indexer.run(config);
  const index = read<SiteIndex>(dir("web/data/index.json"));
  assert.deepEqual(index.users, ["alice", "bob"]);
  const month = read<Month>(dir(`web/data/months/${d.date.slice(0, 7)}.json`));
  assert.deepEqual(month.users, ["alice"]);
  assert.equal(month.days[0]!.digests.alice!.top, "Story 1");
});

test("the pull window continues from the previous digest, up to the cap", () => {
  const config = loadConfig();
  const now = Math.floor(Date.now() / 1000) * 1000;
  const yesterday = zoned(now - 86400_000, "UTC");
  const end = zoned(now - 20 * 3600_000, "UTC");
  writeJson(path.join(dayDir(dir("data"), yesterday.date), "bob.json"),
    { run: { window: { from: yesterday.iso, to: end.iso } } });
  const today = zoned(now, "UTC").date;
  assert.equal(pull.pullWindow(config, "bob", dir("data"), now, today), end.ms);
  const later = now + 30 * 86400_000;
  assert.equal(pull.pullWindow(config, "bob", dir("data"), later, "2099-01-01"), later - 7 * 86400_000);
});
