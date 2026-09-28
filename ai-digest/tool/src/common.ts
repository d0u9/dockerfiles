// Configuration, paths and small helpers shared by every command.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Clock, HolidayRegion, LinkGroup, MarketsConfig } from "../../shared/types.ts";

/** The directory holding rules.md, schema.json and known_hosts: tool/assets
 * from the source tree; the image sets AI_DIGEST_ASSETS for the compiled one. */
export const ASSETS = process.env.AI_DIGEST_ASSETS
  ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../assets");

// Where each mount appears in the container. Every one can be moved with an
// environment variable, for running outside the image. Read on each call so
// tests can point them elsewhere.
export const dirs = {
  get config() { return process.env.AI_DIGEST_CONFIG ?? "/config"; },
  get spool() { return process.env.AI_DIGEST_SPOOL ?? "/spool"; },
  get data() { return process.env.AI_DIGEST_DATA ?? "/data"; },
  get web() { return process.env.AI_DIGEST_WEB ?? "/web"; },
  get secrets() { return process.env.AI_DIGEST_SECRETS ?? "/secrets"; },
  get appWeb() { return process.env.AI_DIGEST_APP_WEB ?? "/app/web"; },
};

export const VERSION = process.env.AI_DIGEST_VERSION ?? "dev";
export const NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** An error to report in one line and exit on, without a stack trace. */
export class Failure extends Error {}

export function log(command: string, message: string): void {
  process.stderr.write(`ai-digest ${command}: ${message}\n`);
}

/** `24h`, `7d`, `90m` or `30s` as milliseconds. */
export function duration(value: string): number {
  const m = /^(\d+)([smhd])$/.exec(value);
  if (!m) throw new Failure(`not a duration: ${JSON.stringify(value)} (use e.g. 24h, 7d, 90m)`);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[m[2] as "s" | "m" | "h" | "d"];
  return Number(m[1]) * unit * 1000;
}

// ---- configuration -------------------------------------------------------

export interface Place { name: string; latitude: number; longitude: number }
/** What the dashboard shows around the news. Each person may have their own. */
export interface Dashboard {
  weather: Place[];
  links: LinkGroup[];
  clocks: Clock[];
  holidays: HolidayRegion[];
  markets: MarketsConfig;
}
export const DASHBOARD_KEYS = ["weather", "links", "clocks", "holidays", "markets"] as const;
export interface UserSettings {
  sections: string[];
  skip_feeds: string[];
  /** The person's own dashboard; each part left out is the shared one. */
  dashboard: Partial<Dashboard>;
}
export interface Config {
  version: 1;
  timezone: string;
  freshrss: { url: string | null; timeout: number };
  codex: { model: string | null; reasoning_effort: string | null; timeout: number };
  pull: { since: string; max_window: string; max_chars: number; unread_only: boolean };
  users: Record<string, UserSettings>;
  weather: Place[];
  links: LinkGroup[];
  clocks: Clock[];
  holidays: HolidayRegion[];
  markets: MarketsConfig;
  data: { branch: string };
}

type Kind = "string" | "string?" | "number" | "boolean";
const SCHEMA: Record<string, Record<string, [Kind, unknown]>> = {
  freshrss: { url: ["string?", null], timeout: ["number", 30] },
  codex: { model: ["string?", null], reasoning_effort: ["string?", null], timeout: ["number", 1800] },
  pull: {
    since: ["string", "24h"], max_window: ["string", "7d"],
    max_chars: ["number", 4000], unread_only: ["boolean", false],
  },
  data: { branch: ["string", "main"] },
};
const ENV: [string, string, string][] = [
  ["codex", "model", "AI_DIGEST_MODEL"],
  ["codex", "reasoning_effort", "AI_DIGEST_REASONING_EFFORT"],
  ["codex", "timeout", "AI_DIGEST_TIMEOUT"],
  ["pull", "since", "AI_DIGEST_SINCE"],
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function check(where: string, value: unknown, kind: Kind): void {
  const ok = kind === "string?" ? value === null || typeof value === "string"
    : kind === "number" ? Number.isInteger(value)
    : typeof value === kind;
  if (!ok) throw new Failure(`config: ${where} has the wrong type: ${JSON.stringify(value)}`);
}

function unknownKey(where: string, given: Record<string, unknown>, allowed: Iterable<string>): void {
  const known = new Set(allowed);
  const extra = Object.keys(given).filter((k) => !known.has(k)).sort()[0];
  if (extra !== undefined) throw new Failure(`config: unknown key ${where}${extra}`);
}

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * The dashboard's parts at `where` in the configuration: the top level, where
 * each is required to exist in the result (`all`), or a person's, where only
 * the parts given are.
 */
function dashboardOf(where: string, raw: Record<string, unknown>, all: boolean): Partial<Dashboard> {
  const out: Record<string, unknown> = {};
  if (all || "weather" in raw) {
  const places = raw.weather ?? [];
  if (!Array.isArray(places)) throw new Failure(`config: ${where}weather must be a list`);
  places.forEach((p: unknown, i) => {
    const keys = ["latitude", "longitude", "name"];
    if (!isObject(p) || Object.keys(p).sort().join() !== keys.join()) {
      throw new Failure(`config: ${where}weather[${i}] must have exactly ${keys.join(", ")}`);
    }
    check(`${where}weather[${i}].name`, p.name, "string");
    for (const k of ["latitude", "longitude"]) {
      if (typeof p[k] !== "number") throw new Failure(`config: ${where}weather[${i}].${k} must be a number`);
    }
  });
  out.weather = places;
  }

  // Groups of links for the dashboard, such as pages to look up rates or
  // quotes. Nothing is built in.
  if (all || "links" in raw) {
  const links = raw.links ?? [];
  if (!Array.isArray(links)) throw new Failure(`config: ${where}links must be a list`);
  links.forEach((g: unknown, i) => {
    if (!isObject(g) || typeof g.title !== "string" || !g.title || !Array.isArray(g.items)) {
      throw new Failure(`config: ${where}links[${i}] must have a title and a list of items`);
    }
    unknownKey(`${where}links[${i}].`, g, ["title", "items"]);
    g.items.forEach((item: unknown, j) => {
      if (!isObject(item) || Object.keys(item).sort().join() !== "name,url"
        || typeof item.name !== "string" || !item.name || typeof item.url !== "string" || !/^https?:\/\//.test(item.url)) {
        throw new Failure(`config: ${where}links[${i}].items[${j}] must have exactly name and an http(s) url`);
      }
    });
  });
  out.links = links;
  }

  // Clocks on the dashboard: a name and an IANA time zone each.
  if (all || "clocks" in raw) {
  const clocks = raw.clocks ?? [];
  if (!Array.isArray(clocks)) throw new Failure(`config: ${where}clocks must be a list`);
  clocks.forEach((c: unknown, i) => {
    if (!isObject(c) || Object.keys(c).sort().join() !== "name,timezone"
      || typeof c.name !== "string" || !c.name || typeof c.timezone !== "string") {
      throw new Failure(`config: ${where}clocks[${i}] must have exactly name and timezone`);
    }
    try { new Intl.DateTimeFormat("en", { timeZone: c.timezone }); } catch {
      throw new Failure(`config: ${where}clocks[${i}].timezone ${JSON.stringify(c.timezone)} is not a time zone`);
    }
  });
  out.clocks = clocks;
  }

  // Whose public holidays the dashboard lists: an ISO 3166 country code and,
  // optionally, a subdivision such as AU-NSW for its regional holidays.
  if (all || "holidays" in raw) {
  const holidays = raw.holidays ?? [];
  if (!Array.isArray(holidays)) throw new Failure(`config: ${where}holidays must be a list`);
  holidays.forEach((h: unknown, i) => {
    if (!isObject(h) || typeof h.name !== "string" || !h.name
      || typeof h.country !== "string" || !/^[A-Z]{2}$/.test(h.country)
      || (h.region !== undefined && (typeof h.region !== "string" || !h.region.startsWith(`${h.country}-`)))) {
      throw new Failure(`config: ${where}holidays[${i}] must have a name, a two-letter country and optionally a region like AU-NSW`);
    }
    unknownKey(`${where}holidays[${i}].`, h, ["name", "country", "region"]);
  });
  out.holidays = holidays;
  }

  // Exchange rates by ISO 4217 code, and quotes by Yahoo Finance symbol.
  if (all || "markets" in raw) {
  const markets = raw.markets ?? {};
  if (!isObject(markets)) throw new Failure(`config: ${where}markets must be an object`);
  unknownKey(`${where}markets.`, markets, ["rates", "quotes"]);
  const rates = markets.rates ?? [];
  const quotes = markets.quotes ?? [];
  if (!Array.isArray(rates) || !Array.isArray(quotes)) throw new Failure(`config: ${where}markets.rates and markets.quotes must be lists`);
  rates.forEach((r: unknown, i) => {
    if (!isObject(r) || Object.keys(r).sort().join() !== "base,quote"
      || typeof r.base !== "string" || !/^[A-Z]{3}$/.test(r.base)
      || typeof r.quote !== "string" || !/^[A-Z]{3}$/.test(r.quote)) {
      throw new Failure(`config: ${where}markets.rates[${i}] must have exactly base and quote, three-letter currency codes`);
    }
  });
  quotes.forEach((q: unknown, i) => {
    if (!isObject(q) || Object.keys(q).sort().join() !== "name,symbol"
      || typeof q.name !== "string" || !q.name || typeof q.symbol !== "string" || !/^[\w^.=-]{1,20}$/.test(q.symbol)) {
      throw new Failure(`config: ${where}markets.quotes[${i}] must have exactly name and a Yahoo Finance symbol`);
    }
  });
  out.markets = { rates, quotes };
  }
  return out as Partial<Dashboard>;
}

/**
 * Read and validate config.json, then apply environment overrides. An
 * unknown key or a wrong type stops the program: a misspelt key that was
 * silently ignored would look like a setting that does not work.
 */
export function loadConfig(directory = dirs.config): Config {
  const file = path.join(directory, "config.json");
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Failure(`${file} not found; mount the configuration at ${directory}`);
    }
    throw new Failure(`${file}: ${(e as Error).message}`);
  }
  if (!isObject(raw)) throw new Failure(`${file}: must be an object`);
  unknownKey("", raw, ["version", "timezone", "users", "weather", "links", "clocks", "holidays", "markets", ...Object.keys(SCHEMA)]);
  if ((raw.version ?? 1) !== 1) throw new Failure(`config: version ${JSON.stringify(raw.version)} is not supported`);

  const out: Record<string, unknown> = { version: 1 };
  const tz = raw.timezone ?? "UTC";
  check("timezone", tz, "string");
  if (!validTimezone(tz as string)) throw new Failure(`config: unknown time zone ${JSON.stringify(tz)}`);
  out.timezone = tz;

  for (const [section, keys] of Object.entries(SCHEMA)) {
    const given = raw[section] ?? {};
    if (!isObject(given)) throw new Failure(`config: ${section} must be an object`);
    unknownKey(`${section}.`, given, Object.keys(keys));
    const merged: Record<string, unknown> = {};
    for (const [key, [kind, fallback]] of Object.entries(keys)) {
      const value = key in given ? given[key] : fallback;
      check(`${section}.${key}`, value, kind);
      merged[key] = value;
    }
    out[section] = merged;
  }

  const users = raw.users;
  if (!isObject(users) || Object.keys(users).length === 0) throw new Failure("config: users must be a non-empty object");
  const settings: Record<string, UserSettings> = {};
  for (const [name, given] of Object.entries(users)) {
    if (!NAME.test(name)) throw new Failure(`config: user name ${JSON.stringify(name)} must match ${NAME.source}`);
    // The day's weather and markets sit beside each person's <user>.json.
    if (["weather", "markets", "home", "archive"].includes(name)) throw new Failure(`config: ${name} cannot be a user name`);
    const s = given ?? {};
    if (!isObject(s)) throw new Failure(`config: users.${name} must be an object`);
    unknownKey(`users.${name}.`, s, ["sections", "skip_feeds", ...DASHBOARD_KEYS]);
    for (const [key, value] of Object.entries(s)) {
      if ((DASHBOARD_KEYS as readonly string[]).includes(key)) continue;
      if (!Array.isArray(value) || !value.every((v) => typeof v === "string" && v !== "")) {
        throw new Failure(`config: users.${name}.${key} must be a list of strings`);
      }
    }
    settings[name] = {
      sections: [...(s.sections as string[] | undefined ?? [])],
      skip_feeds: [...(s.skip_feeds as string[] | undefined ?? [])],
      dashboard: {},
    };
  }
  out.users = settings;

  Object.assign(out, dashboardOf("", raw, true));
  for (const [name, given] of Object.entries(users)) {
    settings[name]!.dashboard = dashboardOf(`users.${name}.`, given as Record<string, unknown> ?? {}, false);
  }

  for (const [section, key, variable] of ENV) {
    const value = process.env[variable];
    if (value) {
      const target = out[section] as Record<string, unknown>;
      target[key] = key === "timeout" ? Number(value) : value;
      if (key === "timeout" && !Number.isInteger(target[key])) throw new Failure(`${variable} must be a whole number`);
    }
  }
  const config = out as unknown as Config;
  duration(config.pull.since);
  duration(config.pull.max_window);
  return config;
}

/** A person's dashboard: their own parts, the shared ones for the rest. */
export function dashboardFor(config: Config, user: string): Dashboard {
  const own = config.users[user]?.dashboard ?? {};
  return {
    weather: own.weather ?? config.weather, links: own.links ?? config.links, clocks: own.clocks ?? config.clocks,
    holidays: own.holidays ?? config.holidays, markets: own.markets ?? config.markets,
  };
}

/** Every place, rate and quote anyone's dashboard shows, each once: what the
 *  day's weather and markets are fetched for. */
export function everything(config: Config): { weather: Place[]; markets: MarketsConfig } {
  const all = [config.weather, ...Object.keys(config.users).map((u) => dashboardFor(config, u).weather)].flat();
  const boards = [config.markets, ...Object.keys(config.users).map((u) => dashboardFor(config, u).markets)];
  const once = <T>(xs: T[], key: (x: T) => string) => [...new Map(xs.map((x) => [key(x), x])).values()];
  return {
    weather: once(all, (p) => `${p.name}@${p.latitude},${p.longitude}`),
    markets: {
      rates: once(boards.flatMap((b) => b.rates), (r) => `${r.base}/${r.quote}`),
      quotes: once(boards.flatMap((b) => b.quotes), (q) => q.symbol),
    },
  };
}

export function userOrFail(config: Config, user: string): UserSettings {
  const settings = config.users[user];
  if (!settings) throw new Failure(`${JSON.stringify(user)} is not configured; have: ${Object.keys(config.users).join(", ")}`);
  return settings;
}

/** Configured people first, in their configured order; anyone else after. */
export function ordered(config: Config, names: Iterable<string>): string[] {
  const order = Object.keys(config.users);
  const rank = (u: string) => (order.includes(u) ? order.indexOf(u) : order.length);
  return [...new Set(names)].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}

// ---- time ------------------------------------------------------------------

/** A moment seen in a time zone: its local date and ISO time with offset. */
export interface Moment { ms: number; date: string; iso: string }

export function zoned(ms: number, timezone: string): Moment {
  ms = Math.floor(ms / 1000) * 1000;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(ms).map((p) => [p.type, p.value]),
  );
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  const offset = Math.round((Date.parse(`${date}T${time}Z`) - ms) / 60000);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return { ms, date, iso: `${date}T${time}${sign}${hh}:${mm}` };
}

export function now(config: Config): Moment {
  return zoned(Date.now(), config.timezone);
}

// ---- places in the data repository -----------------------------------------

/** `root/2026/09/27` for the date `2026-09-27`. */
export function dayDir(root: string, date: string): string {
  return path.join(root, ...date.split("-"));
}

function entries(directory: string, pattern: RegExp): string[] {
  try {
    return fs.readdirSync(directory).filter((n) => pattern.test(n)).sort();
  } catch {
    return [];
  }
}

/** Every `YYYY-MM-DD` with a directory under root, oldest first. */
export function days(root: string): string[] {
  const found: string[] = [];
  for (const y of entries(root, /^\d{4}$/)) {
    for (const m of entries(path.join(root, y), /^\d{2}$/)) {
      for (const d of entries(path.join(root, y, m), /^\d{2}$/)) {
        if (fs.statSync(path.join(root, y, m, d)).isDirectory()) found.push(`${y}-${m}-${d}`);
      }
    }
  }
  return found;
}

// ---- files -------------------------------------------------------------------

export function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw new Failure(`${file}: ${(e as Error).message}`);
  }
}

export function readText(file: string): string {
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw e;
  }
}

/** Write beside the final name and rename into place, so a reader never sees half a file. */
export function writeAtomic(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  try {
    fs.writeFileSync(tmp, text, { mode: 0o644 });
    fs.renameSync(tmp, file);
  } catch (e) {
    fs.rmSync(tmp, { force: true });
    throw e;
  }
}

export function writeJson(file: string, value: unknown, indent: number | undefined = 2): void {
  writeAtomic(file, JSON.stringify(value, null, indent) + "\n");
}

export function writeJsonl(file: string, rows: unknown[]): void {
  writeAtomic(file, rows.map((r) => JSON.stringify(r) + "\n").join(""));
}

export function readJsonl<T>(file: string): T[] {
  return fs.readFileSync(file, "utf8").split("\n").flatMap((line, i) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as T];
    } catch (e) {
      throw new Failure(`${file} line ${i + 1}: ${(e as Error).message}`);
    }
  });
}

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

// ---- article IDs (DESIGN 5.5) ------------------------------------------------

const TRACKING = /^(utm_.*|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|spm|yclid|_hsenc|_hsmi|igshid|ref_src)$/;

/** Lower-cased scheme and host, no default port, no fragment, no tracking
 * parameters, the rest sorted. A link that does not parse is kept as given. */
export function normaliseUrl(url: string): string {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return url.trim();
  }
  u.hash = "";
  const kept = [...u.searchParams].filter(([k]) => !TRACKING.test(k.toLowerCase()));
  kept.sort(([a, x], [b, y]) => (a < b ? -1 : a > b ? 1 : x < y ? -1 : x > y ? 1 : 0));
  u.search = new URLSearchParams(kept).toString();
  return u.toString();
}

export function articleId(url: string, feed = "", title = "", published = ""): string {
  const key = url ? normaliseUrl(url) : [feed, title, published].join("\n");
  return sha256(key).slice(0, 12);
}

/** The host of a link, without `www.`. */
export function site(url: string | undefined | null): string {
  try {
    const host = new URL(url ?? "").hostname.toLowerCase();
    return host.startsWith("www.") ? host.slice(4) : host;
  } catch {
    return "";
  }
}
