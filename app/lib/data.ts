import type { SignalClient, SignalLead, SignalOrg } from "./backend/types";

export type AgentStatus = "live" | "idle" | "away";

export type Agent = {
  id: string;
  clientId: number;
  name: string;
  role: "Agent";
  initials: string;
  status: AgentStatus;
  workspaceId: string;
  workspaceName: string;
  socketId: string;
  appVersion: string;
};

export type WorkspaceAdmin = {
  id: string;
  name: string;
  initials: string;
  role: string;
  workspaceId: string;
};

export type Workspace = {
  id: string;
  name: string;
  status: "active" | "quiet";
  live: number;
  total: number;
};

const IDLE_MS = 30 * 60 * 1000;

export function initialsFrom(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "S";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function hueFrom(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

export function agentStatus(client: SignalClient): AgentStatus {
  if (client.status === "sharing") {
    return "live";
  }
  const last = client.lastHeartbeatMs || client.lastOnlineMs || 0;
  if (last && Date.now() - last < IDLE_MS) {
    return "idle";
  }
  return "away";
}

export function mapAgent(client: SignalClient): Agent {
  return {
    id: String(client.id),
    clientId: client.id,
    name: client.fullName,
    role: "Agent",
    initials: initialsFrom(client.fullName),
    status: agentStatus(client),
    workspaceId: String(client.orgId),
    workspaceName: client.orgName || "",
    socketId: client.socketId || "",
    appVersion: client.appVersion || "",
  };
}

export function mapAdmin(lead: SignalLead): WorkspaceAdmin {
  return {
    id: String(lead.id),
    name: lead.fullName,
    initials: initialsFrom(lead.fullName),
    role: lead.role === "it_ops" ? "IT Ops" : "Workspace Admin",
    workspaceId: String(lead.orgId),
  };
}

export function mapWorkspace(org: SignalOrg, agents: Agent[]): Workspace {
  const roster = agents.filter((agent) => agent.workspaceId === String(org.id));
  const live = roster.filter((agent) => agent.status === "live").length;
  return {
    id: String(org.id),
    name: org.name,
    status: live > 0 ? "active" : "quiet",
    live,
    total: roster.length,
  };
}

export function workspaceById(workspaces: Workspace[], id: string) {
  return workspaces.find((workspace) => workspace.id === id);
}

export function adminsFor(admins: WorkspaceAdmin[], workspaceId: string) {
  return admins.filter((admin) => admin.workspaceId === workspaceId);
}

export function agentsFor(agents: Agent[], workspaceId: string) {
  return agents.filter((agent) => agent.workspaceId === workspaceId);
}

export function liveAgents(agents: Agent[]) {
  return agents.filter((agent) => agent.status === "live");
}

export function agentTone(status: AgentStatus) {
  if (status === "away") {
    return "away" as const;
  }
  if (status === "idle") {
    return "idle" as const;
  }
  return "live" as const;
}

export function agentLabel(status: AgentStatus) {
  if (status === "away") {
    return "Away";
  }
  if (status === "idle") {
    return "Idle";
  }
  return "Streaming";
}
