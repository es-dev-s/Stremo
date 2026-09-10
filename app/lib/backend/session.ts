import type { SignalSession } from "./types";

const KEY = "stremo-session";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readSession(): SignalSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed) || typeof parsed.token !== "string") {
      return null;
    }

    const admin = parsed.admin;
    const org = parsed.org;
    if (!isRecord(admin) || !isRecord(org)) {
      return null;
    }

    const expiresAt = Number(parsed.expiresAt) || 0;
    if (expiresAt && expiresAt < Date.now()) {
      clearSession();
      return null;
    }

    return {
      token: parsed.token,
      expiresAt,
      admin: {
        id: Number(admin.id),
        orgId: Number(admin.orgId),
        username: String(admin.username ?? ""),
        fullName: String(admin.fullName ?? ""),
        role: String(admin.role ?? ""),
      },
      org: {
        id: Number(org.id),
        name: String(org.name ?? ""),
      },
    };
  } catch {
    return null;
  }
}

export function writeSession(session: SignalSession) {
  window.localStorage.setItem(KEY, JSON.stringify(session));
}

export function clearSession() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(KEY);
}
