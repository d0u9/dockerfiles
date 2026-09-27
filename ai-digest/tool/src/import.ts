// import: convert the first version's published digests (DESIGN 11).
//
// Reads `<source>/<user>/<YYYY-MM-DD>/digest.json` and writes each day's
// digest and weather into the data repository in the current format, then
// makes one commit. It does not push; the next archive does.
//
// The old files have no pull window, no count of pulled articles and no list
// of pulled articles, so `run` stays empty and there is no `pulled.jsonl`.
// A day that already has a digest in the data repository is left alone.

import fs from "node:fs";
import path from "node:path";
import type { Article, Digest, Weather } from "../../shared/types.ts";
import { git } from "./archive.ts";
import { Failure, NAME, articleId, dayDir, dirs, log, readJson, site, writeJson } from "./common.ts";

interface OldArticle { title?: string; url?: string; feed?: string; published?: string }
interface OldPlace {
  name: string; latitude: number; longitude: number;
  temperature: number; code: number; min: number; max: number;
  tomorrow?: { code: number; min: number; max: number };
}
interface OldDigest {
  user: string;
  date: string;
  generated_at?: string;
  count?: number;
  summary?: string;
  groups?: { title: string; summary?: string; items?: (OldArticle & { note?: string })[] }[];
  highlights?: (OldArticle & { why?: string })[];
  weather?: OldPlace[];
}

export function convert(old: OldDigest): Digest {
  const articles: Record<string, Article> = {};
  const ref = (a: OldArticle): string => {
    const id = articleId(a.url ?? "", a.feed ?? "", a.title ?? "", a.published ?? "");
    articles[id] = {
      title: a.title ?? "", url: a.url ?? "", feed: a.feed ?? "",
      site: site(a.url), published: a.published ?? "",
    };
    return id;
  };
  const highlights = (old.highlights ?? []).map((h) => ({ article: ref(h), why: h.why ?? "" }));
  const sections = (old.groups ?? []).map((g) => ({
    title: g.title, summary: g.summary ?? "",
    items: (g.items ?? []).map((i) => ({ article: ref(i), note: i.note ?? "" })),
  }));
  return {
    version: 1,
    user: old.user,
    date: old.date,
    generated_at: old.generated_at ?? "",
    run: {},
    stats: { sent: old.count ?? 0, selected: Object.keys(articles).length },
    summary: old.summary ?? "",
    highlights,
    sections,
    articles,
  };
}

export function convertWeather(old: OldDigest): Weather | null {
  if (!old.weather?.length) return null;
  return {
    version: 1,
    date: old.date,
    fetched_at: old.generated_at ?? "",
    source: "open-meteo",
    places: old.weather.map((p) => ({
      name: p.name, latitude: p.latitude, longitude: p.longitude,
      now: { temperature: p.temperature, code: p.code },
      today: { code: p.code, min: p.min, max: p.max },
      tomorrow: p.tomorrow ?? null,
    })),
  };
}

export function run(source: string): void {
  if (!fs.existsSync(source) || !fs.statSync(source).isDirectory()) throw new Failure(`${source} is not a directory`);
  let written = 0;
  for (const user of fs.readdirSync(source).sort()) {
    if (!NAME.test(user) || !fs.statSync(path.join(source, user)).isDirectory()) continue;
    for (const date of fs.readdirSync(path.join(source, user)).sort()) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const old = readJson<OldDigest>(path.join(source, user, date, "digest.json"));
      const target = dayDir(dirs.data, date);
      if (!old || fs.existsSync(path.join(target, `${user}.json`))) continue;
      writeJson(path.join(target, `${user}.json`), convert(old));
      const weather = convertWeather(old);
      const weatherFile = path.join(target, "weather.json");
      if (weather && !fs.existsSync(weatherFile)) writeJson(weatherFile, weather);
      written++;
    }
  }
  if (!written) {
    log("import", "nothing to import");
    return;
  }
  git(["add", "--all", "--", "."]);
  git(["commit", "--quiet", "-m", `Import ${written} digests from the first version`]);
  log("import", `imported ${written} digests; the next archive pushes them`);
}
