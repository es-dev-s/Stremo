"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { appleEase } from "../lib/motion";

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ ease: appleEase, duration: 0.32 }}>
      {children}
    </MotionConfig>
  );
}
