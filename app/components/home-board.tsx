"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { ArrowUpRight, Building2 } from "lucide-react";
import { cardReveal, stagger } from "../lib/motion";
import { prepareScreens } from "../lib/backend/store";
import { useWorkspaceData } from "../lib/backend/use-platform";
import { useIsClient } from "../lib/use-is-client";
import { agentLabel, agentTone, type Workspace } from "../lib/data";
import { AgentAvatar, Meter, StatusPill } from "./agent-avatar";
import { HomeSkeleton } from "./skeleton";

function todayLabel() {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
  }).format(new Date());
}

export function HomeBoard() {
  const router = useRouter();
  const data = useWorkspaceData();
  // Rendered only after hydration; the server locale/date would not match.
  const today = useIsClient() ? todayLabel() : "";

  function openScreens() {
    prepareScreens();
    router.push("/screens");
  }

  if (data.hydrating && data.clients.length === 0) {
    return <HomeSkeleton />;
  }

  const coverage = data.agents.length
    ? Math.round((data.streaming.length / data.agents.length) * 100)
    : 0;
  const activeCount = data.workspaces.filter((item) => item.status === "active").length;

  return (
    <motion.div
      className="stremo-home grid h-full min-h-0 w-full grid-cols-1 gap-3 overflow-auto p-3 sm:p-4 xl:overflow-hidden"
      initial="initial"
      animate="animate"
      variants={stagger}
    >
      <motion.header
        variants={cardReveal}
        className="area-head flex items-end justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold tracking-[-0.03em] text-ink-strong">
            Overview
          </h1>
          <p className="mt-0.5 truncate text-[12px] text-muted">
            {today ? (
              <>
                {today}
                <span className="text-faint"> · </span>
              </>
            ) : null}
            {data.streaming.length} streaming
            <span className="text-faint"> · </span>
            {data.attention.length} need attention
          </p>
        </div>
        <button
          type="button"
          onClick={openScreens}
          className="pressable inline-flex h-8 shrink-0 items-center gap-1 rounded-lg btn-accent px-3 text-[12px] font-medium"
        >
          Open screens
          <ArrowUpRight size={13} strokeWidth={1.8} aria-hidden="true" />
        </button>
      </motion.header>

      <motion.section variants={cardReveal} className="area-kpis grid gap-3 sm:grid-cols-3">
        <article className="dash-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">
            Coverage
          </p>
          <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-ink-strong tabular-nums">
            {data.streaming.length}
            <span className="text-[15px] font-medium text-faint"> / {data.agents.length}</span>
          </p>
          <div className="mt-3">
            <Meter value={coverage} live />
            <p className="mt-1.5 text-[11px] text-faint tabular-nums">
              {coverage}% of agents streaming
            </p>
          </div>
        </article>

        <article className="dash-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">
            Workspaces
          </p>
          <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-ink-strong tabular-nums">
            {data.workspaces.length}
          </p>
          <p className="mt-1.5 text-[11px] text-faint">
            {activeCount} live · {data.workspaces.length - activeCount} quiet
          </p>
        </article>

        <article className="dash-card rounded-2xl p-3.5 sm:p-4">
          <p className="text-[11px] font-medium tracking-[0.04em] text-muted uppercase">
            Attention
          </p>
          <p className="mt-2 text-[1.55rem] font-semibold tracking-[-0.04em] text-ink-strong tabular-nums">
            {data.attention.length}
          </p>
          <p className="mt-1.5 text-[11px] text-faint">Idle or away, not streaming</p>
        </article>
      </motion.section>

      <motion.section
        variants={cardReveal}
        className="dash-card area-workspaces flex min-h-0 flex-col rounded-2xl p-3.5 sm:p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">Workspaces</p>
          <Link href="/workspaces" className="text-[11px] font-medium text-accent">
            View all
          </Link>
        </div>
        {data.filteredWorkspaces.length === 0 ? (
          <p className="flex flex-1 items-center text-[12px] text-faint">
            {data.connection === "online" ? "No workspaces yet" : "Waiting for backend…"}
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto">
            {data.filteredWorkspaces.map((workspace) => (
              <WorkspaceRow key={workspace.id} workspace={workspace} />
            ))}
          </ul>
        )}
      </motion.section>

      <motion.section
        variants={cardReveal}
        className="dash-card area-attention flex min-h-0 flex-col rounded-2xl p-3.5 sm:p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[13px] font-semibold text-ink">Needs attention</p>
          <Link href="/agents" className="text-[11px] font-medium text-accent">
            View all
          </Link>
        </div>
        {data.attention.length === 0 ? (
          <p className="flex flex-1 items-center text-[12px] text-faint">
            All agents are streaming
          </p>
        ) : (
          <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-auto">
            {data.attention.map((agent) => (
              <li key={agent.id}>
                <Link href="/agents" className="dash-row flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AgentAvatar name={agent.name} />
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium text-ink">{agent.name}</p>
                      <p className="truncate text-[11px] text-faint">{agent.workspaceName}</p>
                    </div>
                  </div>
                  <StatusPill tone={agentTone(agent.status)}>
                    {agentLabel(agent.status)}
                  </StatusPill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </motion.section>
    </motion.div>
  );
}

function WorkspaceRow({ workspace }: { workspace: Workspace }) {
  const pct = workspace.total ? Math.round((workspace.live / workspace.total) * 100) : 0;

  return (
    <li>
      <Link
        href={`/workspaces?id=${workspace.id}`}
        className="dash-row flex items-center gap-3 px-2 py-2"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-soft text-ink">
          <Building2 size={14} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13px] font-medium text-ink">{workspace.name}</p>
            <StatusPill tone={workspace.status === "quiet" ? "quiet" : "active"}>
              {workspace.status === "quiet" ? "Quiet" : "Live"}
            </StatusPill>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <Meter value={pct} live={workspace.live > 0} />
            <p className="shrink-0 text-[11px] font-medium tabular-nums text-ink">
              {workspace.live}/{workspace.total}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}
