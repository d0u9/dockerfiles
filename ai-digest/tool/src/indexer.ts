// index: generate the website's data from the data repository (DESIGN 9.1).
//
//     <web>/data/index.json                    people, months, the latest weather, links, clocks, holidays
//     <web>/data/months/YYYY-MM.json           each day of the month
//     <web>/data/days/YYYY/MM/DD/<user>.json   the digests, copied
//
// By default only the latest month is rebuilt; `--all` rebuilds every month.

import fs from "node:fs";
import path from "node:path";
import type { Digest, Month, SiteIndex, Weather } from "../../shared/types.ts";
import { type Config, dayDir, days, dirs, log, now, ordered, readJson, writeJson } from "./common.ts";

function dayEntry(config: Config, date: string): Month["days"][number] {
  const directory = dayDir(dirs.data, date);
  const weather = readJson<Weather>(path.join(directory, "weather.json"));
  const names = fs.readdirSync(directory)
    .filter((n) => n.endsWith(".json") && n !== "weather.json")
    .map((n) => n.slice(0, -".json".length));
  const digests: Month["days"][number]["digests"] = {};
  for (const user of ordered(config, names)) {
    const d = readJson<Digest>(path.join(directory, `${user}.json`))!;
    const first = d.highlights[0];
    digests[user] = {
      selected: Object.keys(d.articles).length,
      summary: d.summary,
      top: first ? d.articles[first.article]?.title ?? "" : "",
    };
  }
  return {
    date,
    weather: weather ? weather.places.map((p) => ({ name: p.name, ...p.today })) : [],
    digests,
  };
}

function buildMonth(config: Config, month: string, dates: string[]): Month {
  const entries = [...dates].sort().reverse().map((d) => dayEntry(config, d));
  return {
    version: 1, month,
    users: ordered(config, entries.flatMap((e) => Object.keys(e.digests))),
    days: entries,
  };
}

function copyDays(dates: string[]): void {
  for (const date of dates) {
    const source = dayDir(dirs.data, date);
    const target = dayDir(path.join(dirs.web, "data", "days"), date);
    fs.mkdirSync(target, { recursive: true });
    for (const name of fs.readdirSync(source).filter((n) => n.endsWith(".json"))) {
      // Copy to a temporary name first: a browser never reads half a file.
      const tmp = path.join(target, `.${name}.tmp`);
      fs.copyFileSync(path.join(source, name), tmp);
      fs.chmodSync(tmp, 0o644);
      fs.renameSync(tmp, path.join(target, name));
    }
  }
}

export function run(config: Config, rebuildAll = false): void {
  const allDays = days(dirs.data);
  const byMonth = new Map<string, string[]>();
  for (const date of allDays) {
    const month = date.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), date]);
  }
  const months = [...byMonth.keys()].sort().reverse();
  const rebuild = new Set(rebuildAll ? months : months.slice(0, 1));

  const data = path.join(dirs.web, "data");
  const summaries: SiteIndex["months"] = [];
  for (const month of months) {
    const file = path.join(data, "months", `${month}.json`);
    let built = rebuild.has(month) ? null : readJson<Month>(file);
    if (!built) {
      copyDays(byMonth.get(month)!);
      built = buildMonth(config, month, byMonth.get(month)!);
      writeJson(file, built, undefined);
    }
    summaries.push({ month, days: built.days.length, users: built.users });
  }

  let weather: Weather | null = null;
  for (const date of [...allDays].reverse()) {
    weather = readJson<Weather>(path.join(dayDir(dirs.data, date), "weather.json"));
    if (weather) break;
  }
  const index: SiteIndex = {
    version: 1,
    generated_at: now(config).iso,
    users: ordered(config, [...Object.keys(config.users), ...summaries.flatMap((s) => s.users)]),
    months: summaries,
    latest: { date: allDays.at(-1) ?? null, weather },
    links: config.links,
    clocks: config.clocks,
    holidays: config.holidays,
  };
  writeJson(path.join(data, "index.json"), index, undefined);
  log("index", `${months.length} months, rebuilt ${rebuild.size}`);
}
