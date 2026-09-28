// pull: fetch one person's articles from FreshRSS into the spool.
//
// Writes two files:
//
//     spool/<user>.articles.jsonl   one line per article, body as plain text
//     spool/<user>.window.json      the pull window and the counts
//
// Articles from skipped feeds are kept, marked "skipped" and with no text, so
// the data repository records that they arrived. Everything else is "sent":
// digest hands it to codex.
//
// The password is read from /secrets/freshrss/<user>, never from an argument
// or the environment: arguments are visible to every user on the machine.

import path from "node:path";
import { decodeHTML } from "entities";
import { Parser } from "htmlparser2";
import type { Digest, Window } from "../../shared/types.ts";
import {
  type Config, Failure, articleId, dayDir, days, dirs, duration, log, now, readJson, readText,
  site, userOrFail, writeJson, writeJsonl, zoned,
} from "./common.ts";

const READING_LIST = "user/-/state/com.google/reading-list";
const READ_STATE = "user/-/state/com.google/read";
const PAGE = 1000;

/** An article as pull hands it to digest: metadata plus the body as text. */
export interface Spooled {
  article: string;
  title: string;
  url: string;
  feed: string;
  site: string;
  published: string;
  author: string;
  text: string;
  status: "sent" | "skipped";
}

export interface SpooledWindow extends Window {
  pulled: number;
  skipped: number;
}

/** What the Google Reader API returns for one item; only the fields used. */
export interface Item {
  title?: string;
  published?: number;
  author?: string;
  canonical?: { href?: string }[];
  alternate?: { href?: string }[];
  origin?: { title?: string; htmlUrl?: string };
  content?: { content?: string };
  summary?: { content?: string };
}

const SKIP_TAGS = new Set(["script", "style", "noscript", "template"]);
const BLOCK_TAGS = new Set([
  "p", "div", "br", "li", "ul", "ol", "tr", "table", "section", "article", "blockquote",
  "pre", "h1", "h2", "h3", "h4", "h5", "h6", "figure", "figcaption", "hr",
]);

/** HTML to plain text: block elements become line breaks, scripts and styles
 * are dropped, and every other tag is removed with its text kept. */
export function toText(fragment: string): string {
  const parts: string[] = [];
  let skipping = 0;
  const parser = new Parser({
    onopentagname(name) {
      if (SKIP_TAGS.has(name)) skipping++;
      else if (BLOCK_TAGS.has(name)) parts.push("\n");
    },
    onclosetag(name) {
      if (SKIP_TAGS.has(name)) skipping = Math.max(0, skipping - 1);
      else if (BLOCK_TAGS.has(name)) parts.push("\n");
    },
    ontext(text) {
      if (!skipping) parts.push(text);
    },
  }, { decodeEntities: true });
  parser.write(fragment);
  parser.end();
  const lines = parts.join("").split("\n").map((l) => l.replace(/[ \t\r\f\v ]+/g, " ").trim());
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

class Client {
  private readonly api: string;
  private readonly timeout: number;
  private token = "";

  constructor(base: string, timeout: number) {
    this.api = base.replace(/\/+$/, "") + "/api/greader.php";
    this.timeout = timeout;
  }

  private async open(url: string, init: RequestInit = {}): Promise<string> {
    const where = url.split("?")[0];
    let response: Response;
    try {
      response = await fetch(url, { ...init, signal: AbortSignal.timeout(this.timeout * 1000) });
    } catch (e) {
      throw new Failure(`${where}: ${(e as Error).cause ?? (e as Error).message}`);
    }
    const body = await response.text();
    if (!response.ok) throw new Failure(`${where}: HTTP ${response.status} ${body.trim().slice(0, 200)}`);
    return body;
  }

  async login(user: string, password: string): Promise<void> {
    const body = await this.open(this.api + "/accounts/ClientLogin", {
      method: "POST",
      body: new URLSearchParams({ Email: user, Passwd: password }),
    });
    const line = body.split("\n").find((l) => l.startsWith("Auth="));
    if (!line) throw new Failure("FreshRSS login returned no Auth token");
    this.token = line.slice("Auth=".length);
  }

  /** Every item FreshRSS stored after `since` (epoch seconds), oldest first. */
  async *items(since: number, unreadOnly: boolean): AsyncGenerator<Item> {
    const params = new URLSearchParams({ output: "json", n: String(PAGE), ot: String(since), r: "o" });
    if (unreadOnly) params.set("xt", READ_STATE);
    const url = `${this.api}/reader/api/0/stream/contents/${encodeURIComponent(READING_LIST).replaceAll("%2F", "/")}`;
    for (;;) {
      const page = JSON.parse(await this.open(`${url}?${params}`, {
        headers: { Authorization: `GoogleLogin auth=${this.token}` },
      })) as { items?: Item[]; continuation?: string };
      yield* page.items ?? [];
      if (!page.continuation) return;
      params.set("c", page.continuation);
    }
  }
}

function firstHref(item: Item): string {
  for (const links of [item.canonical, item.alternate]) {
    const href = links?.find((l) => l.href)?.href;
    if (href) return href;
  }
  return "";
}

export function record(item: Item, maxChars: number): Omit<Spooled, "status"> {
  const url = firstHref(item);
  const feed = decodeHTML(item.origin?.title ?? "");
  const title = decodeHTML(item.title ?? "");
  const published = item.published ? new Date(item.published * 1000).toISOString() : "";
  let text = toText((item.content ?? item.summary)?.content ?? "");
  if (maxChars && text.length > maxChars) text = text.slice(0, maxChars).trimEnd() + " …";
  return {
    article: articleId(url, feed, title, published),
    title, url, feed,
    site: site(url) || site(item.origin?.htmlUrl),
    published,
    author: item.author ?? "",
    text,
  };
}

/**
 * Whether an article comes from a skipped feed or a skipped site. An entry is
 * a feed's exact title, or a domain: every article whose link or whose feed's
 * site is on that domain or under it, whatever the feed is called -- one entry
 * for all of a site's feeds.
 */
export function isSkipped(item: Item, article: { feed: string; url: string }, skip: string[]): boolean {
  if (skip.includes(article.feed)) return true;
  const hosts = [site(article.url), site(item.origin?.htmlUrl)].filter(Boolean);
  const domains = skip.filter((e) => e.includes(".") && !e.includes(" ")).map((e) => e.toLowerCase());
  return hosts.some((h) => domains.some((d) => h === d || h.endsWith("." + d)));
}

/**
 * The pull window for this run (DESIGN 8.2), in epoch milliseconds. Starts
 * where the person's previous digest ended, or where today's started when
 * today already has one; with no previous digest, `since` before now. Never
 * further back than `max_window`.
 */
export function pullWindow(config: Config, user: string, dataDir: string, nowMs: number, today: string): number {
  let start: number | null = null;
  for (const day of days(dataDir).reverse()) {
    const span = readJson<Digest>(path.join(dayDir(dataDir, day), `${user}.json`))?.run?.window;
    if (!span?.to) continue;
    start = Date.parse(day === today ? span.from : span.to);
    break;
  }
  start ??= nowMs - duration(config.pull.since);
  return Math.max(start, nowMs - duration(config.pull.max_window));
}

function readPassword(user: string): string {
  const file = path.join(dirs.secrets, "freshrss", user);
  const password = readText(file);
  if (!password) throw new Failure(`${file} is missing or empty; mount each person's FreshRSS password there`);
  return password;
}

export interface Source {
  login(user: string, password: string): Promise<void>;
  items(since: number, unreadOnly: boolean): AsyncIterable<Item>;
}

export async function run(config: Config, user: string, source?: Source): Promise<void> {
  const settings = userOrFail(config, user);
  if (!config.freshrss.url && !source) throw new Failure("config: freshrss.url is not set");
  const moment = now(config);
  const start = pullWindow(config, user, dirs.data, moment.ms, moment.date);
  const from = zoned(start, config.timezone).iso;

  const client = source ?? new Client(config.freshrss.url!, config.freshrss.timeout);
  await client.login(user, readPassword(user));
  const rows: Spooled[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  for await (const item of client.items(Math.floor(start / 1000), config.pull.unread_only)) {
    const article = record(item, config.pull.max_chars);
    // The same link from two feeds is one article.
    if (seen.has(article.article)) continue;
    seen.add(article.article);
    if (isSkipped(item, article, settings.skip_feeds)) {
      rows.push({ ...article, text: "", status: "skipped" });
      skipped++;
    } else {
      rows.push({ ...article, status: "sent" });
    }
  }

  writeJsonl(path.join(dirs.spool, `${user}.articles.jsonl`), rows);
  const span: SpooledWindow = { from, to: moment.iso, pulled: rows.length, skipped };
  writeJson(path.join(dirs.spool, `${user}.window.json`), span);
  log("pull", `${user}: ${rows.length} articles from ${from}, ${skipped} from skipped feeds`);
}
