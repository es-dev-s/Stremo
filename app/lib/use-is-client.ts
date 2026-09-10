"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * True only after hydration. Lets components render browser-only values without
 * a setState-in-effect cascade or a server/client markup mismatch.
 */
export function useIsClient() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}
