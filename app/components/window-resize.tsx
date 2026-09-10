"use client";

import { useCallback, useEffect, type PointerEvent } from "react";

type ResizeDirection =
  | "East"
  | "North"
  | "NorthEast"
  | "NorthWest"
  | "South"
  | "SouthEast"
  | "SouthWest"
  | "West";

const edges: { dir: ResizeDirection; className: string }[] = [
  { dir: "North", className: "inset-x-2 top-0 h-1.5 cursor-n-resize" },
  { dir: "South", className: "inset-x-2 bottom-0 h-1.5 cursor-s-resize" },
  { dir: "West", className: "inset-y-2 left-0 w-1.5 cursor-w-resize" },
  { dir: "East", className: "inset-y-2 right-0 w-1.5 cursor-e-resize" },
  { dir: "NorthWest", className: "top-0 left-0 h-3 w-3 cursor-nw-resize" },
  { dir: "NorthEast", className: "top-0 right-0 h-3 w-3 cursor-ne-resize" },
  { dir: "SouthWest", className: "bottom-0 left-0 h-3 w-3 cursor-sw-resize" },
  { dir: "SouthEast", className: "bottom-0 right-0 h-3 w-3 cursor-se-resize" },
];

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

export function WindowResize() {
  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    void currentWindow()
      .then((windowRef) => windowRef.setResizable(true))
      .catch(() => {
        // Permission or host may already keep the window resizable.
      });
  }, []);

  const onPointerDown = useCallback(
    async (event: PointerEvent<HTMLDivElement>, direction: ResizeDirection) => {
      if (event.button !== 0 || !isTauriRuntime()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      try {
        await (await currentWindow()).startResizeDragging(direction);
      } catch {
        // Web preview ignores resize.
      }
    },
    [],
  );

  return (
    <div className="window-resize" aria-hidden="true">
      {edges.map((edge) => (
        <div
          key={edge.dir}
          onPointerDown={(event) => void onPointerDown(event, edge.dir)}
          className={`window-resize-edge absolute z-50 ${edge.className}`}
        />
      ))}
    </div>
  );
}
