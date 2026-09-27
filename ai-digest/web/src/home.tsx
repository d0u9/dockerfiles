// The home page, in two parts (DESIGN 9.2):
//
// 1. A dashboard exactly one screen high for the latest day: the chosen
//    person's news as a way in, and the weather, clocks, calendar and links
//    everyone shares. Further cards go in columnsFor.
// 2. History: scrolling down reaches a timeline of earlier days. It starts
//    with the latest month and loads the one before whenever its end comes
//    into view, one month file at a time.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Digest, LinkGroup, Month, SiteIndex } from "../../shared/types.ts";
import { loadDigest, loadIndex, loadMonth, safeUrl, useLoad, weekday } from "./data.ts";
import { Timeline } from "./timeline.tsx";
import { Link, Show } from "./ui.tsx";
import { CalendarCard, Clocks, WeatherCard } from "./today.tsx";

interface Today {
  index: SiteIndex;
  date: string;
  digests: Record<string, Digest>;
}

async function loadToday(): Promise<Today | null> {
  const index = await loadIndex();
  const date = index?.latest.date;
  if (!index || !date) return null;
  const users = index.users;
  const found = await Promise.all(users.map((u) => loadDigest(u, date)));
  const digests: Record<string, Digest> = {};
  users.forEach((u, i) => { if (found[i]) digests[u] = found[i]; });
  return { index, date, digests };
}

// The person chosen on the dashboard, kept in this browser only.
const CHOSEN = "ai-digest.person";
function remembered(): string | null {
  try { return localStorage.getItem(CHOSEN); } catch { return null; }
}
function remember(user: string): void {
  try { localStorage.setItem(CHOSEN, user); } catch { /* storage blocked */ }
}

/** The chosen person's news, as a way in: how much there is today, under
 * which sections, and the day's highlights, each linking to its article. The
 * digest itself is on its own page. */
function NewsCard({ user, date, digest }: { user: string; date: string; digest: Digest | undefined }) {
  if (!digest) {
    return <><h2>新闻</h2><p className="muted">{user} 今天还没有日报。</p></>;
  }
  return (
    <>
      <Link className="news-card" to={`${user}/${date}`}>
        <div className="card-head"><h2>新闻</h2><span className="card-more">日报 →</span></div>
        <div className="news-count"><strong>{digest.stats.selected}</strong> 篇</div>
        <div className="muted news-sections">{digest.sections.map((s) => s.title).join(" · ")}</div>
      </Link>
      {digest.highlights.length > 0 && (
        <>
          <h3 className="news-top">今日要点</h3>
          <ol className="highlights">
            {digest.highlights.slice(0, 5).map((h) => {
              const article = digest.articles[h.article];
              if (!article) return null;
              const href = safeUrl(article.url);
              return (
                <li key={h.article} title={h.why}>
                  {href ? <a href={href} rel="noopener noreferrer" target="_blank">{article.title}</a> : article.title}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </>
  );
}

/** The link groups from the configuration, such as where to look up rates,
 * in one card: a small heading per group and its links as chips. */
function LinksCard({ groups }: { groups: LinkGroup[] }) {
  return (
    <>
      {groups.map((group) => (
        <section className="link-group" key={group.title}>
          <h3>{group.title}</h3>
          <div className="chips">
            {group.items.map((item) => {
              const href = safeUrl(item.url);
              return href
                ? <a className="chip" key={item.name} href={href} rel="noopener noreferrer" target="_blank">{item.name} ↗</a>
                : <span className="chip" key={item.name}>{item.name}</span>;
            })}
          </div>
        </section>
      ))}
    </>
  );
}

interface Card { key: string; render: (user: string) => ReactNode }

/**
 * The cards on the dashboard, in columns: the chosen person's news and the
 * link groups; the weather; the clocks and the calendar. Only the news is a
 * person's. A card with nothing to show is left out; an empty column too.
 * Add new kinds of content here.
 */
function columnsFor(t: Today): Card[][] {
  const { weather } = t.index.latest;
  const { clocks, holidays, links } = t.index;
  return [
    [
      { key: "news", render: (user: string) => <NewsCard user={user} date={t.date} digest={t.digests[user]} /> },
      ...(links.some((g) => g.items.length)
        ? [{ key: "links", render: () => <LinksCard groups={links.filter((g) => g.items.length)} /> }]
        : []),
    ],
    weather?.places.length ? [{ key: "weather", render: () => <WeatherCard saved={weather} /> }] : [],
    [
      ...(clocks.length ? [{ key: "clocks", render: () => <Clocks clocks={clocks} /> }] : []),
      { key: "calendar", render: () => <CalendarCard regions={holidays} /> },
    ],
  ].filter((c) => c.length);
}

function Dashboard({ today, onHistory }: { today: Today; onHistory: () => void }) {
  const users = today.index.users;
  const [user, setUser] = useState(() => {
    const r = remembered();
    return r && users.includes(r) ? r : users[0]!;
  });
  const local = new Date();
  const isToday = today.date === [local.getFullYear(), local.getMonth() + 1, local.getDate()]
    .map((n, i) => String(n).padStart(i ? 2 : 4, "0")).join("-");
  const columns = columnsFor(today);
  return (
    <section className="dashboard">
      <header className="dash-head">
        <h1>{isToday ? "今天" : "最新"} <span className="muted">{today.date} {weekday(today.date)}</span></h1>
        {users.length > 1 && (
          <div className="tabs" role="tablist">
            {users.map((u) => (
              <button key={u} role="tab" aria-selected={u === user}
                onClick={() => { setUser(u); remember(u); }}>{u}</button>
            ))}
          </div>
        )}
      </header>
      <div className="dash-grid">
        {columns.map((column) => (
          <div className="dash-col" key={column[0]!.key}>
            {column.map((c) => (
              <div className={`card dash-card dash-${c.key}`} key={c.key}>{c.render(user)}</div>
            ))}
          </div>
        ))}
      </div>
      <nav className="dash-foot muted">
        <button className="linklike" onClick={onHistory}>往日 ↓</button>
        {" · "}<Link to={user}>{user} 的全部日报</Link>{" · "}<Link to="archive">全部月份</Link>
      </nav>
    </section>
  );
}

/** Earlier months, loaded one at a time as the end of the timeline appears. */
function History({ index, skip }: { index: SiteIndex; skip: string }) {
  const [months, setMonths] = useState<Month[]>([]);
  const [next, setNext] = useState(0);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const done = next >= index.months.length;

  useEffect(() => {
    const target = end.current;
    if (!target || done || busy) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      setBusy(true);
      loadMonth(index.months[next]!.month)
        .then((m) => { if (m) setMonths((ms) => [...ms, m]); })
        .catch(() => {})
        .finally(() => { setNext((n) => n + 1); setBusy(false); });
    }, { rootMargin: "600px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [next, busy, done, index]);

  return (
    <section className="history" id="history">
      <h2 className="history-head">往日</h2>
      <Timeline months={months} skip={skip} />
      <div ref={end} className="muted tl-end">
        {done ? (months.length ? "没有更早的了。" : "还没有往日的日报。") : "加载中…"}
      </div>
    </section>
  );
}

type Page = "today" | "history";
const SWITCH_MS = 750;

/**
 * Two pages, switched rather than scrolled: on a wide screen one turn of the
 * wheel, one swipe or one key moves the whole dashboard away and brings the
 * history up, and back again from the top of the history. Inside the history
 * the page scrolls normally. On a narrow screen, where the dashboard is taller
 * than the screen, nothing is intercepted.
 */
function usePageSwitch(ready: boolean): [Page, (to: Page) => void] {
  const [page, setPage] = useState<Page>("today");
  const locked = useRef(false);

  const go = (to: Page) => {
    const history = document.getElementById("history");
    if (!history) return;
    locked.current = true;
    setPage(to);
    const top = to === "today" ? 0 : history.getBoundingClientRect().top + scrollY;
    scrollTo({ top, behavior: "smooth" });
    setTimeout(() => { locked.current = false; }, SWITCH_MS);
  };

  useEffect(() => {
    if (!ready) return;
    const narrow = matchMedia("(max-width: 760px)");
    const historyTop = () => {
      const h = document.getElementById("history");
      return h ? h.getBoundingClientRect().top + scrollY : Infinity;
    };
    /** Whether a move in `direction` switches pages from where the page is now. */
    const switchFor = (direction: 1 | -1): Page | null => {
      const top = historyTop();
      if (direction > 0 && scrollY < top - 2) return "history";
      if (direction < 0 && scrollY <= top + 2 && scrollY > 0) return "today";
      return null;
    };
    const handle = (e: Event, direction: 1 | -1) => {
      if (narrow.matches) return;
      if (locked.current) { e.preventDefault(); return; }
      const to = switchFor(direction);
      if (to) { e.preventDefault(); go(to); }
    };
    const onWheel = (e: WheelEvent) => { if (Math.abs(e.deltaY) > 2) handle(e, e.deltaY > 0 ? 1 : -1); };
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowDown", "PageDown", " "].includes(e.key)) handle(e, 1);
      else if (["ArrowUp", "PageUp"].includes(e.key)) handle(e, -1);
    };
    let startY = 0;
    const onTouchStart = (e: TouchEvent) => { startY = e.touches[0]?.clientY ?? 0; };
    const onTouchMove = (e: TouchEvent) => {
      const dy = startY - (e.touches[0]?.clientY ?? startY);
      if (Math.abs(dy) > 30) handle(e, dy > 0 ? 1 : -1);
    };
    // Keep the pager right when the reader scrolls some other way.
    const onScroll = () => {
      if (!locked.current) setPage(scrollY >= historyTop() - innerHeight / 2 ? "history" : "today");
    };
    addEventListener("wheel", onWheel, { passive: false });
    addEventListener("keydown", onKey);
    addEventListener("touchstart", onTouchStart, { passive: true });
    addEventListener("touchmove", onTouchMove, { passive: false });
    addEventListener("scroll", onScroll, { passive: true });
    return () => {
      removeEventListener("wheel", onWheel);
      removeEventListener("keydown", onKey);
      removeEventListener("touchstart", onTouchStart);
      removeEventListener("touchmove", onTouchMove);
      removeEventListener("scroll", onScroll);
    };
  }, [ready]);

  return [page, go];
}

/** The switch between the two pages, on the right edge. */
function Pager({ page, go }: { page: Page; go: (to: Page) => void }) {
  return (
    <nav className="pager" aria-label="页面">
      {(["today", "history"] as const).map((p) => (
        <button key={p} aria-current={page === p} onClick={() => go(p)}>
          <span className="pager-dot" /><span className="pager-label">{p === "today" ? "今天" : "往日"}</span>
        </button>
      ))}
    </nav>
  );
}

export function Home() {
  const loaded = useLoad("today", loadToday);
  const [page, go] = usePageSwitch(loaded.state === "done" && loaded.value !== null);
  return (
    <Show loaded={loaded}>
      {(today) => today ? (
        <div className={`pages on-${page}`}>
          <Dashboard today={today} onHistory={() => go("history")} />
          <History index={today.index} skip={today.date} />
          <Pager page={page} go={go} />
        </div>
      ) : <><h1>日报</h1><p>还没有日报。</p></>}
    </Show>
  );
}
