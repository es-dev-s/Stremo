"use client";

import { useSyncExternalStore } from "react";
import {
  readThemePref,
  setThemePref,
  type ThemePref,
} from "../lib/theme";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("stremo-theme", onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener("stremo-theme", onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

const options: { id: ThemePref; label: string }[] = [
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
  { id: "system", label: "System" },
];

export function AppearanceSettings() {
  const pref = useSyncExternalStore(subscribe, readThemePref, () => "system" as ThemePref);

  return (
    <section className="dash-card rounded-[20px] p-4">
      <h2 className="text-[13px] font-semibold tracking-tight text-ink">Appearance</h2>
      <p className="mt-1 text-[12px] text-muted">Switch the shell without a flash or reload.</p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-soft p-1">
        {options.map((option) => {
          const active = pref === option.id;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => setThemePref(option.id)}
              className={`h-8 rounded-lg text-[12px] font-medium transition-colors ${
                active ? "btn-accent shadow-sm" : "text-muted"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
