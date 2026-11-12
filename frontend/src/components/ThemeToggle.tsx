"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "@phosphor-icons/react";

type Theme = "light" | "dark";

const listeners = new Set<() => void>();

function current(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0f121a" : "#ffffff");
  try {
    localStorage.setItem("theme", theme);
  } catch {}
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export default function ThemeToggle({ withLabel = false }: { withLabel?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  if (withLabel) {
    return (
      <button
        onClick={() => apply(next)}
        className="flex h-12 w-full items-center gap-3 rounded-lg px-3 text-[15px] font-medium text-zinc-700 hover:bg-zinc-50"
      >
        {theme === "dark" ? <Sun size={20} className="text-zinc-500" /> : <Moon size={20} className="text-zinc-500" />}
        {theme === "dark" ? "Light mode" : "Dark mode"}
      </button>
    );
  }

  return (
    <button
      onClick={() => apply(next)}
      aria-label={label}
      title={label}
      className="grid size-10 shrink-0 place-items-center rounded-full text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
    >
      {theme === "dark" ? <Sun size={21} /> : <Moon size={21} />}
    </button>
  );
}

export const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="dark"?"#0f121a":"#ffffff")}catch(e){}})()`;
