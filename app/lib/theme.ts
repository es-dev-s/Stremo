export const THEME_KEY = "stremo-theme";

export type ThemePref = "light" | "dark" | "system";
export type ThemeMode = "light" | "dark";

export function readThemePref(): ThemePref {
  if (typeof window === "undefined") {
    return "system";
  }

  const value = window.localStorage.getItem(THEME_KEY);
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

export function resolveTheme(pref: ThemePref): ThemeMode {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return pref;
}

export function applyTheme(pref: ThemePref) {
  const mode = resolveTheme(pref);
  const root = document.documentElement;
  root.classList.toggle("dark", mode === "dark");
  root.dataset.theme = pref;
  root.style.colorScheme = mode;
  return mode;
}

export function setThemePref(pref: ThemePref) {
  window.localStorage.setItem(THEME_KEY, pref);
  const mode = applyTheme(pref);
  window.dispatchEvent(new Event("stremo-theme"));
  syncNativeTheme(mode);
  return mode;
}

export function toggleTheme() {
  const next: ThemePref = resolveTheme(readThemePref()) === "dark" ? "light" : "dark";
  setThemePref(next);
}

function syncNativeTheme(mode: ThemeMode) {
  if (!("__TAURI_INTERNALS__" in window)) {
    return;
  }

  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setTheme(mode))
    .catch(() => {
      // Theme sync is best-effort on unsupported hosts.
    });

  void import("@tauri-apps/api/app")
    .then(({ setTheme }) => setTheme(mode))
    .catch(() => {
      // App theme API is optional.
    });
}
