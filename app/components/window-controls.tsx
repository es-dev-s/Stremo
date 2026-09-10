"use client";

import { useCallback, type PointerEvent } from "react";
import { Minus, X } from "lucide-react";

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function WindowControls() {
  const minimize = useCallback(async () => {
    if (!isTauriRuntime()) {
      return;
    }
    await (await currentWindow()).minimize();
  }, []);

  const close = useCallback(async () => {
    if (!isTauriRuntime()) {
      return;
    }
    await (await currentWindow()).close();
  }, []);

  return (
    <div className="caption-controls" role="group" aria-label="Window">
      <button
        type="button"
        aria-label="Minimize"
        title="Minimize"
        onClick={minimize}
        className="caption-btn caption-min"
      >
        <Minus size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Close"
        title="Close"
        onClick={close}
        className="caption-btn caption-close"
      >
        <X size={12} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export function TitlebarDrag() {
  const onPointerDown = useCallback(async (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !isTauriRuntime()) {
      return;
    }

    try {
      await (await currentWindow()).startDragging();
    } catch {
      // Web preview and unsupported runtimes ignore drag.
    }
  }, []);

  return (
    <div
      data-tauri-drag-region
      onPointerDown={onPointerDown}
      className="titlebar-drag min-w-4 flex-1 self-stretch"
    />
  );
}
