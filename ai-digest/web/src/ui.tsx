// Small pieces used by every page.

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import type { Loaded } from "./data.ts";

export function Show<T>({ loaded, children }: { loaded: Loaded<T>; children: (value: T) => ReactNode }) {
  if (loaded.state === "loading") return <p className="muted">加载中…</p>;
  if (loaded.state === "error") return <p className="muted">加载失败：{loaded.error}</p>;
  return <>{children(loaded.value)}</>;
}

export function Nav({ children }: { children: ReactNode }) {
  return <nav className="muted">{children}</nav>;
}

export function Link({ to, children, className }: { to: string; children: ReactNode; className?: string }) {
  return <a href={`#/${to}`} className={className}>{children}</a>;
}

/**
 * A box that scrolls without a scroll bar. While more is below, its bottom
 * fades out and a small button says so; the button scrolls down a page.
 */
export function Scroller({ children, className = "" }: { children: ReactNode; className?: string }) {
  const body = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  useEffect(() => {
    const el = body.current;
    if (!el) return;
    const check = () => setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
    check();
    el.addEventListener("scroll", check, { passive: true });
    // Content arrives late (live weather, rates), and the window resizes.
    const resize = new ResizeObserver(check);
    resize.observe(el);
    const mutate = new MutationObserver(check);
    mutate.observe(el, { childList: true, subtree: true, characterData: true });
    return () => { el.removeEventListener("scroll", check); resize.disconnect(); mutate.disconnect(); };
  }, []);
  return (
    <div className={`scroller ${className}`} data-more={more || undefined}>
      <div className="scroller-body" ref={body}>{children}</div>
      <button type="button" className="scroller-more" tabIndex={-1} aria-hidden="true"
        onClick={() => body.current?.scrollBy({ top: body.current.clientHeight * 0.8, behavior: "smooth" })}>
        更多 <span aria-hidden="true">↓</span>
      </button>
    </div>
  );
}

/** Whether a media query matches, kept current as the window changes. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const list = matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener("change", update);
    return () => list.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** A phone, where the dashboard is one list; the same query as in style.css. */
export const PHONE = "(max-width: 760px)";

const Chevron = ({ up }: { up?: boolean }) => (
  <svg className="fold-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={up ? "M4 10l4-4 4 4" : "M4 6l4 4 4-4"} />
  </svg>
);

/**
 * On a phone, a card folded to its head and one line that says what matters
 * in it; a tap anywhere on it opens the whole card, and a button at the end
 * folds it again. Elsewhere the card is always open.
 */
export function Fold({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  const phone = useMedia(PHONE);
  const [open, setOpen] = useState(false);
  if (!phone) return <>{children}</>;
  if (!open) {
    return (
      <button type="button" className="fold" aria-expanded="false" aria-label={`展开${title}`} onClick={() => setOpen(true)}>
        <span className="card-head"><h2>{title}</h2><Chevron /></span>
        <span className="fold-summary">{summary}</span>
      </button>
    );
  }
  // Open, a tap on the card's head folds it again, as does the button at the end.
  const foldFromHead = (e: MouseEvent) => {
    const target = e.target as Element;
    if (target.closest(".card-head") && !target.closest("button, a")) setOpen(false);
  };
  return (
    <div className="fold-open" onClick={foldFromHead}>
      {children}
      <button type="button" className="fold-close" aria-expanded="true" onClick={() => setOpen(false)}>
        收起 <Chevron up />
      </button>
    </div>
  );
}
