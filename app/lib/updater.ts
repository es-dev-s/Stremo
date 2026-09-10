"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Update } from "@tauri-apps/plugin-updater";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "downloading"
  | "ready"
  | "installing"
  | "error";

export type UpdateState = {
  phase: UpdatePhase;
  version: string;
  notes: string;
  progress: number;
  error: string | null;
};

const IDLE: UpdateState = {
  phase: "idle",
  version: "",
  notes: "",
  progress: 0,
  error: null,
};

// Long-running wall sessions still need to pick up releases.
const RECHECK_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 4000;
const RETRY_MS = 15 * 60 * 1000;

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Downloads updates automatically in the background and stays in `ready` until
 * the caller decides it is safe to restart. Download and install are kept
 * separate on purpose: installing terminates the app, which must never happen
 * mid-stream.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>(IDLE);
  const pending = useRef<Update | null>(null);
  const busy = useRef(false);
  const disposed = useRef(false);

  const checkAndDownload = useCallback(async () => {
    if (!isTauriRuntime() || busy.current || pending.current) {
      return;
    }
    busy.current = true;
    setState((prev) => (prev.phase === "idle" ? { ...prev, phase: "checking" } : prev));

    try {
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (!update) {
        if (!disposed.current) setState(IDLE);
        return;
      }
      if (disposed.current) {
        return;
      }

      pending.current = update;
      setState({
        phase: "downloading",
        version: update.version,
        notes: update.body ?? "",
        progress: 0,
        error: null,
      });

      let total = 0;
      let received = 0;
      await update.download((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          return;
        }
        if (event.event === "Progress") {
          received += event.data.chunkLength;
          const ratio = total > 0 ? Math.min(1, received / total) : 0;
          if (!disposed.current) {
            setState((prev) => ({ ...prev, progress: ratio }));
          }
        }
      });

      if (!disposed.current) {
        setState((prev) => ({ ...prev, phase: "ready", progress: 1 }));
      }
    } catch (error) {
      pending.current = null;
      if (!disposed.current) {
        setState({
          ...IDLE,
          phase: "error",
          error: error instanceof Error ? error.message : "Update download failed",
        });
      }
    } finally {
      busy.current = false;
    }
  }, []);

  /** Applies the staged update and restarts. Only call when no stream is live. */
  const install = useCallback(async () => {
    const update = pending.current;
    if (!update || busy.current) {
      return;
    }
    busy.current = true;
    setState((prev) => ({ ...prev, phase: "installing" }));
    try {
      await update.install();
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "Update install failed",
      }));
      busy.current = false;
    }
  }, []);

  /** Keeps the download staged; it will be applied on the next app start. */
  const postpone = useCallback(() => {
    setState(IDLE);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    disposed.current = false;
    const first = setTimeout(() => void checkAndDownload(), FIRST_CHECK_DELAY_MS);
    const timer = setInterval(() => void checkAndDownload(), RECHECK_MS);
    // A failed check (offline, GitHub blip) retries sooner than the slow loop.
    const retry = setInterval(() => {
      if (!pending.current) {
        void checkAndDownload();
      }
    }, RETRY_MS);

    return () => {
      disposed.current = true;
      clearTimeout(first);
      clearInterval(timer);
      clearInterval(retry);
    };
  }, [checkAndDownload]);

  return { state, install, postpone };
}
