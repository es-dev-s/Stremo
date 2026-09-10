"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2 } from "lucide-react";
import { prepareScreens } from "../lib/backend/store";
import { useWorkspaceData } from "../lib/backend/use-platform";
import { agentLabel, agentTone, workspaceById } from "../lib/data";
import { AgentAvatar, Meter, StatusPill } from "./agent-avatar";
import { EmptyHint, GlassBoard, PageCanvas } from "./page-canvas";
import { PageSkeleton } from "./skeleton";

export function WorkspaceBoard() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get("id") ?? "";
  const data = useWorkspaceData();

  if (data.hydrating && data.workspaces.length === 0) {
    return <PageSkeleton />;
  }

  if (selectedId) {
    return <WorkspaceDetail id={selectedId} />;
  }

  return (
    <PageCanvas
      title="Workspaces"
      subtitle="Live organizations from the signaling backend, with streaming coverage."
    >
      {data.filteredWorkspaces.length === 0 ? (
        <EmptyHint icon={Building2} label="No workspaces on this account" />
      ) : (
        <ul className="grid min-h-0 auto-rows-min gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.filteredWorkspaces.map((workspace) => {
            const pct = workspace.total
              ? Math.round((workspace.live / workspace.total) * 100)
              : 0;
            return (
              <li key={workspace.id}>
                <Link
                  href={`/workspaces?id=${workspace.id}`}
                  className="dash-card dash-row flex h-full flex-col rounded-2xl p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[14px] font-semibold text-ink">{workspace.name}</p>
                    <StatusPill tone={workspace.status === "quiet" ? "quiet" : "active"}>
                      {workspace.status === "quiet" ? "Quiet" : "Live"}
                    </StatusPill>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Meter value={pct} live={workspace.live > 0} />
                    <p className="text-[12px] font-medium tabular-nums text-ink">
                      {workspace.live}/{workspace.total}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PageCanvas>
  );
}

function WorkspaceDetail({ id }: { id: string }) {
  const router = useRouter();
  const data = useWorkspaceData();
  const workspace = workspaceById(data.workspaces, id);
  const agents = data.agents.filter((agent) => agent.workspaceId === id);
  const admins = data.admins.filter((admin) => admin.workspaceId === id);

  if (data.hydrating && !workspace) {
    return <PageSkeleton />;
  }

  if (!workspace) {
    return (
      <PageCanvas title="Workspace" subtitle="This workspace is not on your roster.">
        <EmptyHint icon={Building2} label="Workspace not found" />
      </PageCanvas>
    );
  }

  return (
    <PageCanvas
      title={workspace.name}
      subtitle={`${workspace.live} streaming · ${workspace.total} agents · ${admins.length} admins`}
    >
      <div className="mb-3 flex justify-end">
        <button
          type="button"
          onClick={() => {
            prepareScreens({ workspaceId: id });
            router.push("/screens");
          }}
          className="pressable btn-accent inline-flex h-8 items-center rounded-lg px-3 text-[12px] font-medium"
        >
          Open screens
        </button>
      </div>
      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <GlassBoard>
          <p className="mb-3 text-[13px] font-semibold text-ink">Agents</p>
          {agents.length === 0 ? (
            <p className="text-[12px] text-faint">No agents in this workspace</p>
          ) : (
            <ul className="flex flex-col gap-0.5 overflow-auto">
              {agents.map((agent) => (
                <li key={agent.id} className="dash-row flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AgentAvatar name={agent.name} />
                    <p className="truncate text-[13px] font-medium text-ink">{agent.name}</p>
                  </div>
                  <StatusPill tone={agentTone(agent.status)}>{agentLabel(agent.status)}</StatusPill>
                </li>
              ))}
            </ul>
          )}
        </GlassBoard>
        <GlassBoard>
          <p className="mb-3 text-[13px] font-semibold text-ink">Admins</p>
          {admins.length === 0 ? (
            <p className="text-[12px] text-faint">No workspace admins listed</p>
          ) : (
            <ul className="flex flex-col gap-0.5 overflow-auto">
              {admins.map((admin) => (
                <li key={admin.id} className="dash-row flex items-center justify-between gap-3 px-2 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <AgentAvatar name={admin.name} />
                    <p className="truncate text-[13px] font-medium text-ink">{admin.name}</p>
                  </div>
                  <p className="text-[11px] text-muted">{admin.role}</p>
                </li>
              ))}
            </ul>
          )}
        </GlassBoard>
      </div>
    </PageCanvas>
  );
}
