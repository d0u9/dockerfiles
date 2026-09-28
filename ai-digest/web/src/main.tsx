// Hash routes, so the web server needs no rewrite rules (DESIGN 9.2):
//
//   #/                    home: today, then the history as a timeline
//   #/home/alice          the same, with alice's news: a bookmark for her
//   #/2026-09             a month
//   #/archive             every month
//   #/alice               alice's months
//   #/alice/2026-09       alice's days in a month
//   #/alice/2026-09-27    one digest
//   #/alice/2026-09-27/2  the same, opened at its second section

import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Home } from "./home.tsx";
import { Archive, DayPage, MonthPage, Person, PersonMonth } from "./pages.tsx";
import "./style.css";

const MONTH = /^\d{4}-\d{2}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/;

function route(hash: string) {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const [a, b, c] = parts;
  if (parts.length === 0) return <Home />;
  if (parts.length === 1 && a === "archive") return <Archive />;
  if (parts.length === 2 && a === "home" && NAME.test(b!)) return <Home user={b!} />;
  if (parts.length === 1 && MONTH.test(a!)) return <MonthPage month={a!} />;
  if (parts.length === 1 && NAME.test(a!)) return <Person user={a!} />;
  if (parts.length === 2 && NAME.test(a!) && MONTH.test(b!)) return <PersonMonth user={a!} month={b!} />;
  if (parts.length === 2 && NAME.test(a!) && DATE.test(b!)) return <DayPage user={a!} date={b!} />;
  if (parts.length === 3 && NAME.test(a!) && DATE.test(b!) && /^\d{1,2}$/.test(c!)) {
    return <DayPage user={a!} date={b!} section={Number(c)} />;
  }
  return <p>没有这个页面。<a href="#/">回首页</a></p>;
}

function App() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => {
    const update = () => {
      setHash(location.hash);
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return <main key={hash}>{route(hash)}</main>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
