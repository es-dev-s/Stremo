"use client";

import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { appleEase } from "../lib/motion";

export function PageMotion({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const screens = pathname === "/screens";

  if (screens) {
    return <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">{children}</div>;
  }

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32, ease: appleEase }}
      className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
