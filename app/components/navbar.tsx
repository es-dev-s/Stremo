"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Bell, Search } from "lucide-react";
import { appleEase, popover } from "../lib/motion";
import { markNotificationsRead, setSearch } from "../lib/backend/store";
import { usePlatform } from "../lib/backend/use-platform";
import { initialsFrom } from "../lib/data";
import { AgentAvatar } from "./agent-avatar";
import { BrandLockup } from "./brand";
import { ThemeToggle } from "./theme-toggle";
import { TitlebarDrag, WindowControls } from "./window-controls";

type OpenMenu = "notifications" | "profile" | null;

function roleLabel(role: string) {
  if (role === "super_admin") {
    return "Superadmin";
  }
  if (role === "it_ops") {
    return "IT Ops";
  }
  return "Workspace Admin";
}

function timeLabel(time: number) {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export function Navbar() {
  const state = usePlatform();
  const [open, setOpen] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLElement>(null);
  const unread = state.notifications.filter((item) => !item.read).length;
  const user = state.session?.admin;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(null);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header ref={rootRef} className="titlebar flex h-11 w-full shrink-0 items-center sm:h-12">
      <div className="flex h-full shrink-0 items-center pl-3 sm:pl-4">
        <BrandLockup />
      </div>

      <TitlebarDrag />

      <div className="flex h-full shrink-0 items-center gap-2 pr-1 sm:gap-2.5">
        <span
          className={`hidden h-1.5 w-1.5 rounded-full sm:block ${
            state.connection === "online" ? "bg-[#10b981]" : "live-dot bg-[#f59e0b]"
          }`}
          title={state.connection === "online" ? "Connected" : "Reconnecting"}
        />

        <label className="search-field" aria-label="Search">
          <Search size={13} strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search"
            spellCheck={false}
            autoComplete="off"
            value={state.search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <section className="relative" aria-label="Notifications">
          <button
            type="button"
            aria-label="Open notifications"
            aria-expanded={open === "notifications"}
            onClick={() => {
              setOpen((current) => (current === "notifications" ? null : "notifications"));
              markNotificationsRead();
            }}
            className="icon-btn relative flex h-7 w-7 items-center justify-center rounded-full text-muted"
          >
            <Bell size={14} strokeWidth={1.8} aria-hidden="true" />
            {unread > 0 ? <span className="notify-dot" /> : null}
          </button>
          <AnimatePresence>
            {open === "notifications" ? (
              <motion.div
                role="dialog"
                aria-label="Notifications"
                initial={popover.initial}
                animate={popover.animate}
                exit={popover.exit}
                transition={{ duration: 0.18, ease: appleEase }}
                className="dash-card absolute right-0 top-11 z-30 w-72 max-w-[calc(100vw-1.5rem)] rounded-2xl p-3"
              >
                {state.notifications.length === 0 ? (
                  <p className="text-[13px] text-muted">No notifications</p>
                ) : (
                  <ul className="flex max-h-72 flex-col gap-2 overflow-auto">
                    {state.notifications.slice(0, 12).map((item) => (
                      <li key={item.id}>
                        <p className="text-[13px] font-medium text-ink">{item.title}</p>
                        <p className="text-[11px] text-muted">
                          {item.body}
                          <span className="text-faint"> · {timeLabel(item.time)}</span>
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>

        <ThemeToggle />

        <section className="relative" aria-label="User profile">
          <button
            type="button"
            aria-label={user ? `${user.fullName}, ${roleLabel(user.role)}` : "Profile"}
            aria-expanded={open === "profile"}
            onClick={() => setOpen((current) => (current === "profile" ? null : "profile"))}
            className="profile-chip"
          >
            <AgentAvatar name={user?.fullName || "Stremo"} />
            <span className="profile-chip-name">{user?.fullName || "Signed in"}</span>
          </button>
          <AnimatePresence>
            {open === "profile" ? (
              <motion.div
                role="dialog"
                aria-label="User profile"
                initial={popover.initial}
                animate={popover.animate}
                exit={popover.exit}
                transition={{ duration: 0.18, ease: appleEase }}
                className="dash-card absolute right-0 top-11 z-30 w-52 rounded-2xl p-3"
              >
                <p className="text-[13px] font-medium text-ink">{user?.fullName}</p>
                <p className="mt-0.5 text-[10px] font-medium tracking-wide text-accent uppercase">
                  {roleLabel(user?.role || "")}
                </p>
                <p className="mt-2 text-[11px] text-muted">{state.session?.org.name}</p>
                <p className="mt-1 text-[10px] text-faint">{initialsFrom(user?.username || "")}</p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </section>
      </div>

      <WindowControls />
    </header>
  );
}
