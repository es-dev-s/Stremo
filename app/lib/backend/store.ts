import { signaling } from "./signaling";
import { clearSession, readSession, writeSession } from "./session";
import type {
  AppNotification,
  SignalAdmin,
  SignalClient,
  SignalLead,
  SignalMessage,
  SignalOrg,
  SignalSession,
  TransportPlan,
} from "./types";
import { unwatchAll } from "./webrtc";

export type ConnectionState =
  | "idle"
  | "connecting"
  | "online"
  | "reconnecting"
  | "error";

export type ScreenSlots = [number | null, number | null, number | null, number | null];

const EMPTY_SLOTS: ScreenSlots = [null, null, null, null];

export type PlatformState = {
  connection: ConnectionState;
  socketId: string;
  iceServers: TransportPlan["iceServers"];
  transport: TransportPlan | null;
  session: SignalSession | null;
  loginOrgs: SignalOrg[];
  orgs: SignalOrg[];
  leads: SignalLead[];
  clients: SignalClient[];
  notifications: AppNotification[];
  search: string;
  screenWorkspaceId: string | null;
  screenSlots: ScreenSlots;
  error: string | null;
  booted: boolean;
  hydrating: boolean;
};

type Listener = () => void;

const listeners = new Set<Listener>();

let started = false;
let hydrateGen = 0;
let snapshot: PlatformState = {
  connection: "idle",
  socketId: "",
  iceServers: [],
  transport: null,
  session: null,
  loginOrgs: [],
  orgs: [],
  leads: [],
  clients: [],
  notifications: [],
  search: "",
  screenWorkspaceId: null,
  screenSlots: EMPTY_SLOTS,
  error: null,
  booted: false,
  hydrating: false,
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asOrg(value: unknown): SignalOrg | null {
  const row = asRecord(value);
  const id = asNumber(row?.id);
  const name = asString(row?.name);
  if (!id || !name) {
    return null;
  }
  return { id, name };
}

function asClient(value: unknown): SignalClient | null {
  const row = asRecord(value);
  const id = asNumber(row?.id);
  const fullName = asString(row?.fullName);
  const orgId = asNumber(row?.orgId);
  if (!id || !fullName || !orgId) {
    return null;
  }
  return {
    id,
    fullName,
    status: asString(row?.status) || "offline",
    orgId,
    orgName: asString(row?.orgName) || null,
    claimedOrgName: asString(row?.claimedOrgName) || null,
    lastHeartbeatMs: asNumber(row?.lastHeartbeatMs) ?? 0,
    lastOnlineMs: asNumber(row?.lastOnlineMs),
    lastOfflineMs: asNumber(row?.lastOfflineMs),
    screenSources: Array.isArray(row?.screenSources) ? (row.screenSources as SignalClient["screenSources"]) : [],
    appVersion: asString(row?.appVersion),
    socketId: asString(row?.socketId),
    deviceInfo: row?.deviceInfo,
  };
}

function asLead(value: unknown): SignalLead | null {
  const row = asRecord(value);
  const id = asNumber(row?.id);
  const orgId = asNumber(row?.orgId);
  const fullName = asString(row?.fullName);
  if (!id || !orgId || !fullName) {
    return null;
  }
  return {
    id,
    orgId,
    username: asString(row?.username),
    fullName,
    role: asString(row?.role),
  };
}

function asAdmin(value: unknown, fallbackOrgId: number): SignalAdmin | null {
  const row = asRecord(value);
  const id = asNumber(row?.id);
  if (!id) {
    return null;
  }
  return {
    id,
    orgId: asNumber(row?.orgId) ?? fallbackOrgId,
    username: asString(row?.username),
    fullName: asString(row?.fullName),
    role: asString(row?.role),
  };
}

function listOf<T>(value: unknown, map: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const out: T[] = [];
  for (const item of value) {
    const mapped = map(item);
    if (mapped) {
      out.push(mapped);
    }
  }
  return out;
}

function patch(next: Partial<PlatformState>) {
  snapshot = { ...snapshot, ...next };
  for (const listener of listeners) {
    listener();
  }
}

function notify(title: string, body: string, tone: AppNotification["tone"] = "info") {
  const item: AppNotification = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    body,
    time: Date.now(),
    read: false,
    tone,
  };
  patch({ notifications: [item, ...snapshot.notifications].slice(0, 40) });
}

function mergeClients(incoming: SignalClient[], orgId?: number, replaceOrg = true) {
  if (!orgId) {
    return incoming;
  }
  if (!replaceOrg) {
    const byId = new Map(snapshot.clients.map((client) => [client.id, client]));
    for (const client of incoming) {
      byId.set(client.id, client);
    }
    return [...byId.values()];
  }
  const kept = snapshot.clients.filter((client) => client.orgId !== orgId);
  return [...kept, ...incoming];
}

function scopedOrgs(orgs: SignalOrg[], session: SignalSession | null) {
  if (!session || session.admin.role === "super_admin") {
    return orgs;
  }
  return orgs.filter((org) => org.id === session.org.id);
}

async function hydrate(session: SignalSession, gen: number) {
  patch({ hydrating: true, error: null });
  try {
    const [orgsRes, leadsRes, clientsRes] = await Promise.all([
      signaling.request("admin-get-orgs", { token: session.token }, "admin-get-orgs-response"),
      signaling.request("admin-get-org-leads", { token: session.token }, "admin-get-org-leads-response"),
      signaling.request("admin-get-clients", { token: session.token }, "admin-get-clients-response"),
    ]);

    if (gen !== hydrateGen) {
      return;
    }

    if (orgsRes.error === "UNAUTHORIZED" || clientsRes.error === "UNAUTHORIZED") {
      clearSession();
      patch({ session: null, orgs: [], leads: [], clients: [], hydrating: false });
      return;
    }

    const orgs = scopedOrgs(listOf(orgsRes.orgs, asOrg), session);
    const leads = listOf(leadsRes.leads, asLead);
    const clients = listOf(clientsRes.clients, asClient);
    patch({
      session,
      orgs,
      leads,
      clients,
      hydrating: false,
      error: null,
    });
  } catch (error) {
    if (gen !== hydrateGen) {
      return;
    }
    patch({
      hydrating: false,
      error: error instanceof Error ? error.message : "Could not load workspace data",
    });
  }
}

function handleMessage(message: SignalMessage) {
  const type = asString(message.type);

  if (type === "welcome") {
    const transport = asRecord(message.streamTransport) as TransportPlan | null;
    patch({
      connection: "online",
      socketId: asString(message.socketId),
      iceServers: (message.iceServers as TransportPlan["iceServers"]) || transport?.iceServersFull || [],
      transport,
      error: null,
    });
    void signaling.request("public-list-orgs", {}, "public-list-orgs-response").then((res) => {
      patch({ loginOrgs: listOf(res.orgs, asOrg) });
    }).catch(() => undefined);

    const session = snapshot.session ?? readSession();
    if (session) {
      const gen = ++hydrateGen;
      patch({ session });
      void hydrate(session, gen);
    }
    return;
  }

  if (type === "client-disconnected" || type === "client-connection-error") {
    const wasOnline = snapshot.connection === "online";
    patch({
      connection: snapshot.session ? "reconnecting" : "connecting",
      error: type === "client-connection-error" ? "Signaling unreachable" : snapshot.error,
    });
    if (wasOnline) {
      notify("Connection lost", "Reconnecting to the workspace backend", "error");
    }
    return;
  }

  if (type === "public-list-orgs-response") {
    patch({ loginOrgs: listOf(message.orgs, asOrg) });
    return;
  }

  if (type === "admin-clients-updated") {
    const orgId = asNumber(message.orgId) ?? undefined;
    const incoming = listOf(message.clients, asClient);
    const previous = new Map(snapshot.clients.map((client) => [client.id, client.status]));
    const next = mergeClients(
      incoming,
      orgId,
      snapshot.session?.admin.role !== "it_ops",
    );
    patch({ clients: next });
    for (const client of incoming) {
      const before = previous.get(client.id);
      if (before && before !== client.status) {
        if (client.status === "sharing") {
          notify(client.fullName, "Started streaming", "live");
        } else if (before === "sharing") {
          notify(client.fullName, "Went offline", "idle");
        }
      }
    }
    return;
  }

  if (type === "taskbar-events-update") {
    notify("Taskbar", asString(message.message) || "Agent activity updated", "info");
    return;
  }

  if (type === "access-restricted") {
    notify("Access restricted", asString(message.message) || "Streaming is limited from this network", "error");
    return;
  }

  if (type === "error" && message.error === "UNAUTHORIZED") {
    clearSession();
    void unwatchAll();
    patch({ session: null, orgs: [], leads: [], clients: [], hydrating: false });
  }
}

export function getPlatformState() {
  return snapshot;
}

export function subscribePlatform(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startPlatform() {
  if (started) {
    signaling.connect();
    return;
  }
  started = true;
  const session = readSession();
  patch({
    session,
    connection: "connecting",
    booted: true,
  });
  signaling.onAny(handleMessage);
  signaling.connect();
}

export async function login(orgName: string, username: string, password: string) {
  if (!signaling.open) {
    signaling.connect();
    await signaling.waitForWelcome().catch(() => undefined);
  }

  const response = await signaling.request(
    "admin-login",
    { orgName, username, password },
    "admin-login-response",
    15000,
  );

  if (!response.success) {
    throw new Error(asString(response.message) || asString(response.error) || "Invalid credentials");
  }

  const org = asOrg(response.org);
  const admin = asAdmin(response.admin, org?.id ?? 0);
  if (!org || !admin || !asString(response.token)) {
    throw new Error("Login response was incomplete");
  }

  const session: SignalSession = {
    token: asString(response.token),
    expiresAt: asNumber(response.expiresAt) ?? 0,
    admin,
    org,
  };
  writeSession(session);
  patch({ session, error: null });
  notify(admin.fullName, `Signed in to ${org.name}`, "info");
  await hydrate(session, ++hydrateGen);
}

export async function logout() {
  const token = snapshot.session?.token;
  await unwatchAll(token);
  if (token && signaling.open) {
    try {
      await signaling.request("admin-logout", { token }, "admin-logout-response", 4000);
    } catch {
      // Session is cleared locally either way.
    }
  }
  clearSession();
  patch({
    session: null,
    orgs: [],
    leads: [],
    clients: [],
    hydrating: false,
    screenWorkspaceId: null,
    screenSlots: EMPTY_SLOTS,
  });
}

export function setSearch(search: string) {
  if (snapshot.search === search) {
    return;
  }
  patch({ search });
}

export function setScreenWorkspace(workspaceId: string | null) {
  patch({ screenWorkspaceId: workspaceId });
}

export function setScreenSlot(index: number, clientId: number | null) {
  if (index < 0 || index > 3) {
    return;
  }
  const next = [...snapshot.screenSlots] as ScreenSlots;
  if (clientId != null) {
    for (let i = 0; i < 4; i += 1) {
      if (i !== index && next[i] === clientId) {
        next[i] = null;
      }
    }
  }
  next[index] = clientId;
  patch({ screenSlots: next });
}

export function prepareScreens(input?: { workspaceId?: string | null; prefer?: number[] }) {
  const workspaceId = input?.workspaceId ?? null;
  const prefer = input?.prefer ?? [];
  const pool = workspaceId
    ? snapshot.clients.filter((client) => String(client.orgId) === workspaceId)
    : snapshot.clients;
  const live = pool.filter((client) => client.status === "sharing").map((client) => client.id);
  const seen = new Set<number>();
  const ids: number[] = [];
  for (const id of [...prefer, ...live]) {
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    ids.push(id);
    if (ids.length === 4) {
      break;
    }
  }
  patch({
    screenWorkspaceId: workspaceId,
    screenSlots: [ids[0] ?? null, ids[1] ?? null, ids[2] ?? null, ids[3] ?? null],
  });
}

export function markNotificationsRead() {
  if (snapshot.notifications.every((item) => item.read)) {
    return;
  }
  patch({
    notifications: snapshot.notifications.map((item) => ({ ...item, read: true })),
  });
}

export function matchesQuery(value: string, query: string) {
  if (!query.trim()) {
    return true;
  }
  return value.toLowerCase().includes(query.trim().toLowerCase());
}
