"use client";

import { signalingConfig } from "../lib/backend/config";
import { logout } from "../lib/backend/store";
import { usePlatform } from "../lib/backend/use-platform";
import { AppearanceSettings } from "./appearance-settings";
import { PageCanvas } from "./page-canvas";

function roleLabel(role: string) {
  if (role === "super_admin") {
    return "Superadmin";
  }
  if (role === "it_ops") {
    return "IT Ops";
  }
  return "Workspace Admin";
}

export function SettingsBoard() {
  const state = usePlatform();
  const config = signalingConfig();
  const user = state.session?.admin;

  return (
    <PageCanvas
      title="Settings"
      subtitle="Appearance stays local. Session and roster stay on the signaling backend."
    >
      <div className="grid gap-3 lg:grid-cols-2">
        <AppearanceSettings />

        <section className="dash-card rounded-[20px] p-4">
          <h2 className="text-[13px] font-semibold tracking-tight text-ink">Session</h2>
          <p className="mt-1 text-[12px] text-muted">
            {user?.fullName} · {roleLabel(user?.role || "")}
          </p>
          <p className="mt-1 text-[12px] text-muted">{state.session?.org.name}</p>
          <p className="mt-3 text-[11px] text-faint">
            Connection: {state.connection}
            {state.socketId ? ` · ${state.socketId.slice(0, 8)}` : ""}
          </p>
          <p className="mt-1 truncate text-[11px] text-faint">{config.wsUrl}</p>
          <button
            type="button"
            onClick={() => void logout()}
            className="pressable mt-4 inline-flex h-8 items-center rounded-lg bg-soft px-3 text-[12px] font-medium text-ink"
          >
            Log out
          </button>
        </section>
      </div>
    </PageCanvas>
  );
}
