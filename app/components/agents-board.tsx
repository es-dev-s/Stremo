"use client";

import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { prepareScreens } from "../lib/backend/store";
import { useWorkspaceData } from "../lib/backend/use-platform";
import { agentLabel, agentTone } from "../lib/data";
import { AgentAvatar, StatusPill } from "./agent-avatar";
import { EmptyHint, PageCanvas } from "./page-canvas";
import { PageSkeleton } from "./skeleton";

export function AgentsBoard() {
  const router = useRouter();
  const data = useWorkspaceData();

  if (data.hydrating && data.agents.length === 0) {
    return <PageSkeleton />;
  }

  return (
    <PageCanvas
      title="Agents"
      subtitle="Live roster from admin-get-clients and realtime admin-clients-updated."
    >
      {data.filteredAgents.length === 0 ? (
        <EmptyHint icon={Users} label="No agents match this view" />
      ) : (
        <ul className="grid min-h-0 auto-rows-min gap-2 md:grid-cols-2 xl:grid-cols-3">
          {data.filteredAgents.map((agent) => (
            <li key={agent.id}>
              <button
                type="button"
                onClick={() => {
                  prepareScreens({
                    workspaceId: agent.workspaceId,
                    prefer: [agent.clientId],
                  });
                  router.push("/screens");
                }}
                className="dash-card dash-row flex w-full items-center justify-between gap-3 rounded-2xl p-3.5 text-left"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <AgentAvatar name={agent.name} size={32} />
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-ink">{agent.name}</p>
                    <p className="truncate text-[11px] text-faint">{agent.workspaceName}</p>
                  </div>
                </div>
                <StatusPill tone={agentTone(agent.status)}>{agentLabel(agent.status)}</StatusPill>
              </button>
            </li>
          ))}
        </ul>
      )}
    </PageCanvas>
  );
}
