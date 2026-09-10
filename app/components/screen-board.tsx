"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { enterScreensMode, exitScreensMode, isTauriRuntime } from "../lib/native-window";
import { StreamGrid } from "./stream-grid";

export function ScreenBoard() {
  const router = useRouter();
  const leaving = useRef(false);

  const leave = useCallback(async () => {
    if (leaving.current) {
      return;
    }
    leaving.current = true;
    try {
      await exitScreensMode();
    } catch {
      // Browser preview or unsupported runtime.
    }
    router.push("/");
  }, [router]);

  useEffect(() => {
    let unlistenResize: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        await enterScreensMode();
      } catch {
        // Browser preview or unsupported runtime.
      }

      if (cancelled || !isTauriRuntime()) {
        return;
      }

      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      const win = getCurrentWindow();
      let armed = await win.isFullscreen();
      unlistenResize = await win.onResized(async () => {
        if (leaving.current || cancelled) {
          return;
        }
        try {
          const fullscreen = await win.isFullscreen();
          if (fullscreen) {
            armed = true;
            return;
          }
          if (armed) {
            await leave();
          }
        } catch {
          // Ignore compositor races.
        }
      });
    })();

    return () => {
      cancelled = true;
      unlistenResize?.();
      if (!leaving.current) {
        void exitScreensMode().catch(() => undefined);
      }
    };
  }, [leave]);

  return (
    <div className="screens-stage relative h-full w-full">
      <StreamGrid onLeave={leave} />
    </div>
  );
}
