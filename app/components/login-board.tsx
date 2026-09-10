"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "motion/react";
import { cardReveal } from "../lib/motion";
import { signalingConfig } from "../lib/backend/config";
import { login } from "../lib/backend/store";
import { usePlatform } from "../lib/backend/use-platform";
import { BrandLockup } from "./brand";
import { TitlebarDrag, WindowControls } from "./window-controls";

export function LoginBoard() {
  const state = usePlatform();
  const config = useMemo(() => signalingConfig(), []);
  const [orgName, setOrgName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const orgs = state.loginOrgs;
  const ready = state.connection === "online";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await login(orgName.trim(), username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-10 flex h-full flex-col">
      <header className="titlebar flex h-11 w-full shrink-0 items-center sm:h-12">
        <div className="flex h-full shrink-0 items-center pl-3 sm:pl-4">
          <BrandLockup />
        </div>
        <TitlebarDrag />
        <WindowControls />
      </header>

      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-8">
        <motion.form
          onSubmit={onSubmit}
          variants={cardReveal}
          initial="initial"
          animate="animate"
          className="dash-card w-full max-w-sm rounded-2xl p-5"
        >
          <p className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">
            Workspace access
          </p>
          <h1 className="mt-1 text-[18px] font-semibold tracking-[-0.03em] text-ink-strong">
            Sign in to Stremo
          </h1>
          <p className="mt-1.5 text-[12px] leading-5 text-muted">
            {ready
              ? "Use your admin workspace credentials. Live roster and streams stay on the signaling backend."
              : state.connection === "error" || state.error
                ? "The signaling backend is unreachable. The app will keep trying."
                : "Connecting to the signaling backend…"}
          </p>

          <label className="mt-4 block">
            <span className="text-[11px] font-medium text-muted">Workspace</span>
            {orgs.length > 0 ? (
              <select
                required
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="field-input mt-1"
              >
                <option value="" disabled>
                  Select workspace
                </option>
                {orgs.map((org) => (
                  <option key={org.id} value={org.name}>
                    {org.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                required
                value={orgName}
                onChange={(event) => setOrgName(event.target.value)}
                className="field-input mt-1"
                placeholder="Workspace name"
                autoComplete="organization"
              />
            )}
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] font-medium text-muted">Username</span>
            <input
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="field-input mt-1"
              autoComplete="username"
            />
          </label>

          <label className="mt-3 block">
            <span className="text-[11px] font-medium text-muted">Password</span>
            <input
              required
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="field-input mt-1"
              autoComplete="current-password"
            />
          </label>

          {error ? <p className="mt-3 text-[12px] text-[#b45309]">{error}</p> : null}

          <button
            type="submit"
            disabled={busy || !ready}
            className="pressable btn-accent mt-4 inline-flex h-9 w-full items-center justify-center rounded-lg text-[13px] font-medium disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Continue"}
          </button>

          <p className="mt-3 truncate text-[10px] text-faint">{config.wsUrl}</p>
        </motion.form>
      </div>
    </div>
  );
}
