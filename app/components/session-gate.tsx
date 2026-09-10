"use client";

import { useEffect, type ReactNode } from "react";
import { startPlatform } from "../lib/backend/store";
import { usePlatform } from "../lib/backend/use-platform";
import { useIsClient } from "../lib/use-is-client";
import { LoginBoard } from "./login-board";
import { HomeSkeleton } from "./skeleton";

export function SessionGate({ children }: { children: ReactNode }) {
  const state = usePlatform();
  const mounted = useIsClient();

  useEffect(() => {
    startPlatform();
  }, []);

  if (!mounted) {
    return <HomeSkeleton />;
  }

  if (!state.session) {
    return <LoginBoard />;
  }

  return children;
}
