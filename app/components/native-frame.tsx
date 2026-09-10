"use client";

import { NativeBehavior } from "./native-behavior";
import { ThemeBoot } from "./theme-boot";
import { WindowResize } from "./window-resize";

export function NativeFrame() {
  return (
    <>
      <ThemeBoot />
      <NativeBehavior />
      <WindowResize />
    </>
  );
}
