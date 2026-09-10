import type { ReactNode } from "react";
import { MotionProvider } from "./motion-provider";
import { NativeFrame } from "./native-frame";
import { SessionGate } from "./session-gate";
import { ShellChrome } from "./shell-chrome";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <MotionProvider>
      <div className="app-window relative h-dvh overflow-hidden text-ink">
        <NativeFrame />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div className="scene-gradient absolute inset-0" />
        </div>
        <SessionGate>
          <ShellChrome>{children}</ShellChrome>
        </SessionGate>
      </div>
    </MotionProvider>
  );
}
