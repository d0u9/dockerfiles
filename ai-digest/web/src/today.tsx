// The dashboard's cards about the day itself rather than the news: clocks,
// the calendar with holidays, and the weather. Everything live here is
// fetched by the browser from public services; nothing is stored.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Clock, HolidayRegion, Weather } from "../../shared/types.ts";
import { SkyIcon, sky, useLiveWeather } from "./weather.tsx";
import { Fold } from "./ui.tsx";

/** The current time, updated at the start of every minute. */
function useMinute(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(new Date());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    return () => clearTimeout(timer);
  }, []);
  return now;
}

/** Wall-clock fields of `at` in a time zone. */
function wall(at: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(at);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { date: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`, hour: get("hour"), minute: get("minute") };
}

const NUMERALS = Array.from({ length: 12 }, (_, i) => i + 1);

/** One analogue face, hour and minute hands only; dark from 18:00 to 6:00. */
function Face({ hour, minute }: { hour: number; minute: number }) {
  const night = hour < 6 || hour >= 18;
  const hourAngle = ((hour % 12) + minute / 60) * 30;
  const minuteAngle = minute * 6;
  return (
    <svg className={`clock-face${night ? " night" : ""}`} viewBox="0 0 100 100" role="img" aria-label={`${hour}:${String(minute).padStart(2, "0")}`}>
      <circle cx="50" cy="50" r="49" className="clock-dial" />
      {Array.from({ length: 60 }, (_, i) => (
        <line key={i} x1="50" y1="3.5" x2="50" y2={i % 5 ? 5.5 : 7} className={i % 5 ? "tick" : "tick hour"} transform={`rotate(${i * 6} 50 50)`} />
      ))}
      {NUMERALS.map((n) => {
        const a = (n * 30 * Math.PI) / 180;
        return <text key={n} x={50 + 34 * Math.sin(a)} y={50 - 34 * Math.cos(a)} className="numeral">{n}</text>;
      })}
      <g transform={`rotate(${hourAngle} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="44" className="hand-neck" />
        <line x1="50" y1="44" x2="50" y2="25" className="hand" />
      </g>
      <g transform={`rotate(${minuteAngle} 50 50)`}>
        <line x1="50" y1="50" x2="50" y2="44" className="hand-neck" />
        <line x1="50" y1="44" x2="50" y2="10" className="hand" />
      </g>
      <circle cx="50" cy="50" r="2.4" className="pin" />
    </svg>
  );
}

/** The same time as digits on a square face, dark at night like the dial. */
function Digits({ hour, minute }: { hour: number; minute: number }) {
  const night = hour < 6 || hour >= 18;
  const text = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return (
    <svg className={`clock-face clock-square${night ? " night" : ""}`} viewBox="0 0 100 100" role="img" aria-label={text}>
      <rect x="1" y="1" width="98" height="98" rx="22" className="clock-dial" />
      <text x="50" y="52" className="clock-digits">{text}</text>
      <text x="50" y="74" className="clock-ampm">{hour < 12 ? "上午" : "下午"}</text>
    </svg>
  );
}

/** Offset of a time zone from this browser's, as "+3 小时", "明天 +3 小时" or "本地". */
function relative(at: Date, timeZone: string): string {
  const here = wall(at, Intl.DateTimeFormat().resolvedOptions().timeZone);
  const there = wall(at, timeZone);
  const minutes = (Date.parse(`${there.date}T00:00Z`) - Date.parse(`${here.date}T00:00Z`)) / 60_000
    + (there.hour - here.hour) * 60 + (there.minute - here.minute);
  const day = there.date === here.date ? "" : there.date > here.date ? "明天 " : "昨天 ";
  if (!minutes) return "本地";
  const h = minutes / 60;
  return `${day}${h > 0 ? "+" : "−"}${Math.abs(h)} 小时`;
}

/** Hands or digits, remembered in this browser only. */
const CLOCK_STYLE = "ai-digest.clock-style";

export function Clocks({ clocks }: { clocks: Clock[] }) {
  const now = useMinute();
  const [digital, setDigital] = useState(() => {
    try { return localStorage.getItem(CLOCK_STYLE) === "digital"; } catch { return false; }
  });
  const toggle = () => {
    setDigital(!digital);
    try { localStorage.setItem(CLOCK_STYLE, digital ? "analog" : "digital"); } catch { /* storage blocked */ }
  };
  return (
    <>
      <div className="card-head">
        <h2>时钟</h2>
        <button type="button" className="seg" onClick={toggle} aria-label={digital ? "改用指针" : "改用数字"}>
          <span aria-current={!digital || undefined}>指针</span><span aria-current={digital || undefined}>数字</span>
        </button>
      </div>
      <div className="clocks">
        {clocks.map((c) => {
          const w = wall(now, c.timezone);
          return (
            <figure className="clock" key={`${c.name}@${c.timezone}`}>
              {digital ? <Digits hour={w.hour} minute={w.minute} /> : <Face hour={w.hour} minute={w.minute} />}
              <figcaption>
                <strong>{c.name}</strong>
                <span className="muted">{relative(now, c.timezone)}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </>
  );
}

// ---- calendar -----------------------------------------------------------------

const LUNAR_DAYS = ["初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

const LUNAR = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", month: "long", day: "numeric" });

/** The Chinese calendar's year name, month and day for a date. */
function lunarParts(at: Date): { year: string; month: string; day: string; first: boolean } {
  const parts = LUNAR.formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const n = Number(get("day"));
  return { year: `${get("yearName")}年`, month: get("month"), day: LUNAR_DAYS[n - 1] ?? get("day"), first: n === 1 };
}


// The 24 solar terms from 小寒, two a month. Their day in the 21st century is
// floor(Y × 0.2422 + C) − floor(L), Y the last two digits of the year and L
// the leap years before it; the formula can be a day off in a few years.
const TERMS: [string, number][] = [
  ["小寒", 5.4055], ["大寒", 20.12], ["立春", 3.87], ["雨水", 18.73], ["惊蛰", 5.63], ["春分", 20.646],
  ["清明", 4.81], ["谷雨", 20.1], ["立夏", 5.52], ["小满", 21.04], ["芒种", 5.678], ["夏至", 21.37],
  ["小暑", 7.108], ["大暑", 22.83], ["立秋", 7.5], ["处暑", 23.13], ["白露", 7.646], ["秋分", 23.042],
  ["寒露", 8.318], ["霜降", 23.438], ["立冬", 7.438], ["小雪", 22.36], ["大雪", 7.18], ["冬至", 21.94],
];

function terms(year: number): { name: string; date: string }[] {
  const y = year % 100;
  return TERMS.map(([name, c], i) => {
    const leaps = Math.floor((i < 4 ? y - 1 : y) / 4);
    const day = Math.floor(y * 0.2422 + c) - leaps;
    return { name, date: `${year}-${String(Math.floor(i / 2) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
  });
}

const iso = (d: Date) => [d.getFullYear(), d.getMonth() + 1, d.getDate()].map((n, i) => String(n).padStart(i ? 2 : 4, "0")).join("-");
const daysUntil = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const md = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
const inDays = (n: number) => (n === 0 ? "今天" : n === 1 ? "明天" : `${n} 天后`);

interface Holiday { date: string; name: string; region: string; until?: string; work?: boolean }

type NagerList = { date: string; localName: string; global: boolean; counties: string[] | null }[];
type HolidayCn = { days: { name: string; date: string; isOffDay: boolean }[] };

/**
 * China's arrangement from the State Council's yearly notice, as collected by
 * holiday-cn: each holiday as the whole run of days off, and the weekends
 * worked in exchange (调休). Null when the year is not published yet.
 */
function chinaYear(body: HolidayCn, region: string): Holiday[] {
  const out: Holiday[] = [];
  for (const d of [...body.days].sort((a, b) => a.date.localeCompare(b.date))) {
    const last = out.at(-1);
    if (d.isOffDay && last && !last.work && last.name === d.name && daysUntil(last.until ?? last.date, d.date) === 1) {
      last.until = d.date;
    } else if (d.isOffDay) {
      out.push({ date: d.date, name: d.name, region });
    } else {
      out.push({ date: d.date, name: `${d.name}调休`, region, work: true });
    }
  }
  return out;
}

/** Public holidays for the years either side of this one: China's from holiday-cn, with
 *  its make-up working days, everyone else's from Nager.Date. */
function useHolidays(regions: HolidayRegion[], year: number): Holiday[] | null {
  const [found, setFound] = useState<Holiday[] | null>(null);
  useEffect(() => {
    if (!regions.length) return;
    const controller = new AbortController();
    const get = <T,>(url: string) => fetch(url, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() as Promise<T> : Promise.reject(new Error(String(res.status)))));
    const nager = (r: HolidayRegion, y: number) =>
      get<NagerList>(`https://date.nager.at/api/v3/PublicHolidays/${y}/${r.country}`)
        .then((list) => list.filter((h) => h.global || (r.region && h.counties?.includes(r.region)))
          .map((h) => ({ date: h.date, name: h.localName, region: r.name })))
        .catch(() => [] as Holiday[]);
    const one = (r: HolidayRegion, y: number) => r.country === "CN"
      ? get<HolidayCn>(`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${y}.json`)
        .then((body) => chinaYear(body, r.name), () => nager(r, y))
      : nager(r, y);
    Promise.all(regions.flatMap((r) => [one(r, year - 1), one(r, year), one(r, year + 1)]))
      .then((lists) => setFound(lists.flat().sort((a, b) => a.date.localeCompare(b.date))))
      .catch(() => {});
    return () => controller.abort();
  }, [regions, year]);
  return found;
}

const WEEK = ["一", "二", "三", "四", "五", "六", "日"];
const localDate = (date: string) => new Date(`${date}T12:00:00`);

/** The holidays on each day: a run of days off counts on every day of it. */
function byDay(holidays: Holiday[]): Map<string, Holiday[]> {
  const out = new Map<string, Holiday[]>();
  for (const h of holidays) {
    for (let d = h.date; d <= (h.until ?? h.date); d = iso(new Date(localDate(d).getTime() + 86_400_000))) {
      out.set(d, [...(out.get(d) ?? []), h]);
    }
  }
  return out;
}

/** A month as Apple's calendar lays it out: six weeks from Monday, each day
 *  with its lunar day, or the solar term or holiday that falls on it. */
function MonthGrid({ month, today, selected, onSelect, days, termOn }: {
  month: string; today: string; selected: string; onSelect: (date: string) => void;
  days: Map<string, Holiday[]>; termOn: Map<string, string>;
}) {
  const first = localDate(`${month}-01`);
  const start = new Date(first.getTime() - ((first.getDay() + 6) % 7) * 86_400_000);
  const cells = Array.from({ length: 42 }, (_, i) => iso(new Date(start.getTime() + i * 86_400_000)));
  // Drop a last week that lies wholly in the next month.
  const shown = cells.slice(35).every((d) => !d.startsWith(month)) ? cells.slice(0, 35) : cells;
  return (
    <div className="cal-grid" role="grid" aria-label={`${Number(month.slice(0, 4))}年${Number(month.slice(5))}月`}>
      {WEEK.map((w, i) => <div key={w} className={`cal-wd${i > 4 ? " cal-weekend" : ""}`} role="columnheader">{w}</div>)}
      {shown.map((d, i) => {
        const l = lunarParts(localDate(d));
        const hs = days.get(d) ?? [];
        const off = hs.some((h) => !h.work), work = hs.some((h) => h.work);
        // What the small line says, most telling first.
        const festival = hs.find((h) => !h.work && h.date === d);
        const label = festival?.name ?? termOn.get(d) ?? (l.first ? l.month : l.day);
        const cls = ["cal-day",
          d.startsWith(month) ? "" : "cal-out",
          i % 7 > 4 ? "cal-weekend" : "",
          d === today ? "is-today" : "",
          d === selected ? "is-selected" : "",
          festival || termOn.has(d) || l.first ? "cal-marked" : ""].filter(Boolean).join(" ");
        return (
          <button key={d} type="button" className={cls} role="gridcell" aria-selected={d === selected}
            aria-label={`${md(d)} 农历${l.month}${l.day}${hs.map((h) => ` ${h.name}`).join("")}`} onClick={() => onSelect(d)}>
            <span className="cal-num">{Number(d.slice(8))}</span>
            <span className="cal-sub">{label}</span>
            {(off || work) && <span className={`cal-badge${work ? " work" : ""}`}>{work ? "班" : "休"}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function CalendarCard({ regions }: { regions: HolidayRegion[] }) {
  const now = useMinute();
  const today = iso(now);
  const year = now.getFullYear();
  const holidays = useHolidays(regions, year);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const allTerms = [year - 1, year, year + 1].flatMap(terms);
  const termOn = new Map(allTerms.map((t) => [t.date, t.name]));
  const term = allTerms.find((t) => t.date >= today)!;
  const days = byDay(holidays ?? []);
  const move = (by: number) => {
    const d = localDate(`${month}-01`);
    d.setMonth(d.getMonth() + by);
    setMonth(iso(d).slice(0, 7));
  };
  const pick = (date: string) => { setSelected(date); if (!date.startsWith(month)) setMonth(date.slice(0, 7)); };
  const sel = lunarParts(localDate(selected));
  const selHolidays = days.get(selected) ?? [];
  // The next few, each region's first ones rather than one region's many.
  const upcoming = (holidays ?? []).filter((h) => (h.until ?? h.date) >= today)
    .filter((h, i, all) => all.slice(0, i).filter((o) => o.region === h.region).length < 2)
    .slice(0, 4);
  const lunarToday = lunarParts(localDate(today));
  const next = upcoming.find((h) => h.date > today);
  const summary = (
    <span className="fold-cal">
      <span className="fold-day" aria-hidden="true">{Number(today.slice(8))}</span>
      <span className="fold-lines">
        <strong>{md(today)} 周{WEEK[(localDate(today).getDay() + 6) % 7]}</strong>
        <span className="muted">
          农历{lunarToday.month}{lunarToday.day}
          {termOn.has(today) ? ` · ${termOn.get(today)}` : ` · ${term.name} ${inDays(daysUntil(today, term.date))}`}
          {next && ` · ${next.name} ${inDays(daysUntil(today, next.date))}`}
        </span>
      </span>
    </span>
  );
  return (
    <Fold title="日历" summary={summary}>
      <div className="card-head"><h2>日历</h2></div>
      <div className="cal-month-head">
        <strong>{Number(month.slice(0, 4))}年{Number(month.slice(5))}月</strong>
        <span className="cal-nav">
          <button type="button" onClick={() => move(-1)} aria-label="上个月">‹</button>
          <button type="button" onClick={() => { setMonth(today.slice(0, 7)); setSelected(today); }}
            disabled={month === today.slice(0, 7) && selected === today}>今天</button>
          <button type="button" onClick={() => move(1)} aria-label="下个月">›</button>
        </span>
      </div>
      <MonthGrid month={month} today={today} selected={selected} onSelect={pick} days={days} termOn={termOn} />
      <div className="cal-detail" aria-live="polite">
        <div>
          <strong>{md(selected)} 周{WEEK[(localDate(selected).getDay() + 6) % 7]}</strong>
          <span className="muted"> {selected === today ? "今天" : selected > today ? inDays(daysUntil(today, selected)) : `${daysUntil(selected, today)} 天前`}</span>
        </div>
        <div className="muted">
          农历 {sel.year} {sel.month}{sel.day}
          {termOn.has(selected) ? <> · <span className="cal-term">{termOn.get(selected)}</span></>
            : selected === today && <> · 下一个节气 {term.name} {md(term.date)}（{inDays(daysUntil(today, term.date))}）</>}
        </div>
        {selHolidays.map((h) => (
          <div key={`${h.region}${h.name}`}>
            <span className="muted">{h.region}</span> {h.name}
            <span className={`cal-badge inline${h.work ? " work" : ""}`}>{h.work ? "上班" : "放假"}</span>
          </div>
        ))}
      </div>
      {regions.length > 0 && (
        <ul className="link-list cal-holidays">
          {holidays === null && <li className="muted">假期加载中…</li>}
          {upcoming.map((h) => (
            <li key={`${h.region}${h.date}${h.name}`} className={h.date <= today ? "cal-today" : undefined}>
              <span className="muted">{h.region}</span> {h.name}{h.work && <span className="cal-work">班</span>}
              <span className="muted cal-when">
                {md(h.date)}{h.until && `–${h.until.slice(5, 7) === h.date.slice(5, 7) ? `${Number(h.until.slice(8))}日` : md(h.until)}`}
                {" · "}{h.date <= today ? "今天" : inDays(daysUntil(today, h.date))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Fold>
  );
}

// ---- weather --------------------------------------------------------------------

interface Detail {
  hours: { time: string; temperature: number; rain: number }[];
  sunrise: string;
  sunset: string;
  uv: number;
  uvMax: number;
  aqi: number | null;
  pm25: number | null;
}

/** The next 24 hours, sun, UV and air quality for one place, from Open-Meteo. */
const details = new Map<string, Detail>();

function useDetail(latitude: number, longitude: number): Detail | null {
  // Keyed by place, so a place opened again shows at once, and another
  // place's figures never stand in while this one loads.
  const key = `${latitude},${longitude}`;
  const [, setLoaded] = useState(0);
  useEffect(() => {
    if (details.has(key)) return;
    const where = { latitude: String(latitude), longitude: String(longitude), timezone: "auto" };
    const forecast = new URLSearchParams({
      ...where, hourly: "temperature_2m,precipitation_probability,uv_index",
      daily: "sunrise,sunset,uv_index_max", forecast_days: "2",
    });
    const air = new URLSearchParams({ ...where, current: "us_aqi,pm2_5" });
    const controller = new AbortController();
    const get = (url: string) => fetch(url, { signal: controller.signal }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
    Promise.all([
      get(`https://api.open-meteo.com/v1/forecast?${forecast}`),
      get(`https://air-quality-api.open-meteo.com/v1/air-quality?${air}`).catch(() => null),
    ]).then(([f, a]) => {
      // Hourly times are the place's wall clock; start at the current hour there.
      const hereNow = new Date(Date.now() + f.utc_offset_seconds * 1000).toISOString().slice(0, 13);
      const start = Math.max(0, (f.hourly.time as string[]).findIndex((t) => t.slice(0, 13) === hereNow));
      const hours = (f.hourly.time as string[]).slice(start, start + 25).map((time, i) => ({
        time, temperature: f.hourly.temperature_2m[start + i], rain: f.hourly.precipitation_probability[start + i] ?? 0,
      }));
      details.set(key, {
        hours,
        sunrise: f.daily.sunrise[0], sunset: f.daily.sunset[0],
        uv: f.hourly.uv_index[start] ?? 0, uvMax: f.daily.uv_index_max[0] ?? 0,
        aqi: a?.current?.us_aqi ?? null, pm25: a?.current?.pm2_5 ?? null,
      });
      setLoaded((n) => n + 1);
    }).catch(() => {});
    return () => controller.abort();
  }, [key, latitude, longitude]);
  return details.get(key) ?? null;
}

/**
 * Temperature as a line, the chance of rain as bars beneath it. Drawn at the
 * width it is given, in pixels, so the line spans the card at any zoom
 * instead of a fixed shape shrinking into the middle of it.
 */
function HourlyChart({ hours }: { hours: Detail["hours"] }) {
  const ref = useRef<SVGSVGElement>(null);
  const [W, setW] = useState(300);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => { if (entry) setW(Math.max(120, entry.contentRect.width)); });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const H = 90, top = 14, bottom = 16, pad = 12;
  const temps = hours.map((h) => h.temperature);
  const lo = Math.min(...temps), hi = Math.max(...temps);
  const x = (i: number) => pad + (i / (hours.length - 1)) * (W - 2 * pad);
  const y = (t: number) => top + (1 - (t - lo) / (hi - lo || 1)) * (H - top - bottom - 10);
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(h.temperature).toFixed(1)}`).join("");
  return (
    <svg ref={ref} className="hourly" viewBox={`0 -2 ${W} ${H + 2}`} role="img" aria-label="未来 24 小时气温和降水概率">
      {hours.map((h, i) => h.rain > 0 && (
        <rect key={h.time} className="rain" x={x(i) - 3} width="6" y={H - bottom - (h.rain / 100) * 26} height={(h.rain / 100) * 26} />
      ))}
      <path d={line} className="temp-line" />
      {hours.map((h, i) => i % 3 === 0 && (
        <g key={h.time}>
          <text x={x(i)} y={y(h.temperature) - 4} className="t-label">{Math.round(h.temperature)}°</text>
          <text x={x(i)} y={H - 2} className="h-label">{i === 0 ? "现在" : h.time.slice(11, 13)}</text>
        </g>
      ))}
    </svg>
  );
}

const hhmm = (t: string) => t.slice(11, 16);

function aqiText(aqi: number): string {
  return aqi <= 50 ? "优" : aqi <= 100 ? "良" : aqi <= 150 ? "轻度污染" : aqi <= 200 ? "中度污染" : aqi <= 300 ? "重度污染" : "严重污染";
}

function uvText(uv: number): string {
  return uv < 3 ? "低" : uv < 6 ? "中" : uv < 8 ? "高" : uv < 11 ? "很高" : "极高";
}

/**
 * One card for all the weather: the first configured place is here, with its
 * next 24 hours, sun, UV and air; the others get a row each with the sky and
 * the day's low and high. Clicking a row opens that place in its stead.
 */
export function WeatherCard({ saved }: { saved: Weather }) {
  const { weather, live } = useLiveWeather(saved);
  const [open, setOpen] = useState(0);
  const place = weather.places[open] ?? weather.places[0]!;
  const detail = useDetail(place.latitude, place.longitude);
  const list = useRef<HTMLUListElement>(null);
  // Keep the open place whole in view, with the rows either side of it, so
  // the next one to click is always there.
  useLayoutEffect(() => {
    const ul = list.current, box = ul?.closest(".scroller-body");
    if (!ul || !box) return;
    const rows = [...ul.children] as HTMLElement[];
    const first = rows[Math.max(0, open - 1)]!, last = rows[Math.min(rows.length - 1, open + 1)]!;
    // Offsets rather than client rectangles, which the dashboard's zoom scales.
    // Past the last row shown, room for the card's fade, so that row is clear.
    const fade = last === rows.at(-1) ? 0 : 28;
    // Above the first, the card's head, which stays over what scrolls.
    const head = (box.querySelector(":scope > .card-head") as HTMLElement | null)?.offsetHeight ?? 0;
    const top = first.offsetTop - head, bottom = last.offsetTop + last.offsetHeight + fade;
    if (top < box.scrollTop) box.scrollTop = Math.max(0, top);
    else if (bottom > box.scrollTop + box.clientHeight) box.scrollTop = Math.min(top, bottom - box.clientHeight);
  }, [open, detail]);
  const r = (n: number) => Math.round(n);
  const first = weather.places[0]!;
  const summary = (
    <span className="fold-wx">
      <SkyIcon code={first.now.code} />
      <span className="fold-temp">{r(first.now.temperature)}°</span>
      <span className="fold-lines">
        <strong>{first.name}</strong>
        <span className="muted">{sky(first.now.code).text} · {r(first.today.min)}–{r(first.today.max)}°</span>
      </span>
      {weather.places.length > 1 && <span className="fold-more muted">另 {weather.places.length - 1} 地</span>}
    </span>
  );
  return (
    <Fold title="天气" summary={summary}>
      <div className="card-head"><h2>天气</h2><span className="muted">{live ? "现在" : `${saved.fetched_at.slice(11, 16)} 保存`}</span></div>
      <ul className="wx-list" ref={list}>
        {weather.places.map((p, i) => i === open ? (
          <li key={`${p.name}@${p.latitude},${p.longitude}`} className="wx-open">
            <div className="wx-here">
              <div className="wx-now">
                <div className="muted">{p.name}</div>
                <div className="wx-big"><span>{r(p.now.temperature)}°</span><SkyIcon code={p.now.code} /></div>
                <div className="muted">{sky(p.now.code).text} · {r(p.today.min)}–{r(p.today.max)}°</div>
              </div>
              <dl className="wx-facts">
                <div><dt>日出</dt><dd>{detail ? hhmm(detail.sunrise) : "—"}</dd></div>
                <div><dt>日落</dt><dd>{detail ? hhmm(detail.sunset) : "—"}</dd></div>
                <div><dt>紫外线</dt><dd>{detail ? <>{r(detail.uv)} <span className="muted">最高 {r(detail.uvMax)} {uvText(detail.uvMax)}</span></> : "—"}</dd></div>
                <div><dt>空气</dt><dd>{detail?.aqi != null ? <>{r(detail.aqi)} {aqiText(detail.aqi)}{detail.pm25 !== null && <span className="muted"> PM2.5 {r(detail.pm25)}</span>}</> : "—"}</dd></div>
              </dl>
            </div>
            {detail && detail.hours.length > 1 ? <HourlyChart hours={detail.hours} /> : <div className="hourly hourly-empty" />}
          </li>
        ) : (
          <li key={`${p.name}@${p.latitude},${p.longitude}`}>
            <button type="button" className="wx-row" aria-expanded="false" onClick={() => setOpen(i)}>
              <span className="wx-name">{p.name}</span>
              <SkyIcon code={p.today.code} className="icon-sm" />
              <span className="muted">{sky(p.today.code).text}</span>
              <span className="num">{r(p.today.min)}–{r(p.today.max)}°</span>
            </button>
          </li>
        ))}
      </ul>
    </Fold>
  );
}
