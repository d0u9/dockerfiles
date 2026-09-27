// Generate made-up data for local development: a data repository with 75
// days for three people, one of whom starts later, then run the tool's own
// `index` over it into fixtures/data. Every name, place and link is invented.
//
//     npm run fixtures

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Article, Digest, Weather } from "../../shared/types.ts";
import { type Config, articleId, dayDir, writeJson } from "../../tool/src/common.ts";

const here = import.meta.dirname;
const data = fs.mkdtempSync(path.join(os.tmpdir(), "ai-digest-fixtures-"));
// index writes <web>/data/…, so fixtures/ is the web root here.
process.env.AI_DIGEST_DATA = data;
process.env.AI_DIGEST_WEB = here;
const { run } = await import("../../tool/src/indexer.ts");

const DAYS = 75;
const USERS = { alice: 0, bob: 0, carol: 40 }; // carol starts 40 days in
const SECTIONS = ["Local", "World", "Technology", "Science", "Other"];
const PLACES = [
  { name: "Springfield", latitude: 48.1, longitude: 11.6 },
  { name: "Shelbyville", latitude: 47.4, longitude: 8.5 },
  { name: "Ogdenville", latitude: 52.5, longitude: 13.4 },
];
const CODES = [0, 1, 2, 3, 45, 51, 61, 63, 71, 80, 95];

let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]): T => xs[Math.floor(random() * xs.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

function article(date: string, n: number): [string, Article] {
  const url = `https://news.example/${date}/${n}`;
  const title = `${pick(["New", "Old", "Big", "Small", "Quiet"])} ${pick(["bridge", "library", "compiler", "comet", "market", "garden"])} ${pick(["opens", "closes", "delayed", "released", "found"])}`;
  return [articleId(url), { title, url, feed: pick(["Example News", "Sample Daily", "Test Weekly"]), site: "news.example", published: `${date}T06:00:00Z` }];
}

fs.rmSync(path.join(here, "data"), { recursive: true, force: true });
const end = new Date();
for (let i = DAYS - 1; i >= 0; i--) {
  const moment = new Date(end.getTime() - i * 86400_000);
  const date = moment.toISOString().slice(0, 10);
  const iso = `${date}T07:30:00+00:00`;
  if (random() < 0.9) {
    const weather: Weather = {
      version: 1, date, fetched_at: iso, source: "open-meteo",
      places: PLACES.map((p) => {
        const min = int(-2, 18), code = pick(CODES);
        return {
          ...p, now: { temperature: min + int(0, 8) + 0.4, code },
          today: { code, min, max: min + int(3, 10) },
          tomorrow: { code: pick(CODES), min: min + int(-2, 2), max: min + int(3, 10) },
        };
      }),
    };
    writeJson(path.join(dayDir(data, date), "weather.json"), weather);
  }
  for (const [user, start] of Object.entries(USERS)) {
    if (DAYS - 1 - i < start || random() < 0.07) continue;
    const articles = Object.fromEntries(Array.from({ length: int(8, 16) }, (_, n) => article(date, n)));
    const ids = Object.keys(articles);
    const sections = SECTIONS.filter(() => random() < 0.7).map((title) => ({
      title, summary: `What ${title.toLowerCase()} covered today.`,
      items: ids.filter(() => random() < 0.3).map((a) => ({ article: a, note: "A sentence on what the article says." })),
    })).filter((s) => s.items.length);
    const used = new Set(sections.flatMap((s) => s.items.map((i) => i.article)));
    const highlights = [...used].slice(0, 3).map((a) => ({ article: a, why: "Why it is worth reading." }));
    const digest: Digest = {
      version: 1, user, date, generated_at: iso,
      run: { tool: "dev", model: "example-model", reasoning_effort: "low" },
      stats: { pulled: int(120, 260), skipped: int(0, 12), sent: 100, selected: used.size },
      summary: `${user}'s made-up summary for ${date}: several things happened, none of them real.`,
      highlights, sections,
      articles: Object.fromEntries([...used].map((a) => [a, articles[a]!])),
    };
    writeJson(path.join(dayDir(data, date), `${user}.json`), digest);
  }
}

const config: Config = {
  version: 1, timezone: "UTC",
  freshrss: { url: null, timeout: 30 },
  codex: { model: null, reasoning_effort: null, timeout: 0 },
  pull: { since: "24h", max_window: "7d", max_chars: 4000, unread_only: false },
  users: Object.fromEntries(Object.keys(USERS).map((u) => [u, { sections: SECTIONS, skip_feeds: [] }])),
  weather: PLACES,
  links: [
    { title: "Rates", items: [{ name: "AAA/BBB", url: "https://example.com/rates/aaa-bbb" }, { name: "CCC/BBB", url: "https://example.com/rates/ccc-bbb" }] },
    { title: "Markets", items: [{ name: "Example 100", url: "https://example.com/quote/ex100" }, { name: "Sample Composite", url: "https://example.com/quote/smp" }] },
  ],
  clocks: [
    { name: "Here", timezone: "UTC" },
    { name: "East", timezone: "Asia/Tokyo" },
    { name: "West", timezone: "America/New_York" },
  ],
  holidays: [{ name: "Example", country: "AU", region: "AU-NSW" }, { name: "Sample", country: "CN" }],
  data: { branch: "main" },
};
run(config, true);
fs.rmSync(data, { recursive: true, force: true });
