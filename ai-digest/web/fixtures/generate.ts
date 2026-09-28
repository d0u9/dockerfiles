// Generate made-up data for local development: a data repository with 75
// days for three people, one of whom starts later, then run the tool's own
// `index` over it into fixtures/data. Every name, place and link is invented.
//
//     npm run fixtures

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Article, Digest, Markets, Series, Weather } from "../../shared/types.ts";
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
  { name: "North Haverbrook", latitude: 41.4, longitude: 2.2 },
  { name: "Capital City", latitude: 45.5, longitude: 9.2 },
  { name: "Brockway", latitude: 50.1, longitude: 14.4 },
  { name: "Cypress Creek", latitude: 38.7, longitude: -9.1 },
];
// Enough of everything that the cards overflow, as a real set-up does.
const QUOTES: [string, string, number][] = [
    ["Example 100", "EX100", 7800], ["Sample Composite", "SMPC", 3900], ["Test Index", "TST", 24500],
    ["Demo Tech", "DMT", 180], ["Placeholder Retail", "PHR", 210], ["Mock Motors", "MKM", 95],
    ["Fictional Foods", "FFD", 64], ["Dummy Devices", "DDV", 330],
  ];
const CODES = [0, 1, 2, 3, 45, 51, 61, 63, 71, 80, 95];

let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T>(xs: T[]): T => xs[Math.floor(random() * xs.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

const NOTES = [
  "A council report finds the project two years behind schedule and asks for a review of the contract.",
  "Researchers describe a method that halves the time needed, though it has only been tried on small samples.",
  "The release adds a long-requested feature and drops support for two older platforms.",
  "Residents are told to expect delays through the weekend while the crossing is inspected.",
  "An interview with the people who kept the service running when the main system failed.",
];
const WHYS = [
  "The clearest account of what changed and who it affects, with the numbers behind it.",
  "Goes beyond the announcement to explain why the earlier plan did not work.",
  "A rare first-hand view, and short enough to read in a few minutes.",
];

function article(date: string, n: number): [string, Article] {
  const url = `https://news.example/${date}/${n}`;
  const title = `${pick(["New", "Old", "Big", "Small", "Quiet"])} ${pick(["bridge", "library", "compiler", "comet", "market", "garden"])} ${pick(["opens", "closes", "delayed", "released", "found"])} ${pick(["after years of planning", "as costs rise", "ahead of the holidays", "despite objections", "in a surprise move"])}`;
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
  const walk = (start: number, step: number): Series => {
    const out: Series = [];
    let v = start;
    for (let d = 30; d >= 0; d--) {
      v *= 1 + (random() - 0.5) * step;
      out.push({ date: new Date(moment.getTime() - d * 86400_000).toISOString().slice(0, 10), value: v });
    }
    return out;
  };
  const rate = (base: string, quote: string, start: number) => {
    const history = walk(start, 0.01);
    return { base, quote, as_of: date, value: history.at(-1)!.value, history };
  };
  const quote = (name: string, symbol: string, start: number) => {
    const history = walk(start, 0.02);
    return { name, symbol, currency: "XXX", as_of: iso, value: history.at(-1)!.value, previous_close: history.at(-2)!.value, history };
  };
  const markets: Markets = {
    version: 1, date, fetched_at: iso,
    rates: [rate("EUR", "USD", 1.1), rate("EUR", "GBP", 0.85), rate("USD", "JPY", 150), rate("USD", "CHF", 0.8)],
    quotes: QUOTES.map(([name, symbol, start]) => quote(name, symbol, start)),
  };
  writeJson(path.join(dayDir(data, date), "markets.json"), markets);
  for (const [user, start] of Object.entries(USERS)) {
    if (DAYS - 1 - i < start || random() < 0.07) continue;
    const articles = Object.fromEntries(Array.from({ length: int(8, 16) }, (_, n) => article(date, n)));
    const ids = Object.keys(articles);
    const sections = SECTIONS.filter(() => random() < 0.7).map((title) => ({
      title, summary: `What ${title.toLowerCase()} covered today.`,
      items: ids.filter(() => random() < 0.3).map((a) => ({ article: a, note: pick(NOTES) })),
    })).filter((s) => s.items.length);
    const used = new Set(sections.flatMap((s) => s.items.map((i) => i.article)));
    const highlights = [...used].slice(0, 5).map((a) => ({ article: a, why: pick(WHYS) }));
    const digest: Digest = {
      version: 1, user, date, generated_at: iso,
      run: { tool: "dev", model: "example-model", reasoning_effort: "low" },
      stats: { pulled: int(120, 260), skipped: int(0, 12), sent: 100, selected: used.size },
      summary: `${user}'s made-up summary for ${date}. The biggest local story is a delayed bridge, now two years behind schedule. `
        + "Abroad, talks on a trade agreement resumed after a month's pause. In technology, a widely used compiler "
        + "shipped a major release. None of this is real.",
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
  users: Object.fromEntries(Object.keys(USERS).map((u) => [u, { sections: SECTIONS, skip_feeds: [], dashboard: {} }])),
  weather: PLACES,
  links: [
    { title: "Links", items: [{ name: "Example", url: "https://example.com/" }, { name: "Sample", url: "https://example.org/" }] },
  ],
  clocks: [
    { name: "Here", timezone: "UTC" },
    { name: "East", timezone: "Asia/Tokyo" },
    { name: "West", timezone: "America/New_York" },
  ],
  holidays: [{ name: "Example", country: "AU", region: "AU-NSW" }, { name: "Sample", country: "CN" }],
  // Real currency codes, so the browser's live rates can be tried; made-up
  // symbols, which only the saved snapshot has.
  markets: {
    rates: [{ base: "EUR", quote: "USD" }, { base: "EUR", quote: "GBP" }, { base: "USD", quote: "JPY" }, { base: "USD", quote: "CHF" }],
    quotes: QUOTES.map(([name, symbol]) => ({ name, symbol })),
  },
  data: { branch: "main" },
};
// bob has an own dashboard: fewer places, other clocks, one rate
// and two quotes, other links. The rest is the shared one.
config.users.bob!.dashboard = {
  weather: PLACES.slice(1, 3),
  clocks: [{ name: "Here", timezone: "UTC" }, { name: "South", timezone: "Pacific/Auckland" }],
  markets: { rates: [{ base: "USD", quote: "JPY" }], quotes: QUOTES.slice(3, 5).map(([name, symbol]) => ({ name, symbol })) },
  links: [{ title: "Bob's", items: [{ name: "Example", url: "https://example.net/" }] }],
};
run(config, true);
fs.rmSync(data, { recursive: true, force: true });
