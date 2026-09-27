// Exchange rates and quotes on the dashboard: each with its value, the day's
// change and a month's trend line.
//
// The saved snapshot from the latest digest comes first. The rates are then
// replaced by the current ones from Frankfurter, which the browser may ask
// directly. Quotes cannot be: Yahoo Finance does not allow a page on another
// site to read its answers, so they stay as saved, with the time they are from.
//
// Each row opens Yahoo Finance's page for it in a new tab.
//
// Colours follow the Chinese convention the page is written for: red is up,
// green is down.

import { useEffect, useState, type ReactNode } from "react";
import type { Markets, MarketsConfig, Series } from "../../shared/types.ts";

type Rate = Markets["rates"][number];

/** The saved rates, replaced by the current ones when they can be had. */
function useLiveRates(config: MarketsConfig["rates"], saved: Rate[]): { rates: Rate[]; live: boolean } {
  const [live, setLive] = useState<Rate[] | null>(null);
  useEffect(() => {
    if (!config.length) return;
    const controller = new AbortController();
    const start = new Date(Date.now() - 35 * 86_400_000).toISOString().slice(0, 10);
    const bases = [...new Set(config.map((r) => r.base))];
    Promise.all(bases.map((base) => {
      const to = [...new Set(config.filter((r) => r.base === base).map((r) => r.quote))];
      return fetch(`https://api.frankfurter.dev/v1/${start}..?from=${base}&to=${to.join(",")}`, { signal: controller.signal })
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((body: { rates: Record<string, Record<string, number>> }) => ({ base, body }));
    })).then((answers) => {
      const rates = config.flatMap(({ base, quote }) => {
        const body = answers.find((a) => a.base === base)?.body;
        const history: Series = Object.entries(body?.rates ?? {})
          .filter(([, v]) => typeof v[quote] === "number")
          .map(([date, v]) => ({ date, value: v[quote]! }))
          .sort((a, b) => a.date.localeCompare(b.date));
        const last = history.at(-1);
        return last ? [{ base, quote, as_of: last.date, value: last.value, history }] : [];
      });
      if (rates.length) setLive(rates);
    }).catch(() => {});
    return () => controller.abort();
  }, [config]);
  return { rates: live ?? saved, live: live !== null };
}

/** A month as a small line. */
function Spark({ history }: { history: Series }) {
  if (history.length < 2) return <span className="spark" />;
  const W = 64, H = 22;
  const values = history.map((h) => h.value);
  const lo = Math.min(...values), hi = Math.max(...values);
  const points = values.map((v, i) =>
    `${((i / (values.length - 1)) * W).toFixed(1)},${(2 + (1 - (v - lo) / (hi - lo || 1)) * (H - 4)).toFixed(1)}`);
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <polyline points={points.join(" ")} />
    </svg>
  );
}

/** Enough digits to see a day's move: 7.8k needs none, 0.85 needs four. */
function format(value: number): string {
  const digits = value >= 1000 ? 0 : value >= 100 ? 2 : value >= 10 ? 3 : 4;
  return value.toLocaleString("zh-CN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** Yahoo Finance's page for a symbol: the full chart, news and figures. */
const detailUrl = (symbol: string) => `https://finance.yahoo.com/quote/${encodeURIComponent(symbol).replace("%3D", "=")}/`;

function Row({ name, sub, symbol, value, previous, history, lead }: {
  name: string; sub?: string; symbol: string; value: number; previous: number | null; history: Series; lead?: ReactNode;
}) {
  const change = previous ? (value - previous) / previous : null;
  const trend = change === null || Math.abs(change) < 0.00005 ? "flat" : change > 0 ? "up" : "down";
  return (
    <li className="mk-item">{lead}<a className="mk-row" href={detailUrl(symbol)} target="_blank" rel="noopener noreferrer" title={`${name} 详情`}>
      <span className="mk-name">{name}{sub && <span className="muted"> {sub}</span>}</span>
      <Spark history={history} />
      <span className="mk-value">{format(value)}</span>
      <span className={`mk-change ${trend}`}>
        {change === null ? "—" : `${change > 0 ? "+" : change < 0 ? "−" : ""}${Math.abs(change * 100).toFixed(2)}%`}
      </span>
    </a></li>
  );
}

const md = (date: string) => `${Number(date.slice(5, 7))}月${Number(date.slice(8, 10))}日`;

/** The close before the last value, for the day's change. */
const previous = (history: Series, asOf: string) => history.filter((h) => h.date < asOf.slice(0, 10)).at(-1)?.value ?? null;

/** Rates the reader turned round, remembered in this browser only. */
const FLIPPED = "ai-digest.flipped-rates";
function useFlipped(): [Set<string>, (pair: string) => void] {
  const [flipped, setFlipped] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(FLIPPED) ?? "[]") as string[]); } catch { return new Set(); }
  });
  const toggle = (pair: string) => setFlipped((old) => {
    const next = new Set(old);
    if (!next.delete(pair)) next.add(pair);
    try { localStorage.setItem(FLIPPED, JSON.stringify([...next])); } catch { /* storage blocked */ }
    return next;
  });
  return [flipped, toggle];
}

/** A rate the other way round: CNY/AUD from AUD/CNY. */
function flip(r: Rate): Rate {
  return {
    base: r.quote, quote: r.base, as_of: r.as_of, value: 1 / r.value,
    history: r.history.map((h) => ({ date: h.date, value: 1 / h.value })),
  };
}

export function MarketsCard({ config, saved }: { config: MarketsConfig; saved: Markets | null }) {
  // The day's snapshot has everyone's; keep what this dashboard lists, in its order.
  const savedRates = config.rates.flatMap((c) => saved?.rates.filter((r) => r.base === c.base && r.quote === c.quote) ?? []);
  const { rates, live } = useLiveRates(config.rates, savedRates);
  const quotes = config.quotes.flatMap((c) => saved?.quotes.filter((q) => q.symbol === c.symbol) ?? []);
  const [flipped, toggle] = useFlipped();
  const rateDate = rates[0]?.as_of;
  return (
    <>
      <div className="card-head"><h2>市场</h2></div>
      {rates.length > 0 && (
        <section className="mk-group">
          <h3>汇率 <span className="muted">{live ? "欧洲央行参考价" : "保存的"} · {rateDate && md(rateDate)}</span></h3>
          <ul className="mk-list">
            {rates.map((saved) => {
              const pair = `${saved.base}${saved.quote}`;
              const r = flipped.has(pair) ? flip(saved) : saved;
              return (
                <Row key={pair} name={`${r.base}/${r.quote}`} symbol={`${r.base}${r.quote}=X`} value={r.value}
                  previous={previous(r.history, r.as_of)} history={r.history}
                  lead={<button type="button" className="mk-swap" onClick={() => toggle(pair)}
                    title={`换成 ${r.quote}/${r.base}`} aria-label={`换成 ${r.quote}/${r.base}`}>
                    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M2 5h11M10 2l3 3-3 3M14 11H3M6 8l-3 3 3 3" />
                    </svg>
                  </button>} />
              );
            })}
          </ul>
        </section>
      )}
      {quotes.length > 0 && (
        <section className="mk-group">
          <h3>股市 <span className="muted">截至 {md(saved!.fetched_at)} {saved!.fetched_at.slice(11, 16)}</span></h3>
          <ul className="mk-list">
            {quotes.map((q) => (
              <Row key={q.symbol} name={q.name} symbol={q.symbol} value={q.value} previous={q.previous_close} history={q.history} />
            ))}
          </ul>
        </section>
      )}
      {!rates.length && !quotes.length && <p className="muted">还没有数据。</p>}
    </>
  );
}
