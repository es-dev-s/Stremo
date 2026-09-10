"use client";

import { useEffect } from "react";
import { applyTheme, readThemePref } from "../lib/theme";

export function ThemeBoot() {
  useEffect(() => {
    applyTheme(readThemePref());

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(readThemePref());
    media.addEventListener("change", onChange);
    window.addEventListener("stremo-theme", onChange);
    window.addEventListener("storage", onChange);

    return () => {
      media.removeEventListener("change", onChange);
      window.removeEventListener("stremo-theme", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  return null;
}
