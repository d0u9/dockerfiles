// Weather: the WMO code table, line icons, the cards on the home page and a
// day's page, and the small strip in each day's row.

import { useEffect, useState } from "react";
import type { DailyWeather, Weather } from "../../shared/types.ts";

type Icon = "sun" | "partly" | "cloud" | "fog" | "drizzle" | "rain" | "showers" | "snow" | "storm";

// WMO weather codes as Open-Meteo reports them, grouped: the first row whose
// code is at least the one reported.
const SKY: [number, Icon, string][] = [
  [0, "sun", "晴"],
  [2, "partly", "多云"],
  [3, "cloud", "阴"],
  [48, "fog", "雾"],
  [57, "drizzle", "毛毛雨"],
  [67, "rain", "雨"],
  [77, "snow", "雪"],
  [82, "showers", "阵雨"],
  [86, "snow", "阵雪"],
  [99, "storm", "雷雨"],
];

export function sky(code: number): { icon: Icon; text: string } {
  const row = SKY.find(([limit]) => code <= limit) ?? SKY[SKY.length - 1]!;
  return { icon: row[1], text: row[2] };
}

const CLOUD = "M7 15h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 8.1 3.5 3.5 0 0 0 7 15z";
const PATHS: Record<Icon, string[]> = {
  sun: ["M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4",
    "M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0z"],
  partly: ["M8.5 3v1.5M3.2 5.2l1 1M2 10.5h1.5M12.8 5.2l-1 1", "M5.3 12.6A4 4 0 1 1 11.9 8",
    "M9 20h8.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.3 13.9 3 3 0 0 0 9 20z"],
  cloud: ["M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 11.1 3.5 3.5 0 0 0 7 18z"],
  fog: ["M7 13h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.2 6.1 3.5 3.5 0 0 0 7 13z", "M4 17h16M6 20.5h12"],
  drizzle: [CLOUD, "M8 18.5v.5M12 18.5v.5M16 18.5v.5M10 21v.5M14 21v.5"],
  rain: [CLOUD, "M8 18l-1 3M12 18l-1 3M16 18l-1 3"],
  showers: ["M8.5 3v1.2M3.6 5.1l.9.9M13.4 5.1l-.9.9", "M5.6 11.5A3.8 3.8 0 1 1 11.7 7.2",
    "M9 16h8.5a3.5 3.5 0 0 0 .5-6.96A5 5 0 0 0 8.3 9.9 3 3 0 0 0 9 16z", "M11 18.5l-.8 2.5M15 18.5l-.8 2.5"],
  snow: [CLOUD, "M8 18.5h.01M12 18.5h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01"],
  storm: [CLOUD, "M12.5 14.5l-2 3.5h3l-2 3.5"],
};

/** A line icon in the text colour, so it follows the dark theme. */
export function SkyIcon({ code, className = "icon" }: { code: number; className?: string }) {
  const { icon, text } = sky(code);
  return (
    <svg className={className} viewBox="0 0 24 24" role="img" aria-label={text}>
      {PATHS[icon].map((d) => <path key={d} d={d} strokeWidth={icon === "snow" && d !== CLOUD ? 2.4 : undefined} />)}
    </svg>
  );
}

const round = (n: number) => Math.round(n);
const range = (d: DailyWeather, dash = "° – ") => `${round(d.min)}${dash}${round(d.max)}°`;

interface Forecast {
  current: { temperature_2m: number; weather_code: number };
  daily: { weather_code: number[]; temperature_2m_min: number[]; temperature_2m_max: number[] };
}

/** The saved weather, replaced by the current one from Open-Meteo when the
 * browser can get it; when it cannot, the saved weather stays. */
export function useLiveWeather(saved: Weather): { weather: Weather; live: boolean } {
  const [live, setLive] = useState<Weather | null>(null);
  useEffect(() => {
    const places = saved.places;
    const query = new URLSearchParams({
      latitude: places.map((p) => p.latitude).join(","),
      longitude: places.map((p) => p.longitude).join(","),
      current: "temperature_2m,weather_code",
      daily: "weather_code,temperature_2m_max,temperature_2m_min",
      timezone: "auto",
      forecast_days: "2",
    });
    const controller = new AbortController();
    fetch(`https://api.open-meteo.com/v1/forecast?${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((body: Forecast | Forecast[]) => {
        const data = Array.isArray(body) ? body : [body];
        if (data.length !== places.length) return;
        const day = (d: Forecast, i: number): DailyWeather => ({
          code: d.daily.weather_code[i]!, min: d.daily.temperature_2m_min[i]!, max: d.daily.temperature_2m_max[i]!,
        });
        setLive({
          ...saved,
          places: places.map((p, i) => ({
            ...p,
            now: { temperature: data[i]!.current.temperature_2m, code: data[i]!.current.weather_code },
            today: day(data[i]!, 0),
            tomorrow: day(data[i]!, 1),
          })),
        });
      })
      .catch(() => {});
    return () => controller.abort();
  }, [saved]);
  return { weather: live ?? saved, live: live !== null };
}

function Cards({ weather, caption }: { weather: Weather; caption: string }) {
  return (
    <>
      <div className="weather-head muted">{caption}</div>
      <div className="weather">
        {weather.places.map((p) => (
          <div className="card" key={`${p.name}@${p.latitude},${p.longitude}`}>
            <div className="name">{p.name}</div>
            <div className="row">
              <span className="temp">{round(p.now.temperature)}°</span>
              <SkyIcon code={p.now.code} />
            </div>
            <div className="sky">{sky(p.now.code).text}</div>
            <div className="range">{range(p.today)}</div>
            <div className="tomorrow">
              <span>明天</span>
              {p.tomorrow && <SkyIcon code={p.tomorrow.code} className="icon-sm" />}
              <span className="t-range">{p.tomorrow ? range(p.tomorrow, "–") : "–"}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

const hhmm = (iso: string) => iso.slice(11, 16);

/** The home page: the latest saved weather, replaced by the current one. */
export function LiveWeather({ saved }: { saved: Weather }) {
  const { weather, live } = useLiveWeather(saved);
  return <Cards weather={weather} caption={live ? "现在的天气" : `${saved.date} ${hhmm(saved.fetched_at)} 的天气`} />;
}

/** A day's page: that day's weather as it was saved. */
export function SavedWeather({ weather }: { weather: Weather }) {
  return <Cards weather={weather} caption={`当天 ${hhmm(weather.fetched_at)} 的天气`} />;
}

/** The small strip in a day's row. */
export function WeatherStrip({ places }: { places: ({ name: string } & DailyWeather)[] }) {
  if (!places.length) return null;
  return (
    <div className="strip muted">
      {places.map((p) => (
        <span key={p.name} title={`${p.name} ${sky(p.code).text}`}>
          {p.name} <SkyIcon code={p.code} className="icon-sm" /> {range(p, "–")}
        </span>
      ))}
    </div>
  );
}
