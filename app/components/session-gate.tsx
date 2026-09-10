"use client";

import { useEffect, useState, type ReactNode } from "react";
import { startPlatform } from "../lib/backend/store";
import { usePlatform } from "../lib/backend/use-platform";
import { LoginBoard } from "./login-board";
import { HomeSkeleton } from "./skeleton";

export function SessionGate({ children }: { children: ReactNode }) {
  const state = usePlatform();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    startPlatform();
    setMounted(true);
  }, []);

  if (!mounted) {
    return <HomeSkeleton />;
  }

  if (!state.session) {
    return <LoginBoard />;
  }

  return children;
}
