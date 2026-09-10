"use client";

import { Moon, Sun } from "lucide-react";
import { toggleTheme } from "../lib/theme";

export function ThemeToggle() {
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      title="Toggle theme"
      onClick={toggleTheme}
      className="icon-btn flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)]"
    >
      <Sun size={14} strokeWidth={1.8} className="hidden dark:inline" aria-hidden="true" />
      <Moon size={14} strokeWidth={1.8} className="inline dark:hidden" aria-hidden="true" />
    </button>
  );
}
