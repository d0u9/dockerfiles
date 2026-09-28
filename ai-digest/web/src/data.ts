// Loading the website's data (DESIGN 9.1). Every file is fetched once per
// page load and kept; `index` rewrites them atomically, so a reload is enough
// to see a new day.

import { useEffect, useState } from "react";
import type { Digest, Month, SiteIndex } from "../../shared/types.ts";

const cache = new Map<string, Promise<unknown>>();

/** A data file, or null when it does not exist. */
function load<T>(path: string): Promise<T | null> {
  const hit = cache.get(path);
  if (hit) return hit as Promise<T | null>;
  const p = fetch(`data/${path}`, { cache: "no-cache" }).then((r): Promise<T | null> | null => {
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json() as Promise<T>;
  });
  // A failure is not remembered: the next visit tries again.
  p.catch(() => cache.delete(path));
  cache.set(path, p);
  return p;
}

export const loadIndex = () => load<SiteIndex>("index.json");
export const loadMonth = (month: string) => load<Month>(`months/${month}.json`);
export const loadDigest = (user: string, date: string) =>
  load<Digest>(`days/${date.replaceAll("-", "/")}/${user}.json`);

export type Loaded<T> = { state: "loading" } | { state: "error"; error: string } | { state: "done"; value: T };

/** Run a loader whenever its key changes; the latest call wins. */
export function useLoad<T>(key: string, loader: () => Promise<T>): Loaded<T> {
  const [result, setResult] = useState<Loaded<T>>({ state: "loading" });
  useEffect(() => {
    let live = true;
    setResult({ state: "loading" });
    loader().then(
      (value) => live && setResult({ state: "done", value }),
      (e: unknown) => live && setResult({ state: "error", error: String(e) }),
    );
    return () => { live = false; };
    // The key stands for the loader's inputs.
  }, [key]);
  return result;
}

// ---- dates -------------------------------------------------------------------

/** The date `n` days before an ISO date, as an ISO date. */
export function daysBefore(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

export function monthShift(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

export function weekday(date: string): string {
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()]!;
}

/** Only http and https links are followed: the data came from outside sites
 * and from a model. */
export function safeUrl(url: string): string | undefined {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:" ? u.href : undefined;
  } catch {
    return undefined;
  }
}
