"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
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

// Re-check periodically so long-running kiosk sessions still pick up releases.
const RECHECK_MS = 6 * 60 * 60 * 1000;
const FIRST_CHECK_DELAY_MS = 4000;

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export function useUpdater() {
  const [state, setState] = useState<UpdateState>(IDLE);
  // The pending Update handle is not serialisable, so it lives outside React state.
  const pending = useRef<{ downloadAndInstall: (cb: (event: unknown) => void) => Promise<void> } | null>(null);
  const busy = useRef(false);

  const check = useCallback(async (silent: boolean) => {
    if (!isTauriRuntime() || busy.current) {
      return;
    }
    busy.current = true;
    if (!silent) {
      setState((prev) => ({ ...prev, phase: "checking", error: null }));
    }
    try {
      const { check: checkUpdate } = await import("@tauri-apps/plugin-updater");
      const update = await checkUpdate();
      if (!update) {
        setState(silent ? IDLE : { ...IDLE, phase: "idle" });
        return;
      }
      pending.current = update as unknown as typeof pending.current;
      setState({
        phase: "available",
        version: update.version,
        notes: update.body ?? "",
        progress: 0,
        error: null,
      });
    } catch (error) {
      if (silent) {
        setState(IDLE);
        return;
      }
      setState({
        ...IDLE,
        phase: "error",
        error: error instanceof Error ? error.message : "Update check failed",
      });
    } finally {
      busy.current = false;
    }
  }, []);

  const install = useCallback(async () => {
    const update = pending.current;
    if (!update || busy.current) {
      return;
    }
    busy.current = true;
    setState((prev) => ({ ...prev, phase: "downloading", progress: 0, error: null }));

    let total = 0;
    let received = 0;

    try {
      await update.downloadAndInstall((event) => {
        const step = event as { event: string; data?: { contentLength?: number; chunkLength?: number } };
        if (step.event === "Started") {
          total = step.data?.contentLength ?? 0;
          return;
        }
        if (step.event === "Progress") {
          received += step.data?.chunkLength ?? 0;
          const ratio = total > 0 ? Math.min(1, received / total) : 0;
          setState((prev) => ({ ...prev, progress: ratio }));
          return;
        }
        if (step.event === "Finished") {
          setState((prev) => ({ ...prev, progress: 1 }));
        }
      });

      setState((prev) => ({ ...prev, phase: "ready", progress: 1 }));
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        phase: "error",
        error: error instanceof Error ? error.message : "Update failed",
      }));
    } finally {
      busy.current = false;
    }
  }, []);

  const dismiss = useCallback(() => {
    pending.current = null;
    setState(IDLE);
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }
    // Delay the first check so it never competes with app boot.
    const first = setTimeout(() => void check(true), FIRST_CHECK_DELAY_MS);
    const timer = setInterval(() => void check(true), RECHECK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [check]);

  return { state, check, install, dismiss };
}
