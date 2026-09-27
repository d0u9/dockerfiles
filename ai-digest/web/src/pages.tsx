// The pages (DESIGN 9.2). Every string from the data is rendered as text by
// React; links go through safeUrl.

import { useEffect, useRef, useState } from "react";
import type { Article, Digest, SiteIndex, Weather } from "../../shared/types.ts";
import {
  loadDigest, loadIndex, loadMonth, monthShift, safeUrl, useLoad, weekday,
} from "./data.ts";
import { Timeline } from "./timeline.tsx";
import { Link, Nav, Show } from "./ui.tsx";
import { WeatherStrip } from "./weather.tsx";

// ---- months ------------------------------------------------------------------------

function MonthNav({ month, prefix, index }: { month: string; prefix: string; index: SiteIndex | null }) {
  const have = new Set(index?.months.map((m) => m.month));
  const prev = monthShift(month, -1), next = monthShift(month, 1);
  return (
    <Nav>
      <Link to="">首页</Link> · <Link to={prefix ? prefix.slice(0, -1) : "archive"}>{prefix ? prefix.slice(0, -1) : "全部月份"}</Link>
      {have.has(prev) && <> · <Link to={prefix + prev}>← {prev}</Link></>}
      {have.has(next) && <> · <Link to={prefix + next}>{next} →</Link></>}
    </Nav>
  );
}

export function MonthPage({ month }: { month: string }) {
  const loaded = useLoad(`month:${month}`, async () => ({ index: await loadIndex(), m: await loadMonth(month) }));
  return (
    <Show loaded={loaded}>
      {({ index, m }) => (
        <>
          <MonthNav month={month} prefix="" index={index} />
          <h1>{month}</h1>
          {m ? <Timeline months={[m]} /> : <p className="muted">这个月没有日报。</p>}
        </>
      )}
    </Show>
  );
}

export function Archive() {
  const loaded = useLoad("index", loadIndex);
  return (
    <>
      <Nav><Link to="">首页</Link></Nav>
      <h1>全部月份</h1>
      <Show loaded={loaded}>
        {(index) => {
          const years = Map.groupBy(index?.months ?? [], (m) => m.month.slice(0, 4));
          if (!years.size) return <p>还没有日报。</p>;
          return [...years].map(([year, months]) => (
            <section key={year}>
              <h2>{year}</h2>
              <div className="months">
                {months.map((m) => (
                  <Link className="card" to={m.month} key={m.month}>
                    <strong>{m.month.slice(5)} 月</strong>
                    <div className="muted">{m.days} 天 · {m.users.join("、")}</div>
                  </Link>
                ))}
              </div>
            </section>
          ));
        }}
      </Show>
    </>
  );
}

// ---- one person ------------------------------------------------------------------------

export function Person({ user }: { user: string }) {
  const loaded = useLoad("index", loadIndex);
  return (
    <>
      <Nav><Link to="">首页</Link></Nav>
      <h1>{user} 的日报</h1>
      <Show loaded={loaded}>
        {(index) => {
          const months = index?.months.filter((m) => m.users.includes(user)) ?? [];
          if (!months.length) return <p className="muted">还没有日报。</p>;
          return (
            <div className="months">
              {months.map((m) => (
                <Link className="card" to={`${user}/${m.month}`} key={m.month}><strong>{m.month}</strong></Link>
              ))}
            </div>
          );
        }}
      </Show>
    </>
  );
}

export function PersonMonth({ user, month }: { user: string; month: string }) {
  const loaded = useLoad(`month:${month}`, async () => ({ index: await loadIndex(), m: await loadMonth(month) }));
  return (
    <Show loaded={loaded}>
      {({ index, m }) => {
        const days = m?.days.filter((d) => d.digests[user]) ?? [];
        return (
          <>
            <MonthNav month={month} prefix={`${user}/`} index={index} />
            <h1>{user} · {month}</h1>
            {days.length ? days.map((d) => {
              const s = d.digests[user]!;
              return (
                <Link className="card day" to={`${user}/${d.date}`} key={d.date}>
                  <strong>{d.date}</strong> <span className="muted">{weekday(d.date)} · {s.selected} 篇</span>
                  <p>{s.summary}</p>
                </Link>
              );
            }) : <p className="muted">这个月没有日报。</p>}
          </>
        );
      }}
    </Show>
  );
}

// ---- one digest ------------------------------------------------------------------------
//
// Laid out for reading: one column of comfortable width, the summary first,
// then the articles worth opening, then each section. A bar of the sections
// stays at the top while scrolling, and the days before and after are one
// step away at the top and at the end.

async function loadDay(user: string, date: string) {
  const month = date.slice(0, 7);
  const [digest, weather, index] = await Promise.all([
    loadDigest(user, date),
    fetch(`data/days/${date.replaceAll("-", "/")}/weather.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() as Promise<Weather> : null)).catch(() => null),
    loadIndex(),
  ]);
  // This person's days in this month and the ones either side, for the
  // previous and next links.
  const have = new Set(index?.months.map((m) => m.month));
  const months = await Promise.all([monthShift(month, -1), month, monthShift(month, 1)]
    .filter((m) => have.has(m)).map((m) => loadMonth(m)));
  const dates = months.flatMap((m) => m?.days ?? []).filter((d) => d.digests[user]).map((d) => d.date).sort();
  const at = dates.indexOf(date);
  return {
    digest, weather,
    prev: at > 0 ? dates[at - 1]! : at < 0 ? dates.filter((d) => d < date).at(-1) ?? null : null,
    next: at >= 0 ? dates[at + 1] ?? null : dates.find((d) => d > date) ?? null,
    users: index?.users ?? [],
  };
}

const longDate = (date: string) => `${Number(date.slice(0, 4))}年${Number(date.slice(5, 7))}月${Number(date.slice(8))}日`;
const time = (iso: string) => iso.slice(11, 16);

function DayNav({ user, prev, next }: { user: string; prev: string | null; next: string | null }) {
  return (
    <nav className="day-pager">
      {prev ? <Link to={`${user}/${prev}`}>← {longDate(prev)}</Link> : <span />}
      {next ? <Link to={`${user}/${next}`}>{longDate(next)} →</Link> : <span />}
    </nav>
  );
}

export function DayPage({ user, date, section }: { user: string; date: string; section?: number }) {
  const loaded = useLoad(`day:${user}:${date}`, () => loadDay(user, date));
  return (
    <div className="reader">
      <Show loaded={loaded}>
        {({ digest: d, weather, prev, next, users }) => (
          <>
            <Nav>
              <Link to="">首页</Link> · <Link to={user}>{user} 的日报</Link> · <Link to={`${user}/${date.slice(0, 7)}`}>{Number(date.slice(5, 7))} 月</Link>
            </Nav>
            <header className="reader-head">
              <h1>{longDate(date)} <span className="muted">{weekday(date)}</span></h1>
              <div className="reader-meta">
                {users.length > 1 && (
                  <span className="tabs" role="tablist" aria-label="读谁的日报">
                    {users.map((u) => (
                      <a key={u} role="tab" aria-selected={u === user} href={`#/${u}/${date}`}>{u}</a>
                    ))}
                  </span>
                )}
                {d && (
                  <span className="muted">
                    精选 {d.stats.selected} 篇{d.stats.pulled !== undefined && `，共读 ${d.stats.pulled} 篇`} · {time(d.generated_at)} 生成
                  </span>
                )}
              </div>
              {weather && <WeatherStrip places={weather.places.map((p) => ({ name: p.name, ...p.today }))} />}
            </header>
            {d ? <DigestBody d={d} open={section} /> : <p className="muted">{user} 这天没有日报。</p>}
            <DayNav user={user} prev={prev} next={next} />
          </>
        )}
      </Show>
    </div>
  );
}

function Source({ a }: { a: Article }) {
  return (
    <span className="item-meta">
      {a.feed}
      {a.published && <> · {time(a.published)}</>}
    </span>
  );
}

function Title({ a, className }: { a: Article; className: string }) {
  const href = safeUrl(a.url);
  const title = a.title || "（无标题）";
  return href
    ? <a className={className} href={href} rel="noopener noreferrer" target="_blank">{title}<span className="ext" aria-hidden="true">↗</span></a>
    : <span className={className}>{title}</span>;
}

export function DigestBody({ d, open }: { d: Digest; open?: number }) {
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  // The section being read, marked in the bar: the last one whose heading
  // has passed under the bar.
  const [current, setCurrent] = useState(-1);
  const go = (i: number) => sectionRefs.current[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
  useEffect(() => {
    if (open && open >= 1) sectionRefs.current[open - 1]?.scrollIntoView({ block: "start" });
  }, [open]);
  useEffect(() => {
    const update = () => {
      const passed = sectionRefs.current.filter((el) => el && el.getBoundingClientRect().top < 80);
      setCurrent(passed.length - 1);
    };
    update();
    addEventListener("scroll", update, { passive: true });
    return () => removeEventListener("scroll", update);
  }, [d]);
  return (
    <article className="digest">
      <p className="lead">{d.summary}</p>

      {d.sections.length > 1 && (
        <nav className="toc" aria-label="分组">
          {d.sections.map((s, i) => (
            <button key={s.title} className="chip" aria-current={i === current} onClick={() => go(i)}>
              {s.title}<span className="chip-count">{s.items.length}</span>
            </button>
          ))}
        </nav>
      )}

      {d.highlights.length > 0 && (
        <section className="picks-block">
          <h2>值得读原文</h2>
          <ol className="picks">
            {d.highlights.map((h) => {
              const a = d.articles[h.article];
              if (!a) return null;
              return (
                <li key={h.article}>
                  <Title a={a} className="pick-title" />
                  <Source a={a} />
                  <span className="pick-why">{h.why}</span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {d.sections.map((s, i) => (
        <section key={s.title} className="d-section" ref={(el) => { sectionRefs.current[i] = el; }}>
          <h2>{s.title} <span className="count">{s.items.length}</span></h2>
          {s.summary && <p className="d-summary">{s.summary}</p>}
          <ul className="items">
            {s.items.map((it) => {
              const a = d.articles[it.article];
              return (
                <li key={it.article}>
                  {a ? <><Title a={a} className="item-title" /><Source a={a} /></> : <span className="muted">（文章缺失）</span>}
                  <p className="item-note">{it.note}</p>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </article>
  );
}
