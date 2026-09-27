// The history as a timeline: a vertical line with one node per day, newest
// first. Month headers stick to the top while their days scroll past, and on
// a wide screen each day's date sticks beside its entries.

import type { Month } from "../../shared/types.ts";
import { weekday } from "./data.ts";
import { Link } from "./ui.tsx";
import { WeatherStrip } from "./weather.tsx";

type Day = Month["days"][number];

function TimelineDay({ day, users }: { day: Day; users: string[] }) {
  const [, m, d] = day.date.split("-");
  return (
    <li className="tl-day">
      <div className="tl-date">
        <span className="tl-dot" aria-hidden="true" />
        <span className="tl-md">{Number(m)}月{Number(d)}日</span>
        <span className="muted">{weekday(day.date)}</span>
      </div>
      <div className="tl-body">
        <WeatherStrip places={day.weather} />
        <div className="people">
          {users.map((user) => {
            const s = day.digests[user];
            if (!s) {
              return (
                <div className="card day empty" key={user}>
                  <strong>{user}</strong><p className="muted">这天没有日报。</p>
                </div>
              );
            }
            return (
              <Link className="card day" to={`${user}/${day.date}`} key={user}>
                <strong>{user}</strong> <span className="muted">· {s.selected} 篇</span>
                {s.top && <p className="top">{s.top}</p>}
                <p className="summary">{s.summary}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </li>
  );
}

/** Months newest first, each with its days newest first. `skip` leaves out
 * days shown elsewhere, such as the one on the home page's first screen. */
export function Timeline({ months, skip }: { months: Month[]; skip?: string }) {
  return (
    <div className="timeline">
      {months.map((m) => {
        const days = m.days.filter((d) => d.date !== skip);
        if (!days.length) return null;
        return (
          <section className="tl-month" key={m.month}>
            <h2 className="tl-month-head">
              <Link to={m.month}>{m.month.slice(0, 4)} 年 {Number(m.month.slice(5))} 月</Link>
            </h2>
            <ol className="tl-days">
              {days.map((d) => <TimelineDay day={d} users={m.users} key={d.date} />)}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
