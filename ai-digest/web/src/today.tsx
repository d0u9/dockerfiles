// The dashboard's cards about the day itself rather than the news: clocks,
// the calendar with holidays, and the weather. Everything live here is
// fetched by the browser from public services; nothing is stored.

import { useEffect, useState } from "react";
import type { Clock, HolidayRegion, Weather } from "../../shared/types.ts";
import { SkyIcon, sky, useLiveWeather } from "./weather.tsx";

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

export function Clocks({ clocks }: { clocks: Clock[] }) {
  const now = useMinute();
  return (
    <>
      <h2>时钟</h2>
      <div className="clocks">
        {clocks.map((c) => {
          const w = wall(now, c.timezone);
          return (
            <figure className="clock" key={`${c.name}@${c.timezone}`}>
              <Face hour={w.hour} minute={w.minute} />
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

function lunar(at: Date): string {
  const parts = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", { year: "numeric", month: "long", day: "numeric" }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("yearName")}年 ${get("month")}${LUNAR_DAYS[Number(get("day")) - 1] ?? get("day")}`;
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

interface Holiday { date: string; name: string; region: string }

/** Public holidays from Nager.Date for this year and the next. */
function useHolidays(regions: HolidayRegion[], year: number): Holiday[] | null {
  const [found, setFound] = useState<Holiday[] | null>(null);
  useEffect(() => {
    if (!regions.length) return;
    const controller = new AbortController();
    const one = (r: HolidayRegion, y: number) =>
      fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/${r.country}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : []))
        .then((list: { date: string; localName: string; global: boolean; counties: string[] | null }[]) =>
          list.filter((h) => h.global || (r.region && h.counties?.includes(r.region)))
            .map((h) => ({ date: h.date, name: h.localName, region: r.name })));
    Promise.all(regions.flatMap((r) => [one(r, year), one(r, year + 1)]))
      .then((lists) => setFound(lists.flat().sort((a, b) => a.date.localeCompare(b.date))))
      .catch(() => {});
    return () => controller.abort();
  }, [regions, year]);
  return found;
}

export function CalendarCard({ regions }: { regions: HolidayRegion[] }) {
  const now = useMinute();
  const today = iso(now);
  const year = now.getFullYear();
  const holidays = useHolidays(regions, year);
  const term = [...terms(year), ...terms(year + 1)].find((t) => t.date >= today)!;
  // The next few, each region's first ones rather than one region's many.
  const upcoming = (holidays ?? []).filter((h) => h.date >= today)
    .filter((h, i, all) => all.slice(0, i).filter((o) => o.region === h.region).length < 2)
    .slice(0, 4);
  return (
    <>
      <h2>日历</h2>
      <div className="cal-lunar">农历 {lunar(now)}</div>
      <div className="muted">
        {term.date === today ? <>今天<strong className="cal-term">{term.name}</strong></> : <>{term.name} · {md(term.date)}（{inDays(daysUntil(today, term.date))}）</>}
      </div>
      {regions.length > 0 && (
        <ul className="link-list cal-holidays">
          {holidays === null && <li className="muted">假期加载中…</li>}
          {upcoming.map((h) => (
            <li key={`${h.region}${h.date}${h.name}`} className={h.date === today ? "cal-today" : undefined}>
              <span className="muted">{h.region}</span> {h.name}
              <span className="muted cal-when">{md(h.date)} · {inDays(daysUntil(today, h.date))}</span>
            </li>
          ))}
        </ul>
      )}
    </>
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
function useDetail(latitude: number, longitude: number): Detail | null {
  const [detail, setDetail] = useState<Detail | null>(null);
  useEffect(() => {
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
      setDetail({
        hours,
        sunrise: f.daily.sunrise[0], sunset: f.daily.sunset[0],
        uv: f.hourly.uv_index[start] ?? 0, uvMax: f.daily.uv_index_max[0] ?? 0,
        aqi: a?.current?.us_aqi ?? null, pm25: a?.current?.pm2_5 ?? null,
      });
    }).catch(() => {});
    return () => controller.abort();
  }, [latitude, longitude]);
  return detail;
}

/** Temperature as a line, the chance of rain as bars beneath it. */
function HourlyChart({ hours }: { hours: Detail["hours"] }) {
  const W = 300, H = 90, top = 14, bottom = 16;
  const temps = hours.map((h) => h.temperature);
  const lo = Math.min(...temps), hi = Math.max(...temps);
  const x = (i: number) => (i / (hours.length - 1)) * W;
  const y = (t: number) => top + (1 - (t - lo) / (hi - lo || 1)) * (H - top - bottom - 10);
  const line = hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(h.temperature).toFixed(1)}`).join("");
  return (
    <svg className="hourly" viewBox={`0 -2 ${W} ${H + 2}`} role="img" aria-label="未来 24 小时气温和降水概率">
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
 * the day's low and high.
 */
export function WeatherCard({ saved }: { saved: Weather }) {
  const { weather, live } = useLiveWeather(saved);
  const [here, ...others] = weather.places;
  const detail = useDetail(here!.latitude, here!.longitude);
  const r = (n: number) => Math.round(n);
  return (
    <>
      <div className="card-head"><h2>天气</h2><span className="muted">{live ? "现在" : `${saved.fetched_at.slice(11, 16)} 保存`}</span></div>
      <div className="wx-here">
        <div className="wx-now">
          <div className="muted">{here!.name}</div>
          <div className="wx-big"><span>{r(here!.now.temperature)}°</span><SkyIcon code={here!.now.code} /></div>
          <div className="muted">{sky(here!.now.code).text} · {r(here!.today.min)}–{r(here!.today.max)}°</div>
        </div>
        <dl className="wx-facts">
          {detail && <>
            <div><dt>日出</dt><dd>{hhmm(detail.sunrise)}</dd></div>
            <div><dt>日落</dt><dd>{hhmm(detail.sunset)}</dd></div>
            <div><dt>紫外线</dt><dd>{r(detail.uv)} <span className="muted">最高 {r(detail.uvMax)} {uvText(detail.uvMax)}</span></dd></div>
            {detail.aqi !== null && <div><dt>空气</dt><dd>{r(detail.aqi)} {aqiText(detail.aqi)}{detail.pm25 !== null && <span className="muted"> PM2.5 {r(detail.pm25)}</span>}</dd></div>}
          </>}
        </dl>
      </div>
      {detail && detail.hours.length > 1 && <HourlyChart hours={detail.hours} />}
      {others.length > 0 && (
        <table className="wx">
          <tbody>
            {others.map((p) => (
              <tr key={`${p.name}@${p.latitude},${p.longitude}`}>
                <td className="wx-name">{p.name}</td>
                <td><SkyIcon code={p.today.code} className="icon-sm" /></td>
                <td className="muted">{sky(p.today.code).text}</td>
                <td className="num">{r(p.today.min)}–{r(p.today.max)}°</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
