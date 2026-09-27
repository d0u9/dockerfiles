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
import { Link, Scroller, Show } from "./ui.tsx";
import { MarketsCard } from "./markets.tsx";
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

/**
 * The chosen person's news: the day's summary to read first, the articles
 * most worth opening, then the sections as a way into the full digest. What
 * does not fit scrolls inside the card.
 */
function NewsCard({ user, date, digest }: { user: string; date: string; digest: Digest | undefined }) {
  if (!digest) {
    return <><div className="card-head"><h2>新闻</h2></div><p className="muted">{user} 今天还没有日报。</p></>;
  }
  const { stats } = digest;
  return (
    <>
      <div className="card-head">
        <h2>新闻</h2>
        <Link className="card-action" to={`${user}/${date}`}>读完整日报 →</Link>
      </div>
      <Scroller className="news-scroll">
        <p className="news-stats">
          精选 <strong>{stats.selected}</strong> 篇{stats.pulled !== undefined && <> · 共读 {stats.pulled} 篇</>}
          {" · "}{digest.sections.length} 个分组
        </p>
        <p className="news-lead">{digest.summary}</p>
        {digest.highlights.length > 0 && (
          <section>
            <h3 className="news-label">值得读原文</h3>
            <ol className="picks">
              {digest.highlights.slice(0, 5).map((h) => {
                const article = digest.articles[h.article];
                if (!article) return null;
                const href = safeUrl(article.url);
                return (
                  <li key={h.article}>
                    {href
                      ? <a className="pick-title" href={href} rel="noopener noreferrer" target="_blank">{article.title}</a>
                      : <span className="pick-title">{article.title}</span>}
                    <span className="pick-meta">{article.feed}</span>
                    <span className="pick-why">{h.why}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        )}
        <section>
          <h3 className="news-label">分组</h3>
          <div className="chips">
            {digest.sections.map((s, i) => (
              <Link className="chip" to={`${user}/${date}/${i + 1}`} key={s.title}>
                {s.title}<span className="chip-count">{s.items.length}</span>
              </Link>
            ))}
          </div>
        </section>
      </Scroller>
    </>
  );
}

/** The link groups from the configuration, such as where to look up rates,
 * in one card: a small heading per group and its links as chips. */
function LinksCard({ groups }: { groups: LinkGroup[] }) {
  return (
    <>
      <div className="card-head"><h2>链接</h2></div>
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
 * The cards on the dashboard, in three columns read left to right by weight:
 * the chosen person's news, the only card that is a person's, gets the widest
 * column; then the weather and the calendar; then the clocks, the markets
 * and the links. A card with nothing to show is left out; an empty column
 * too. On a phone the cards become one list, in the order the stylesheet
 * gives them. Add new kinds of content here.
 */
function columnsFor(t: Today): Card[][] {
  const { weather, markets: savedMarkets } = t.index.latest;
  const { clocks, holidays, links, markets } = t.index;
  const hasMarkets = markets.rates.length > 0 || markets.quotes.length > 0 || savedMarkets !== null;
  return [
    [{ key: "news", render: (user: string) => <NewsCard user={user} date={t.date} digest={t.digests[user]} /> }],
    [
      ...(weather?.places.length ? [{ key: "weather", render: () => <WeatherCard saved={weather} /> }] : []),
      { key: "calendar", render: () => <CalendarCard regions={holidays} /> },
    ],
    [
      ...(clocks.length ? [{ key: "clocks", render: () => <Clocks clocks={clocks} /> }] : []),
      ...(hasMarkets ? [{ key: "markets", render: () => <MarketsCard config={markets} saved={savedMarkets} /> }] : []),
      ...(links.some((g) => g.items.length)
        ? [{ key: "links", render: () => <LinksCard groups={links.filter((g) => g.items.length)} /> }]
        : []),
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
        <div>
          <h1>{Number(today.date.slice(5, 7))}月{Number(today.date.slice(8))}日 {weekday(today.date)}</h1>
          <p className="dash-sub">{isToday ? "今天的日报" : `最新一期是 ${today.date} 的`}</p>
        </div>
        {users.length > 1 && (
          <div className="tabs" role="tablist" aria-label="读谁的日报">
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
              <div className={`card dash-card dash-${c.key}`} key={c.key}>
                {c.key === "news" ? c.render(user) : <Scroller>{c.render(user)}</Scroller>}
              </div>
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
/** Where the dashboard is taller than the screen and scrolls like any page;
 * the same query as in style.css. */
const SCROLLING = "(max-width: 1100px), (max-height: 680px)";
const SWITCH_MS = 750;

/**
 * Two pages, switched rather than scrolled: on a wide screen one turn of the
 * wheel, one swipe or one key moves the whole dashboard away and brings the
 * history up, and back again from the top of the history. Inside the history
 * the page scrolls normally. Where the dashboard is taller than the screen
 * (SCROLLING), nothing is intercepted, and neither is a wheel or swipe over
 * a card that scrolls its own content.
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
    const narrow = matchMedia(SCROLLING);
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
    /** A card with more than fits scrolls itself: a wheel or swipe over it,
     *  even at its end, never switches pages, or a reader running through a
     *  card would land in the history. */
    const inScroller = (e: Event) => {
      const box = (e.target as Element | null)?.closest?.(".scroller-body");
      return !!box && box.scrollHeight > box.clientHeight + 1;
    };
    const handle = (e: Event, direction: 1 | -1) => {
      if (narrow.matches) return;
      if (e.type !== "keydown" && inScroller(e)) return;
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
