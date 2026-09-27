// The data formats, shared by the tool that writes them and the website that
// reads them. See DESIGN.md section 5 (data repository) and 9.1 (website).
// Types only: both sides import this with `import type`, so nothing here
// exists at run time.

/** Metadata of one article. No body is ever stored. */
export interface Article {
  title: string;
  url: string;
  feed: string;
  site: string;
  published: string;
}

/** One line of `<user>.pulled.jsonl` (5.4). */
export interface PulledArticle extends Article {
  article: string;
  author: string;
  status: "selected" | "dropped" | "skipped";
}

export interface Window {
  from: string;
  to: string;
}

/** `<user>.json` (5.2). */
export interface Digest {
  version: 1;
  user: string;
  date: string;
  generated_at: string;
  /** Empty for digests imported from the first version. */
  run: {
    tool?: string;
    model?: string | null;
    reasoning_effort?: string | null;
    prompt_sha256?: string;
    window?: Window;
  };
  stats: { pulled?: number; skipped?: number; sent: number; selected: number };
  summary: string;
  highlights: { article: string; why: string }[];
  sections: {
    title: string;
    summary: string;
    items: { article: string; note: string }[];
  }[];
  articles: Record<string, Article>;
}

export interface DailyWeather {
  code: number;
  min: number;
  max: number;
}

/** `weather.json` (5.3). `code` is the WMO weather code. */
export interface Weather {
  version: 1;
  date: string;
  fetched_at: string;
  source: "open-meteo";
  places: {
    name: string;
    latitude: number;
    longitude: number;
    now: { temperature: number; code: number };
    today: DailyWeather;
    tomorrow: DailyWeather | null;
  }[];
}

/** `data/index.json` on the website (9.1). */
export interface SiteIndex {
  version: 1;
  generated_at: string;
  users: string[];
  months: { month: string; days: number; users: string[] }[];
  latest: { date: string | null; weather: Weather | null };
  links: LinkGroup[];
  clocks: Clock[];
  holidays: HolidayRegion[];
}

/** `data/months/YYYY-MM.json` on the website (9.1). */
export interface Month {
  version: 1;
  month: string;
  users: string[];
  days: {
    date: string;
    weather: ({ name: string } & DailyWeather)[];
    digests: Record<string, { selected: number; summary: string; top: string }>;
  }[];
}


/** A group of links on the dashboard, from the configuration's `links`. */
export interface LinkGroup {
  title: string;
  items: { name: string; url: string }[];
}

/** A clock on the dashboard, from the configuration's `clocks`. */
export interface Clock {
  name: string;
  timezone: string;
}

/** Whose public holidays the dashboard lists, from `holidays`. */
export interface HolidayRegion {
  name: string;
  country: string;
  region?: string;
}
