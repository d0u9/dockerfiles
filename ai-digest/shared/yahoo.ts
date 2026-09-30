// Yahoo Finance's chart endpoint, read the same way by the tool when a digest
// runs and by the page when it asks for the current quotes (DESIGN 5.3).

import type { Markets, Series } from "./types.ts";

export interface YahooChart {
  chart: {
    result: {
      meta: {
        currency?: string; regularMarketPrice?: number; regularMarketTime?: number; exchangeTimezoneName?: string;
        currentTradingPeriod?: { regular?: { start: number; end: number } };
      };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[] | null;
  };
}

/** The path and query for a month of daily closes, after the endpoint's base. */
export const chartPath = (symbol: string) => `${encodeURIComponent(symbol)}?range=1mo&interval=1d`;

/** One quote from a chart answer; throws when it has no price. */
export function readChart(body: YahooChart, name: string, symbol: string): Markets["quotes"][number] {
  const result = body.chart.result?.[0];
  if (!result) throw new Error("no result");
  const { meta } = result;
  const tz = meta.exchangeTimezoneName ?? "UTC";
  const day = (s: number) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date(s * 1000));
  const closes = result.indicators.quote[0]?.close ?? [];
  const history: Series = (result.timestamp ?? []).flatMap((t, i) => {
    const value = closes[i];
    return typeof value === "number" ? [{ date: day(t), value }] : [];
  });
  const value = meta.regularMarketPrice ?? history.at(-1)?.value;
  if (value === undefined) throw new Error("no price");
  const time = meta.regularMarketTime;
  const asOf = time ? new Date(time * 1000).toISOString() : history.at(-1)!.date;
  // The close before the latest trading day, for the day's change.
  const today = time ? day(time) : history.at(-1)?.date;
  const before = history.filter((h) => h.date !== today).at(-1);
  const regular = meta.currentTradingPeriod?.regular;
  const session = regular && { start: new Date(regular.start * 1000).toISOString(), end: new Date(regular.end * 1000).toISOString() };
  return { name, symbol, currency: meta.currency ?? null, as_of: asOf, value, previous_close: before?.value ?? null, history, ...(session && { session }) };
}

/**
 * Whether a quote's market is trading at `now`: inside the day's regular
 * session, and the price is recent, which a holiday's session is not.
 */
export function trading(q: Markets["quotes"][number], now: number): boolean {
  if (!q.session) return false;
  return Date.parse(q.session.start) <= now && now < Date.parse(q.session.end)
    && now - Date.parse(q.as_of) < 30 * 60_000;
}
