import { signaling } from "./signaling";
import type { IceServer, SignalClient, TransportPlan } from "./types";

export type ViewStatus = "idle" | "connecting" | "live" | "error";

/** Where a view got to, so a dead pane can say why instead of just "No signal". */
export type ViewStage =
  | "requesting"
  | "negotiating"
  | "awaiting-media"
  | "streaming"
  | "failed";

export type ViewSnapshot = {
  clientId: number;
  name: string;
  status: ViewStatus;
  stage: ViewStage;
  error: string | null;
  mode: string;
};

type Listener = () => void;

type ViewSession = {
  gen: number;
  queue: Promise<void>;
  client: SignalClient;
  pc: RTCPeerConnection | null;
  stream: MediaStream | null;
  remoteReady: boolean;
  offered: boolean;
  answered: boolean;
  sawStartOffer: boolean;
  status: ViewStatus;
  error: string | null;
  mode: string;
  stage: ViewStage;
  plan: TransportPlan | null;
  sessionId: number | null;
  clientSocketId: string;
  iceQueue: RTCIceCandidateInit[];
  phaseTimer: ReturnType<typeof setTimeout> | null;
  waitTimer: ReturnType<typeof setTimeout> | null;
  recoverTimer: ReturnType<typeof setTimeout> | null;
};

const RELAY_TYPES = new Set([
  "start-offer",
  "client-ready",
  "offer",
  "answer",
  "ice-candidate",
  "agent-disconnected",
  "client-disconnected",
]);

const STREAM_TIMEOUT_MS = 15000;
const CONNECT_RETRIES = 3;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const views = new Map<number, ViewSession>();
const listeners = new Set<Listener>();
let bound = false;
let cachedSnapshots: ViewSnapshot[] = [];

function emit() {
  cachedSnapshots = [...views.values()].map(snapshotOf);
  for (const listener of listeners) {
    listener();
  }
}

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

function iceList(servers?: IceServer[]): RTCIceServer[] {
  if (!servers?.length) {
    return [];
  }
  return servers.map((server) => ({
    urls: server.urls,
    username: server.username,
    credential: server.credential,
  }));
}

function planFrom(message: Record<string, unknown>, fallback?: TransportPlan | null): TransportPlan {
  const raw = asRecord(message.streamTransport);
  if (!raw) {
    return fallback ?? {};
  }
  return raw as TransportPlan;
}

// The agent sends `sdp` as a full RTCSessionDescriptionInit object; older builds
// sent a bare SDP string, so accept both shapes.
function sdpFrom(message: Record<string, unknown>): RTCSessionDescriptionInit | null {
  const nested =
    asRecord(message.sdp) ||
    asRecord(message.sessionDescription) ||
    asRecord(message.offer) ||
    asRecord(message.answer);
  const sdp = asString(nested?.sdp) || asString(message.sdp);
  if (!sdp) {
    return null;
  }
  const type = asString(nested?.type) || asString(message.type);
  return type === "offer" || type === "answer" ? { type, sdp } : null;
}

function candidateFrom(message: Record<string, unknown>): RTCIceCandidateInit | null {
  const raw = message.candidate ?? message.iceCandidate;
  if (!raw) {
    return null;
  }
  if (typeof raw === "string") {
    return { candidate: raw, sdpMid: asString(message.sdpMid) || "0", sdpMLineIndex: 0 };
  }
  const record = asRecord(raw);
  if (!record) {
    return null;
  }
  return record as RTCIceCandidateInit;
}

function enqueue(view: ViewSession, work: () => Promise<void>) {
  view.queue = view.queue.then(work, work);
  return view.queue;
}

function snapshotOf(view: ViewSession): ViewSnapshot {
  return {
    clientId: view.client.id,
    name: view.client.fullName,
    status: view.status,
    stage: view.stage,
    error: view.error,
    mode: view.mode,
  };
}

export function subscribeStreams(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function streamSnapshots(): ViewSnapshot[] {
  return cachedSnapshots;
}

export function mediaFor(clientId: number) {
  return views.get(clientId)?.stream ?? null;
}

/** WebKitGTK builds without the GStreamer WebRTC stack expose no RTCPeerConnection. */
export function webrtcSupported() {
  return typeof RTCPeerConnection !== "undefined";
}

export function bindStreamSignaling() {
  if (bound) {
    return;
  }
  bound = true;

  signaling.onAny((message) => {
    const type = asString(message.type);
    if (!type) {
      return;
    }
    if (RELAY_TYPES.has(type)) {
      void handleSignal(message);
    }
  });
}

// Relayed frames carry fromSocketId/fromName; server-direct frames carry clientId.
function viewFor(message: Record<string, unknown>) {
  const clientId = asNumber(message.clientId);
  if (clientId) {
    const exact = views.get(clientId);
    if (exact) {
      return exact;
    }
  }
  const socketId = asString(message.fromSocketId) || asString(message.clientSocketId);
  const name = asString(message.fromName) || asString(message.clientFullName);
  for (const view of views.values()) {
    if (socketId && view.clientSocketId === socketId) {
      return view;
    }
  }
  for (const view of views.values()) {
    if (name && view.client.fullName === name) {
      return view;
    }
  }
  return null;
}

async function handleSignal(message: Record<string, unknown>) {
  const view = viewFor(message);
  if (!view) {
    return;
  }
  const type = asString(message.type);

  // Drop frames belonging to a superseded session for this client.
  const incomingSession = asNumber(message.sessionId);
  if (incomingSession && view.sessionId && incomingSession < view.sessionId) {
    return;
  }

  if (type === "start-offer") {
    if (message.success === false) {
      return;
    }
    // Set synchronously: the server emits start-offer before connect-response,
    // so the connect path must know not to negotiate a second time.
    view.sawStartOffer = true;
    const socketId = asString(message.clientSocketId);
    const session = incomingSession;
    await enqueue(view, async () => {
      const gen = view.gen;
      view.sessionId = session ?? view.sessionId;
      view.clientSocketId = socketId || view.clientSocketId;
      await ensurePeer(view, planFrom(message, view.plan));
      if (gen !== view.gen) {
        return;
      }
      await createViewerOffer(view);
    });
    return;
  }

  if (type === "client-ready") {
    await enqueue(view, async () => {
      if (!view.offered) {
        await createViewerOffer(view);
      }
    });
    return;
  }

  if (type === "agent-disconnected" || type === "client-disconnected") {
    await enqueue(view, async () => {
      if (view.status !== "live") {
        return;
      }
      view.status = "error";
      view.error = "Agent ended the session";
      emit();
    });
    return;
  }

  if (type === "offer") {
    const desc = sdpFrom(message);
    if (desc) {
      await enqueue(view, async () => acceptRemoteOffer(view, desc));
    }
    return;
  }

  if (type === "answer") {
    const desc = sdpFrom(message);
    if (desc) {
      await enqueue(view, async () => acceptAnswer(view, desc));
    }
    return;
  }

  if (type === "ice-candidate") {
    const candidate = candidateFrom(message);
    if (candidate) {
      await enqueue(view, async () => addCandidate(view, candidate));
    }
  }
}

async function ensurePeer(view: ViewSession, plan: TransportPlan) {
  clearTimers(view);
  view.pc?.close();
  view.stream = null;
  view.remoteReady = false;
  view.offered = false;
  view.answered = false;
  view.iceQueue = [];
  view.plan = plan;
  view.mode = plan.mode || "p2p-preferred";
  view.stage = "negotiating";

  const stun = iceList(plan.iceServersStunOnly);
  const full = iceList(plan.iceServersFull?.length ? plan.iceServersFull : plan.iceServers);
  const phaseOne = view.mode === "p2p-preferred" && stun.length > 0 && full.length > 0;
  const pc = new RTCPeerConnection({
    iceServers: phaseOne ? stun : full.length ? full : stun,
    iceCandidatePoolSize: 10,
    iceTransportPolicy: "all",
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  });

  view.pc = pc;
  // The agent publishes video only; asking for audio makes it renegotiate for nothing.
  pc.addTransceiver("video", { direction: "recvonly" });

  pc.onicecandidate = (event) => {
    if (!event.candidate || !view.clientSocketId) {
      return;
    }
    try {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
      signaling.send({
        type: "ice-candidate",
        candidate: { candidate, sdpMid, sdpMLineIndex },
        targetSocketId: view.clientSocketId,
        ...(view.sessionId ? { sessionId: view.sessionId } : {}),
      });
    } catch {
      // Socket dropped mid-candidate.
    }
  };

  pc.ontrack = (event) => {
    if (event.track.kind !== "video") {
      return;
    }
    const inbound = event.streams[0] ?? new MediaStream([event.track]);
    view.stream = inbound;
    view.status = "live";
    view.stage = "streaming";
    view.error = null;
    if (view.waitTimer) {
      clearTimeout(view.waitTimer);
      view.waitTimer = null;
    }
    emit();
  };

  pc.onconnectionstatechange = () => {
    if (view.pc !== pc) {
      return;
    }
    if (pc.connectionState === "failed") {
      view.status = "error";
      view.stage = "failed";
      view.error = "Media path failed (ICE)";
      emit();
      return;
    }
    if (pc.connectionState === "connected" && view.stream) {
      view.status = "live";
      view.stage = "streaming";
      view.error = null;
      emit();
    }
  };

  // A brief `disconnected` is normal on network flaps; only re-offer if it sticks.
  pc.oniceconnectionstatechange = () => {
    if (view.pc !== pc) {
      return;
    }
    if (pc.iceConnectionState === "disconnected" && !view.recoverTimer) {
      view.recoverTimer = setTimeout(() => {
        view.recoverTimer = null;
        if (view.pc !== pc || pc.iceConnectionState !== "disconnected") {
          return;
        }
        try {
          pc.restartIce();
        } catch {
          // Webview may not support restart; the connection-state handler will fail it.
        }
      }, 4500);
    }
    if (pc.iceConnectionState === "connected" && view.recoverTimer) {
      clearTimeout(view.recoverTimer);
      view.recoverTimer = null;
    }
  };

  if (phaseOne) {
    const wait = Math.max(2500, plan.phaseOneMs || 5000);
    view.phaseTimer = setTimeout(() => {
      if (view.pc !== pc || pc.connectionState === "connected" || pc.connectionState === "closed") {
        return;
      }
      if (!full.length) {
        return;
      }
      try {
        pc.setConfiguration({
          iceServers: full,
          iceCandidatePoolSize: 10,
          iceTransportPolicy: "all",
          bundlePolicy: "max-bundle",
          rtcpMuxPolicy: "require",
        });
        pc.restartIce();
      } catch {
        // Older webviews may reject restart; keep the current path.
      }
    }, wait);
  }
}

async function createViewerOffer(view: ViewSession) {
  const pc = view.pc;
  if (!pc || view.offered || !view.clientSocketId) {
    return;
  }
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  view.offered = true;
  view.stage = "awaiting-media";
  signaling.send({
    type: "offer",
    sdp: { type: offer.type, sdp: offer.sdp },
    targetSocketId: view.clientSocketId,
    ...(view.sessionId ? { sessionId: view.sessionId } : {}),
  });
  emit();
}

// The admin is always the offerer. A remote offer only ever means the agent is
// renegotiating (source switch), which is valid solely from a stable state.
async function acceptRemoteOffer(view: ViewSession, desc: RTCSessionDescriptionInit) {
  const pc = view.pc;
  if (!pc || pc.signalingState !== "stable") {
    return;
  }
  await pc.setRemoteDescription(desc);
  view.remoteReady = true;
  await flushIce(view);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  view.answered = true;
  signaling.send({
    type: "answer",
    sdp: { type: answer.type, sdp: answer.sdp },
    targetSocketId: view.clientSocketId,
    ...(view.sessionId ? { sessionId: view.sessionId } : {}),
  });
}

async function acceptAnswer(view: ViewSession, desc: RTCSessionDescriptionInit) {
  const pc = view.pc;
  if (!pc || pc.signalingState !== "have-local-offer") {
    return;
  }
  await pc.setRemoteDescription(desc);
  view.remoteReady = true;
  await flushIce(view);
}

async function addCandidate(view: ViewSession, candidate: RTCIceCandidateInit) {
  if (!view.remoteReady || !view.pc) {
    view.iceQueue.push(candidate);
    return;
  }
  try {
    await view.pc.addIceCandidate(candidate);
  } catch {
    // Duplicate or late candidates are safe to ignore.
  }
}

async function flushIce(view: ViewSession) {
  if (!view.pc) {
    return;
  }
  const queued = view.iceQueue;
  view.iceQueue = [];
  for (const candidate of queued) {
    try {
      await view.pc.addIceCandidate(candidate);
    } catch {
      // Ignore stale candidates.
    }
  }
}

async function trySfu(view: ViewSession, plan: TransportPlan, token: string) {
  const hint = plan.sfu;
  if (!hint?.enabled || !hint.publisherSessionId || !hint.trackName) {
    return false;
  }

  const created = await signaling.request(
    "sfu-api",
    { token, requestId: `sfu-${view.client.id}-${view.gen}`, op: "sessions-new", providerLane: hint.providerLane },
    "sfu-api-response",
    8000,
    (message) => String(message.requestId ?? "") === `sfu-${view.client.id}-${view.gen}`,
  );
  if (!created.success) {
    return false;
  }

  const sessionId = asString(created.sessionId);
  if (!sessionId || !view.pc) {
    return false;
  }

  const offer = await view.pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
  await view.pc.setLocalDescription(offer);
  view.offered = true;

  const tracks = await signaling.request(
    "sfu-api",
    {
      token,
      requestId: `tracks-${view.client.id}-${view.gen}`,
      op: "tracks-new",
      sessionId,
      providerLane: created.providerLane ?? hint.providerLane,
      body: {
        sessionDescription: { type: "offer", sdp: offer.sdp },
        tracks: [
          {
            location: "remote",
            sessionId: hint.publisherSessionId,
            trackName: hint.trackName,
          },
        ],
      },
    },
    "sfu-api-response",
    10000,
    (message) => String(message.requestId ?? "") === `tracks-${view.client.id}-${view.gen}`,
  );

  if (!tracks.success) {
    return false;
  }

  const data = asRecord(tracks.data);
  const answer = sdpFrom(data ?? {}) || sdpFrom(asRecord(data?.sessionDescription) ?? {});
  const nested = asRecord(data?.sessionDescription);
  const desc = answer || (nested?.sdp ? { type: "answer" as const, sdp: asString(nested.sdp) } : null);
  if (!desc) {
    return false;
  }
  await view.pc.setRemoteDescription(desc.type === "offer" ? { type: "answer", sdp: desc.sdp } : desc);
  view.remoteReady = true;
  return true;
}

function clearTimers(view: ViewSession) {
  if (view.phaseTimer) {
    clearTimeout(view.phaseTimer);
    view.phaseTimer = null;
  }
  if (view.waitTimer) {
    clearTimeout(view.waitTimer);
    view.waitTimer = null;
  }
  if (view.recoverTimer) {
    clearTimeout(view.recoverTimer);
    view.recoverTimer = null;
  }
}

function teardown(view: ViewSession, token?: string) {
  clearTimers(view);
  view.gen += 1;
  view.pc?.close();
  view.pc = null;
  view.stream = null;
  view.remoteReady = false;
  view.offered = false;
  view.answered = false;
  view.sawStartOffer = false;
  view.iceQueue = [];
  if (token) {
    try {
      signaling.send({
        type: "admin-stop-viewing",
        token,
        clientId: view.client.id,
        clientSocketId: view.clientSocketId,
      });
    } catch {
      // Best-effort unlink.
    }
  }
}

export async function watchClient(
  client: SignalClient,
  token: string,
  welcomePlan?: TransportPlan | null,
) {
  bindStreamSignaling();
  const existing = views.get(client.id);
  const nextSocket = client.socketId || "";
  if (
    existing &&
    existing.clientSocketId === nextSocket &&
    (existing.status === "connecting" || existing.status === "live")
  ) {
    return;
  }
  if (existing && existing.clientSocketId !== nextSocket) {
    teardown(existing, token);
  }

  const view: ViewSession = existing ?? {
    gen: 0,
    queue: Promise.resolve(),
    client,
    pc: null,
    stream: null,
    remoteReady: false,
    offered: false,
    answered: false,
    sawStartOffer: false,
    status: "connecting",
    error: null,
    mode: welcomePlan?.mode || "p2p-preferred",
    stage: "requesting",
    plan: welcomePlan ?? null,
    sessionId: null,
    clientSocketId: client.socketId || "",
    iceQueue: [],
    phaseTimer: null,
    waitTimer: null,
    recoverTimer: null,
  };
  view.client = client;
  view.status = "connecting";
  view.stage = "requesting";
  view.sawStartOffer = false;
  view.sessionId = null;
  view.clientSocketId = nextSocket;
  view.error = null;
  views.set(client.id, view);
  emit();

  if (!webrtcSupported()) {
    view.status = "error";
    view.stage = "failed";
    view.error = "This webview has no WebRTC support";
    emit();
    return;
  }

  await enqueue(view, async () => {
    const gen = ++view.gen;
    try {
      let connected = await signaling.request(
        "connect-to-client",
        { token, clientId: client.id },
        "connect-response",
        12000,
        (message) => Number(message.clientId) === client.id,
      );

      // The roster can list an agent a beat before its socket is resolvable.
      for (let attempt = 0; attempt < CONNECT_RETRIES; attempt += 1) {
        if (connected.success || asString(connected.error) !== "CLIENT_UNAVAILABLE") {
          break;
        }
        await delay(2000);
        if (gen !== view.gen) {
          return;
        }
        connected = await signaling.request(
          "connect-to-client",
          { token, clientId: client.id },
          "connect-response",
          12000,
          (message) => Number(message.clientId) === client.id,
        );
      }

      if (gen !== view.gen) {
        return;
      }

      if (!connected.success) {
        const code = asString(connected.error);
        view.status = "error";
        view.stage = "failed";
        view.error =
          code === "CLIENT_UNAVAILABLE"
            ? "Agent went offline"
            : code === "FORBIDDEN"
              ? "Not permitted to view this agent"
              : code === "MAX_VIEWERS_REACHED"
                ? "Agent already at viewer limit"
                : asString(connected.message) || code || "Agent unavailable";
        emit();
        return;
      }

      // `start-offer` arrives just before this response and drives negotiation.
      // Only build the peer here if that frame was missed.
      view.sessionId = view.sessionId ?? asNumber(connected.sessionId);
      view.clientSocketId =
        view.clientSocketId || asString(connected.clientSocketId) || client.socketId || "";

      if (!view.pc && !view.sawStartOffer) {
        const plan = planFrom(connected, welcomePlan);
        await ensurePeer(view, plan);
        if (gen !== view.gen) {
          return;
        }
        if (plan.mode === "sfu") {
          const used = await trySfu(view, plan, token);
          if (used || gen !== view.gen) {
            return;
          }
          await ensurePeer(view, { ...plan, mode: "turn-relay" });
        }
        await createViewerOffer(view);
      }

      view.waitTimer = setTimeout(() => {
        if (view.gen !== gen || view.status === "live") {
          return;
        }
        view.status = "error";
        view.stage = "failed";
        view.error = view.remoteReady
          ? "Agent answered but sent no video"
          : "Agent did not answer the offer";
        emit();
      }, STREAM_TIMEOUT_MS);
    } catch (error) {
      if (gen !== view.gen) {
        return;
      }
      view.status = "error";
      view.stage = "failed";
      view.error = error instanceof Error ? error.message : "Stream failed";
      emit();
    }
  });
}

export async function unwatchClient(clientId: number, token?: string) {
  const view = views.get(clientId);
  if (!view) {
    return;
  }
  teardown(view, token);
  views.delete(clientId);
  emit();
}

export async function unwatchAll(token?: string) {
  for (const view of views.values()) {
    teardown(view, token);
  }
  views.clear();
  emit();
}

export async function watchRoster(
  clients: SignalClient[],
  token: string,
  welcomePlan?: TransportPlan | null,
  limit = 12,
) {
  const live = clients.filter((client) => client.status === "sharing").slice(0, limit);
  const keep = new Set(live.map((client) => client.id));

  await Promise.all(
    [...views.keys()]
      .filter((id) => !keep.has(id))
      .map((id) => unwatchClient(id, token)),
  );

  for (const client of live) {
    void watchClient(client, token, welcomePlan);
  }
}
