"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark";

const storageKey = "classroom-ready-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function setDocumentTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "light" ? "#fbfaf7" : "#191816");
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(storageKey);
    const currentTheme = document.documentElement.dataset.theme || null;
    const nextTheme = isThemeMode(savedTheme) ? savedTheme : isThemeMode(currentTheme) ? currentTheme : "light";
    applyTheme(nextTheme);
  }, []);

  function applyTheme(nextTheme: ThemeMode) {
    setDocumentTheme(nextTheme);
    window.localStorage.setItem(storageKey, nextTheme);
    setTheme(nextTheme);
  }

  return (
    <div
      className={`grid grid-cols-2 gap-1 rounded-[8px] border border-border bg-[var(--surface2)] p-1 ${compact ? "w-[96px]" : ""}`}
      aria-label="Mode tampilan"
    >
      <button
        type="button"
        onClick={() => applyTheme("light")}
        aria-pressed={theme === "light"}
        className={`tap-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] px-2 text-[11px] font-bold ${
          theme === "light" ? "bg-card text-[var(--heading)] shadow-sm" : "text-muted"
        }`}
      >
        <Sun size={14} />
        <span className={compact ? "sr-only" : ""}>Light</span>
      </button>
      <button
        type="button"
        onClick={() => applyTheme("dark")}
        aria-pressed={theme === "dark"}
        className={`tap-target inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[6px] px-2 text-[11px] font-bold ${
          theme === "dark" ? "bg-card text-[var(--heading)] shadow-sm" : "text-muted"
        }`}
      >
        <Moon size={14} />
        <span className={compact ? "sr-only" : ""}>Dark</span>
      </button>
    </div>
  );
}
