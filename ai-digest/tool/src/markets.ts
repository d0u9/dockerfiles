// The day's exchange rates and quotes (DESIGN 5.3), fetched once when the
// day's first digest runs, like the weather:
//
//   - rates from Frankfurter (the European Central Bank's reference rates,
//     working days only), keyless;
//   - quotes from Yahoo Finance's chart endpoint, keyless.
//
// Each comes with the month before it, one value a day, for a trend line.
// Like the weather this is decoration: an item that cannot be had is left
// out, and a failure never stops the digest.

import type { Markets, MarketsConfig, Series } from "../../shared/types.ts";
import { type YahooChart, chartPath, readChart } from "../../shared/yahoo.ts";
import { type Moment, log } from "./common.ts";

const DAYS = 35;
const TIMEOUT = 20_000;

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return await response.json() as T;
}

function daysBefore(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

interface FrankfurterSeries { rates: Record<string, Record<string, number>> }

async function fetchRates(rates: MarketsConfig["rates"], moment: Moment): Promise<Markets["rates"]> {
  const out: Markets["rates"] = [];
  // One request per base currency, for all of its quotes.
  const bases = [...new Set(rates.map((r) => r.base))];
  const series = new Map<string, Series>();
  for (const base of bases) {
    const to = [...new Set(rates.filter((r) => r.base === base).map((r) => r.quote))];
    try {
      const body = await getJson<FrankfurterSeries>(
        `https://api.frankfurter.dev/v1/${daysBefore(moment.date, DAYS)}..${moment.date}`
        + `?from=${base}&to=${to.join(",")}`);
      for (const quote of to) {
        series.set(`${base}/${quote}`, Object.entries(body.rates)
          .filter(([, v]) => typeof v[quote] === "number")
          .map(([date, v]) => ({ date, value: v[quote]! }))
          .sort((a, b) => a.date.localeCompare(b.date)));
      }
    } catch (e) {
      log("digest", `no rates from ${base}: ${(e as Error).message}`);
    }
  }
  for (const { base, quote } of rates) {
    const history = series.get(`${base}/${quote}`);
    const last = history?.at(-1);
    if (history && last) out.push({ base, quote, as_of: last.date, value: last.value, history });
  }
  return out;
}

async function fetchQuote(item: MarketsConfig["quotes"][number]): Promise<Markets["quotes"][number] | null> {
  try {
    const body = await getJson<YahooChart>(`https://query1.finance.yahoo.com/v8/finance/chart/${chartPath(item.symbol)}`);
    return readChart(body, item.name, item.symbol);
  } catch (e) {
    log("digest", `no quote for ${item.symbol}: ${(e as Error).message}`);
    return null;
  }
}

/** The day's rates and quotes, or null when none of them can be had. */
export async function fetchMarkets(config: MarketsConfig, moment: Moment): Promise<Markets | null> {
  const [rates, quotes] = await Promise.all([
    fetchRates(config.rates, moment),
    Promise.all(config.quotes.map(fetchQuote)),
  ]);
  const found = quotes.filter((q) => q !== null);
  if (!rates.length && !found.length) return null;
  return { version: 1, date: moment.date, fetched_at: moment.iso, rates, quotes: found };
}
