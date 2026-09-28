// Small pieces used by every page.

import { useEffect, useRef, useState, type ReactNode } from "react";
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
