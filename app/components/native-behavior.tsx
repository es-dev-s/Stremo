"use client";

import { useEffect } from "react";

function isEditable(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

function isZoomKey(event: KeyboardEvent) {
  if (!(event.ctrlKey || event.metaKey)) {
    return false;
  }

  return ["+", "-", "=", "_", "0", "Add", "Subtract"].includes(event.key);
}

export function NativeBehavior() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isZoomKey(event)) {
        event.preventDefault();
      }
    };

    const onGesture = (event: Event) => {
      event.preventDefault();
    };

    const onContextMenu = (event: MouseEvent) => {
      if (!isEditable(event.target)) {
        event.preventDefault();
      }
    };

    const onDragStart = (event: DragEvent) => {
      if (event.target instanceof HTMLImageElement) {
        event.preventDefault();
      }
    };

    document.addEventListener("wheel", onWheel, { passive: false });
    document.addEventListener("keydown", onKeyDown, { capture: true });
    document.addEventListener("gesturestart", onGesture);
    document.addEventListener("gesturechange", onGesture);
    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("dragstart", onDragStart);

    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/webview")
        .then(async ({ getCurrentWebview }) => {
          await getCurrentWebview().setZoom(1);
        })
        .catch(() => undefined);
    }

    return () => {
      document.removeEventListener("wheel", onWheel);
      document.removeEventListener("keydown", onKeyDown, { capture: true });
      document.removeEventListener("gesturestart", onGesture);
      document.removeEventListener("gesturechange", onGesture);
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("dragstart", onDragStart);
    };
  }, []);

  return null;
}
