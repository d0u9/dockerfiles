// Small pieces used by every page.

import type { ReactNode } from "react";
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
