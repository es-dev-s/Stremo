"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { usePlatform } from "../lib/backend/use-platform";
import { PageMotion } from "./page-motion";
import { Navbar } from "./navbar";
import { MobileDock, Sidebar } from "./sidebar";
import { UpdateBanner } from "./update-banner";

export function ShellChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const screens = pathname === "/screens";
  const connection = usePlatform().connection;

  useEffect(() => {
    document.documentElement.classList.toggle("screens-mode", screens);
    return () => {
      document.documentElement.classList.remove("screens-mode");
    };
  }, [screens]);

  return (
    <div className="relative z-10 flex h-full flex-col">
      <div className="app-frame flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {screens ? null : <Navbar />}
        <div className="flex min-h-0 min-w-0 flex-1">
          {screens ? null : <Sidebar />}
          <main className={`flex min-h-0 w-full min-w-0 flex-1 flex-col ${screens ? "overflow-hidden" : "overflow-auto"}`}>
            {screens || connection === "online" ? null : (
              <p className="px-4 pt-2 text-[11px] text-muted">
                {connection === "reconnecting"
                  ? "Reconnecting to the signaling backend…"
                  : "Connecting to the signaling backend…"}
              </p>
            )}
            <PageMotion>{children}</PageMotion>
          </main>
        </div>
        {screens ? null : <MobileDock />}
      </div>
      <UpdateBanner />
    </div>
  );
}
