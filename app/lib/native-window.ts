export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function currentWindow() {
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow();
}

type WindowBounds = {
  width: number;
  height: number;
  x: number;
  y: number;
};

let savedBounds: WindowBounds | null = null;
let screensOpen = false;
let queue: Promise<void> = Promise.resolve();

function runExclusive(task: () => Promise<void>) {
  const next = queue.then(task, task);
  queue = next.catch(() => undefined);
  return next;
}

export async function enterScreensMode() {
  return runExclusive(async () => {
    if (screensOpen) {
      return;
    }

    if (!isTauriRuntime()) {
      screensOpen = true;
      if (document.fullscreenEnabled && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
      return;
    }

    const win = await currentWindow();
    const size = await win.innerSize();
    const position = await win.outerPosition();
    savedBounds = {
      width: size.width,
      height: size.height,
      x: position.x,
      y: position.y,
    };

    if (!(await win.isFullscreen())) {
      await win.setFullscreen(true);
    }
    screensOpen = true;
  });
}

export async function exitScreensMode() {
  return runExclusive(async () => {
    if (!isTauriRuntime()) {
      screensOpen = false;
      savedBounds = null;
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
      return;
    }

    const win = await currentWindow();
    const { PhysicalPosition, PhysicalSize } = await import("@tauri-apps/api/dpi");
    const bounds = savedBounds;
    savedBounds = null;
    screensOpen = false;

    try {
      if (await win.isFullscreen()) {
        await win.setFullscreen(false);
      }
    } catch {
      // Compositor may already have left fullscreen.
    }

    try {
      await win.unmaximize();
    } catch {
      // Not maximized, or permission missing.
    }

    if (bounds) {
      await win.setSize(new PhysicalSize(bounds.width, bounds.height));
      await win.setPosition(new PhysicalPosition(bounds.x, bounds.y));
    }
  });
}
