"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useUpdater } from "../lib/updater";

// Grace period before an update applies itself, so a restart is never a surprise.
const AUTO_RESTART_SECONDS = 10;

/**
 * Mounts only once a restart is armed, so the countdown always starts fresh
 * and never needs resetting.
 */
function RestartCountdown({ onFire }: { onFire: () => void }) {
  const [left, setLeft] = useState(AUTO_RESTART_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left === 0) {
      onFire();
    }
  }, [left, onFire]);

  return <>Restarting in {left}s</>;
}

export function UpdateBanner() {
  const { state, install, postpone } = useUpdater();
  const pathname = usePathname() ?? "/";
  const watching = pathname === "/screens";

  const staged = state.phase === "ready";
  // Never restart out from under a live video wall.
  const armed = staged && !watching;

  if (state.phase === "idle" || state.phase === "checking") {
    return null;
  }

  // Downloading stays silent on the wall so the panes stay clean.
  if (state.phase === "downloading" && watching) {
    return null;
  }

  const downloading = state.phase === "downloading";
  const installing = state.phase === "installing";
  const failed = state.phase === "error";
  const percent = Math.round(state.progress * 100);

  return (
    <div className={`update-toast ${watching ? "is-quiet" : ""}`} role="status" aria-live="polite">
      <div className="update-toast-body">
        <p className="update-toast-title">
          {failed ? (
            "Update failed"
          ) : installing ? (
            "Installing update…"
          ) : downloading ? (
            `Downloading ${state.version}`
          ) : armed ? (
            <RestartCountdown onFire={install} />
          ) : (
            `Version ${state.version} ready`
          )}
        </p>
        <p className="update-toast-note">
          {failed
            ? state.error
            : installing
              ? "Stremo will reopen automatically."
              : downloading
                ? `${percent}%`
                : armed
                  ? state.notes || `Updating to ${state.version}.`
                  : "Applies when you leave the wall."}
        </p>
        {downloading ? (
          <div className="update-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </div>
      {armed ? (
        <div className="update-toast-actions">
          <button type="button" className="update-btn-ghost" onClick={postpone}>
            Later
          </button>
          <button type="button" className="update-btn" onClick={() => void install()}>
            Restart
          </button>
        </div>
      ) : null}
    </div>
  );
}
