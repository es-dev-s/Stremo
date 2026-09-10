"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  House,
  LogOut,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";
import { logout } from "../lib/backend/store";

const iconStroke = 1.8;

const primaryNav: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Home", icon: House },
  { href: "/workspaces", label: "Workspaces", icon: Building2 },
  { href: "/agents", label: "Agents", icon: Users },
];

function isActivePath(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

function Item({
  href,
  label,
  icon: Icon,
  compact,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  compact?: boolean;
}) {
  const pathname = usePathname() ?? "/";
  const isActive = isActivePath(pathname, href);

  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center justify-center rounded-full ${
        compact ? "h-8 w-8" : "h-8 w-8 lg:h-9 lg:w-9"
      } ${isActive ? "nav-active" : "nav-idle"}`}
    >
      <Icon size={compact ? 14 : 15} strokeWidth={iconStroke} aria-hidden="true" />
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="hidden h-full w-12 shrink-0 select-none flex-col items-center py-2 md:flex lg:w-14">
      <nav
        className="flex flex-1 flex-col items-center justify-center gap-2"
        aria-label="Main"
      >
        {primaryNav.map((item) => (
          <Item key={item.href} {...item} />
        ))}
      </nav>

      <div className="flex flex-col items-center gap-2 pb-1.5">
        <Item href="/settings" label="Settings" icon={Settings} />
        <button
          type="button"
          title="Log out"
          aria-label="Log out"
          onClick={() => void logout()}
          className="nav-idle flex h-8 w-8 items-center justify-center rounded-full lg:h-9 lg:w-9"
        >
          <LogOut size={15} strokeWidth={iconStroke} aria-hidden="true" />
        </button>
      </div>
    </aside>
  );
}

export function MobileDock() {
  return (
    <nav
      className="flex shrink-0 items-center justify-around gap-1 border-t border-[var(--window-stroke)] px-2 py-1 md:hidden"
      aria-label="Main"
    >
      {primaryNav.map((item) => (
        <Item key={item.href} {...item} compact />
      ))}
      <Item href="/settings" label="Settings" icon={Settings} compact />
    </nav>
  );
}
