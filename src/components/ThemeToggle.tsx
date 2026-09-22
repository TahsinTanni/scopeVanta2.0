"use client";

import { useEffect, useState } from "react";

type Mode = "system" | "light" | "dark";
const KEY = "scopevanta:theme";
const ORDER: Mode[] = ["system", "light", "dark"];
const ICON: Record<Mode, string> = { system: "brightness_auto", light: "light_mode", dark: "dark_mode" };
const LABEL: Record<Mode, string> = { system: "System theme", light: "Light theme", dark: "Dark theme" };

function apply(mode: Mode) {
  const resolved = mode === "system" ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : mode;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

// Cycles System -> Light -> Dark -> System. Mirrors the theme-init script in
// the root layout so the very first paint already matches this choice.
export default function ThemeToggle({ collapsed }: { collapsed?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(KEY) as Mode | null;
      if (saved && ORDER.includes(saved)) setMode(saved);
    } catch {}
  }, []);

  useEffect(() => {
    if (!mounted) return;
    apply(mode);
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode, mounted]);

  function cycle() {
    const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={cycle}
      title={LABEL[mode]}
      aria-label={`Theme: ${LABEL[mode]}. Click to change.`}
      className="flex shrink-0 items-center gap-2 rounded-[4px] p-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink-primary"
    >
      <span className="material-symbols-outlined text-[18px]">{mounted ? ICON[mode] : "brightness_auto"}</span>
      <span className={`text-xs font-mono ${collapsed ? "lg:hidden" : ""}`}>{LABEL[mode]}</span>
    </button>
  );
}
