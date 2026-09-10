export type AdminRole = "super_admin" | "org_admin" | "it_ops" | string;

export type IceServer = {
  urls: string | string[];
  username?: string;
  credential?: string;
};

export type StreamMode = "p2p-preferred" | "turn-relay" | "sfu" | string;

export type SfuHint = {
  enabled?: boolean;
  role?: string;
  trackName?: string;
  publisherSessionId?: string;
  subscriberSessionId?: string;
  publisherClientId?: number;
  providerLane?: number;
  providerLanes?: number[];
  fallbackModes?: string[];
  stunUrl?: string;
};

export type TransportPlan = {
  version?: number;
  mode?: StreamMode;
  reason?: string;
  phaseOneMs?: number;
  iceServers?: IceServer[];
  iceServersStunOnly?: IceServer[];
  iceServersFull?: IceServer[];
  viewerCount?: number;
  adminTargetCount?: number;
  sfu?: SfuHint;
};

export type SignalOrg = {
  id: number;
  name: string;
};

export type SignalAdmin = {
  id: number;
  orgId: number;
  username: string;
  fullName: string;
  role: AdminRole;
};

export type SignalSession = {
  token: string;
  expiresAt: number;
  admin: SignalAdmin;
  org: SignalOrg;
};

export type ScreenSource = {
  id: string;
  name: string;
  index?: number;
};

export type SignalClient = {
  id: number;
  fullName: string;
  status: "sharing" | "offline" | string;
  orgId: number;
  orgName?: string | null;
  claimedOrgName?: string | null;
  lastHeartbeatMs?: number;
  lastOnlineMs?: number | null;
  lastOfflineMs?: number | null;
  screenSources?: ScreenSource[];
  appVersion?: string;
  socketId?: string;
  deviceInfo?: unknown;
};

export type SignalLead = {
  id: number;
  orgId: number;
  username: string;
  fullName: string;
  role: AdminRole;
};

export type SignalMessage = Record<string, unknown> & {
  type?: string;
  success?: boolean;
  error?: string;
  message?: string;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  time: number;
  read: boolean;
  tone: "live" | "idle" | "error" | "info";
};
