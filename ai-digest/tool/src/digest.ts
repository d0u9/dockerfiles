// digest: turn one person's pulled articles into a digest with codex.
//
// Reads spool/<user>.articles.jsonl and spool/<user>.window.json, and writes:
//
//     spool/<user>.json            the digest (DESIGN 5.2)
//     spool/<user>.pulled.jsonl    every pulled article's metadata and status (5.4)
//     spool/prompts/<sha256>.md    the prompt that was sent
//     spool/weather.json           the day's weather, unless the day has it (5.3)
//
// The model never writes a title or a link. Each article is handed to it
// under a number, it answers with numbers and its own prose, and the titles
// and links are put back from the input. Feed content is written by strangers
// and may carry instructions aimed at the model; the worst such text can do is
// change which numbers come back and what the notes say, not put an address on
// the page that was not in the feed.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Article, Digest, PulledArticle, Weather } from "../../shared/types.ts";
import {
  ASSETS, type Config, Failure, type Moment, type Place, VERSION, dayDir, dirs, log, now,
  readJson, readJsonl, readText, sha256, userOrFail, writeAtomic, writeJson, writeJsonl,
} from "./common.ts";
import type { Spooled, SpooledWindow } from "./pull.ts";

/** What codex answers, as schema.json constrains it. */
export interface Answer {
  summary: string;
  groups: { title: string; summary: string; items: { ref: number; note: string }[] }[];
  highlights: { ref: number; why: string }[];
}

// ---- the prompt (DESIGN 6.1) -----------------------------------------------

/** The fixed sections, as a rule. Generated from the configuration, so it
 * belongs with the output rules rather than with the preferences. */
function sectionsRule(sections: string[]): string {
  return [
    "The groups are fixed. Every `title` must be one of the names below, each used "
      + "at most once, and this overrides anything above or below about the number, "
      + "names or order of groups:",
    sections.map((s) => `- ${s}`).join("\n"),
    "Put each article you include in the group that fits it best; one that fits none "
      + "goes in the last group. Leave out groups with no articles.",
  ].join("\n\n");
}

export function buildPrompt(user: string, sections: string[], configDir = dirs.config): string {
  const prompts = path.join(configDir, "prompts");
  const shared = readText(path.join(prompts, "shared.md"));
  if (!shared) throw new Failure(`${prompts}/shared.md is missing or empty; not calling codex without it`);
  const parts = [readText(path.join(ASSETS, "rules.md"))];
  if (sections.length) parts.push(sectionsRule(sections));
  parts.push("## Preferences\n\n" + shared);
  const own = readText(path.join(prompts, `${user}.md`));
  if (own) {
    parts.push("## This reader's own preferences\n\n"
      + "Where these disagree with the preferences above, these win.\n\n" + own);
  }
  return parts.join("\n\n") + "\n";
}

function schemaFor(sections: string[]): unknown {
  const schema = JSON.parse(fs.readFileSync(path.join(ASSETS, "schema.json"), "utf8"));
  if (sections.length) schema.properties.groups.items.properties.title.enum = sections;
  return schema;
}

// ---- codex -------------------------------------------------------------------

function modelInput(articles: Spooled[]): string {
  // Only what the model needs to judge an article. The url stays out: the
  // model has no use for it, and leaving it out means it cannot echo one.
  return articles.map((a, n) => JSON.stringify({
    n, feed: a.feed, title: a.title, published: a.published, text: a.text,
  }) + "\n").join("");
}

function runCodex(prompt: string, input: string, schema: unknown, codex: Config["codex"]): Answer {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ai-digest-"));
  try {
    const schemaPath = path.join(tmp, "schema.json");
    fs.writeFileSync(schemaPath, JSON.stringify(schema));
    const last = path.join(tmp, "last.json");
    const work = path.join(tmp, "work");
    fs.mkdirSync(work);
    const args = [
      "exec", "--skip-git-repo-check", "--ephemeral", "--ignore-user-config",
      "--sandbox", "read-only", "--color", "never", "--cd", work,
      "--output-schema", schemaPath, "--output-last-message", last,
    ];
    if (codex.model) args.push("--model", codex.model);
    if (codex.reasoning_effort) args.push("-c", `model_reasoning_effort=${codex.reasoning_effort}`);
    args.push(prompt);
    // codex reports progress on stdout; keep it out of the way on stderr.
    const result = spawnSync("codex", args, {
      input, stdio: ["pipe", 2, 2], timeout: codex.timeout ? codex.timeout * 1000 : undefined,
      maxBuffer: 64 * 1024 * 1024,
    });
    const code = (result.error as NodeJS.ErrnoException | undefined)?.code;
    if (code === "ENOENT") throw new Failure("codex not found");
    if (code === "ETIMEDOUT") throw new Failure(`codex did not finish in ${codex.timeout} seconds`);
    if (result.error) throw new Failure(`codex: ${result.error.message}`);
    if (result.status !== 0) throw new Failure(`codex exited with ${result.status ?? result.signal}`);
    try {
      return JSON.parse(fs.readFileSync(last, "utf8")) as Answer;
    } catch (e) {
      throw new Failure(`codex returned no JSON: ${(e as Error).message}`);
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** One group per section, in the configured order. The schema holds titles to
 * the sections but cannot stop the model from using one twice, and the
 * model's order is a guess. */
export function inOrder(groups: Answer["groups"], sections: string[]): Answer["groups"] {
  if (!sections.length) return groups;
  const merged = new Map<string, Answer["groups"][number]>();
  for (const g of groups) {
    const seen = merged.get(g.title);
    if (seen) seen.items.push(...g.items);
    else merged.set(g.title, { ...g, items: [...g.items] });
  }
  return sections.flatMap((s) => merged.get(s) ?? []);
}

type Body = Pick<Digest, "summary" | "highlights" | "sections" | "articles">;

/** Replace article numbers with IDs; collect the selected articles. */
export function expand(answer: Answer, articles: Spooled[], sections: string[]): Body {
  const selected: Record<string, Article> = {};
  const ref = (n: number): string => {
    const a = Number.isInteger(n) ? articles[n] : undefined;
    if (!a) throw new Failure(`codex referred to article ${JSON.stringify(n)}, which does not exist`);
    selected[a.article] = { title: a.title, url: a.url, feed: a.feed, site: a.site, published: a.published };
    return a.article;
  };
  const highlights = answer.highlights.map((h) => ({ article: ref(h.ref), why: h.why }));
  const groups = inOrder(answer.groups, sections).map((g) => ({
    title: g.title, summary: g.summary,
    items: g.items.map((i) => ({ article: ref(i.ref), note: i.note })),
  }));
  return { summary: answer.summary, highlights, sections: groups, articles: selected };
}

// ---- weather (DESIGN 5.3) ------------------------------------------------------

interface Forecast {
  current: { temperature_2m: number; weather_code: number };
  daily: { weather_code: number[]; temperature_2m_min: number[]; temperature_2m_max: number[] };
}

/** The day's weather at every place, or null when it cannot be had. It is
 * decoration: a failure is reported and the digest goes on without it. */
export async function fetchWeather(places: Place[], moment: Moment): Promise<Weather | null> {
  const query = new URLSearchParams({
    latitude: places.map((p) => p.latitude).join(","),
    longitude: places.map((p) => p.longitude).join(","),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min",
    timezone: "auto",
    forecast_days: "2",
  });
  try {
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query}`,
      { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const body = await response.json() as Forecast | Forecast[];
    const data = Array.isArray(body) ? body : [body];
    if (data.length !== places.length) throw new Error(`${data.length} forecasts for ${places.length} places`);
    const daily = (d: Forecast, i: number) => {
      const code = d.daily.weather_code[i], min = d.daily.temperature_2m_min[i], max = d.daily.temperature_2m_max[i];
      if (code === undefined || min === undefined || max === undefined) throw new Error("short forecast");
      return { code, min, max };
    };
    return {
      version: 1,
      date: moment.date,
      fetched_at: moment.iso,
      source: "open-meteo",
      places: places.map((p, i) => {
        const d = data[i]!;
        return {
          name: p.name, latitude: p.latitude, longitude: p.longitude,
          now: { temperature: d.current.temperature_2m, code: d.current.weather_code },
          today: daily(d, 0),
          tomorrow: daily(d, 1),
        };
      }),
    };
  } catch (e) {
    log("digest", `no weather today: ${(e as Error).message}`);
    return null;
  }
}

/** Fetch the day's weather once: skip it when the day already has it. */
async function weather(config: Config, moment: Moment): Promise<void> {
  if (!config.weather.length) return;
  const spooled = path.join(dirs.spool, "weather.json");
  const stored = path.join(dayDir(dirs.data, moment.date), "weather.json");
  if (fs.existsSync(stored) || readJson<Weather>(spooled)?.date === moment.date) return;
  const result = await fetchWeather(config.weather, moment);
  if (result) writeJson(spooled, result);
}

// ---- the command -----------------------------------------------------------------

/** The rows without their text, as the data repository keeps them. */
function metadata<T extends { text: string }>(rows: T[]): Omit<T, "text">[] {
  return rows.map(({ text: _text, ...rest }) => rest);
}

export async function run(config: Config, user: string): Promise<void> {
  const { sections } = userOrFail(config, user);
  const moment = now(config);
  const prompt = buildPrompt(user, sections);
  const span = readJson<SpooledWindow>(path.join(dirs.spool, `${user}.window.json`));
  if (!span) throw new Failure(`no pull for ${user} in ${dirs.spool}; run pull first`);
  const pulled = readJsonl<Spooled>(path.join(dirs.spool, `${user}.articles.jsonl`));
  const sent = pulled.filter((a) => a.status === "sent");

  await weather(config, moment);
  const digestPath = path.join(dirs.spool, `${user}.json`);
  const pulledPath = path.join(dirs.spool, `${user}.pulled.jsonl`);
  for (const stale of [digestPath, pulledPath]) fs.rmSync(stale, { force: true });
  if (!sent.length) {
    // Nothing to read is an answer, not an error, and not worth a model call.
    // What did arrive, from skipped feeds, is still recorded.
    if (pulled.length) writeJsonl(pulledPath, metadata(pulled));
    log("digest", `${user}: no articles to digest`);
    return;
  }

  const answer = runCodex(prompt, modelInput(sent), schemaFor(sections), config.codex);
  const body = expand(answer, sent, sections);
  if (!body.sections.length) {
    throw new Failure(`${user}: codex selected none of ${sent.length} articles; not writing a digest`);
  }

  const statuses: (Omit<Spooled, "status"> & Pick<PulledArticle, "status">)[] = pulled.map((a) => ({
    ...a,
    status: a.status === "skipped" ? "skipped" : a.article in body.articles ? "selected" : "dropped",
  }));
  const sha = sha256(prompt);
  writeAtomic(path.join(dirs.spool, "prompts", `${sha}.md`), prompt);
  writeJsonl(pulledPath, metadata(statuses));
  const digest: Digest = {
    version: 1,
    user,
    date: moment.date,
    generated_at: moment.iso,
    run: {
      tool: VERSION,
      model: config.codex.model,
      reasoning_effort: config.codex.reasoning_effort,
      prompt_sha256: sha,
      window: { from: span.from, to: span.to },
    },
    stats: { pulled: span.pulled, skipped: span.skipped, sent: sent.length, selected: Object.keys(body.articles).length },
    ...body,
  };
  writeJson(digestPath, digest);
  log("digest", `${user}: ${digest.stats.selected} of ${sent.length} articles selected`);
}
