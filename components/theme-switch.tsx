"use client";
import { useEffect, useSyncExternalStore } from "react";
type Preference = "system" | "light" | "dark";
const key = "yuvabe-theme";
function snapshot(): Preference {
  try { const value = localStorage.getItem(key); return value === "light" || value === "dark" ? value : "system"; } catch { return "system"; }
}
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("yuvabe-theme-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("yuvabe-theme-change", callback); };
}
export function ThemeSwitch() {
  const preference = useSyncExternalStore(subscribe, snapshot, () => "system" as Preference);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => { document.documentElement.dataset.theme = preference === "system" ? media.matches ? "dark" : "light" : preference; };
    apply(); media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [preference]);
  return <label className="theme-control"><span aria-hidden="true">◐</span><select aria-label="Color theme" value={preference} onChange={(event) => {
    const next = event.target.value as Preference;
    try { localStorage.setItem(key, next); } catch { document.documentElement.dataset.theme = next === "system" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" : next; }
    window.dispatchEvent(new Event("yuvabe-theme-change"));
  }}><option value="system">System theme</option><option value="light">Light theme</option><option value="dark">Dark theme</option></select></label>;
}
