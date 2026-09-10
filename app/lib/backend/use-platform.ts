"use client";

import { useMemo, useSyncExternalStore } from "react";
import { mapAdmin, mapAgent, mapWorkspace } from "../data";
import { getPlatformState, matchesQuery, subscribePlatform } from "./store";

export function usePlatform() {
  return useSyncExternalStore(subscribePlatform, getPlatformState, getPlatformState);
}

export function useWorkspaceData() {
  const state = usePlatform();
  const query = state.search;

  return useMemo(() => {
    const agents = state.clients.map(mapAgent);
    const admins = state.leads.map(mapAdmin);
    const workspaces = state.orgs.map((org) => mapWorkspace(org, agents));
    const filteredAgents = agents.filter(
      (agent) => matchesQuery(agent.name, query) || matchesQuery(agent.workspaceName, query),
    );
    const filteredWorkspaces = workspaces.filter((workspace) => matchesQuery(workspace.name, query));

    return {
      ...state,
      agents,
      admins,
      workspaces,
      filteredAgents,
      filteredWorkspaces,
      streaming: agents.filter((agent) => agent.status === "live"),
      attention: agents.filter((agent) => agent.status !== "live"),
    };
  }, [state]);
}
