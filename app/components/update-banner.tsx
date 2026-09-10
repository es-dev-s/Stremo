"use client";

import { useUpdater } from "../lib/updater";

export function UpdateBanner() {
  const { state, install, dismiss } = useUpdater();

  if (state.phase === "idle" || state.phase === "checking") {
    return null;
  }

  const downloading = state.phase === "downloading";
  const ready = state.phase === "ready";
  const failed = state.phase === "error";
  const percent = Math.round(state.progress * 100);

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <div className="update-toast-body">
        <p className="update-toast-title">
          {failed
            ? "Update failed"
            : ready
              ? "Restarting to finish update…"
              : downloading
                ? `Downloading ${state.version}`
                : `Version ${state.version} is available`}
        </p>
        <p className="update-toast-note">
          {failed ? state.error : downloading ? `${percent}%` : state.notes || "Install to get the latest build."}
        </p>
        {downloading ? (
          <div className="update-progress" aria-hidden="true">
            <span style={{ width: `${percent}%` }} />
          </div>
        ) : null}
      </div>
      {downloading || ready ? null : (
        <div className="update-toast-actions">
          <button type="button" className="update-btn-ghost" onClick={dismiss}>
            Later
          </button>
          {failed ? null : (
            <button type="button" className="update-btn" onClick={() => void install()}>
              Install
            </button>
          )}
        </div>
      )}
    </div>
  );
}
