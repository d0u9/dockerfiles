// The pages (DESIGN 9.2). Every string from the data is rendered as text by
// React; links go through safeUrl.

import type { Article, Digest, SiteIndex } from "../../shared/types.ts";
import {
  loadDigest, loadIndex, loadMonth, monthShift, safeUrl, useLoad, weekday,
} from "./data.ts";
import { Timeline } from "./timeline.tsx";
import { Link, Nav, Show } from "./ui.tsx";
import { SavedWeather } from "./weather.tsx";

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

function ArticleLink({ a }: { a: Article | undefined }) {
  if (!a) return <span className="muted">（文章缺失）</span>;
  const href = safeUrl(a.url);
  const title = a.title || "（无标题）";
  return (
    <>
      {href ? <a href={href} rel="noopener noreferrer" target="_blank">{title}</a> : title}
      <span className="muted"> · {a.feed}</span>
    </>
  );
}

async function loadDay(user: string, date: string) {
  const [digest, weather] = await Promise.all([
    loadDigest(user, date),
    fetch(`data/days/${date.replaceAll("-", "/")}/weather.json`, { cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  return { digest, weather };
}

export function DayPage({ user, date }: { user: string; date: string }) {
  const loaded = useLoad(`day:${user}:${date}`, () => loadDay(user, date));
  return (
    <Show loaded={loaded}>
      {({ digest: d, weather }) => (
        <>
          <Nav>
            <Link to="">首页</Link> · <Link to={user}>{user}</Link> · <Link to={`${user}/${date.slice(0, 7)}`}>{date.slice(0, 7)}</Link>
          </Nav>
          <h1>{date} {weekday(date)} · {user}</h1>
          {weather && <SavedWeather weather={weather} />}
          {d ? <DigestBody d={d} /> : <p className="muted">这天没有日报。</p>}
        </>
      )}
    </Show>
  );
}

export function DigestBody({ d }: { d: Digest }) {
  return (
    <>
      <p className="muted">
        {d.stats.selected} 篇{d.stats.pulled !== undefined && `，共拉取 ${d.stats.pulled} 篇`} · 生成于 {d.generated_at.slice(0, 16).replace("T", " ")}
      </p>
      <div className="card">{d.summary}</div>
      {d.highlights.length > 0 && (
        <>
          <h2>值得读原文</h2>
          <ul>
            {d.highlights.map((h) => (
              <li key={h.article}><ArticleLink a={d.articles[h.article]} /><br /><span className="muted">{h.why}</span></li>
            ))}
          </ul>
        </>
      )}
      {d.sections.map((s) => (
        <section key={s.title}>
          <h2>{s.title}</h2>
          <p className="muted">{s.summary}</p>
          <ul>
            {s.items.map((i) => (
              <li key={i.article}><ArticleLink a={d.articles[i.article]} /><br />{i.note}</li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
