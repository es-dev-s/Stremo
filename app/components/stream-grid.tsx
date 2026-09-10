"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  mediaFor,
  streamSnapshots,
  subscribeStreams,
  unwatchAll,
  watchRoster,
  webrtcSupported,
  type ViewSnapshot,
} from "../lib/backend/webrtc";
import { signalingConfig } from "../lib/backend/config";
import { setScreenSlot } from "../lib/backend/store";
import { useWorkspaceData } from "../lib/backend/use-platform";
import { agentLabel, agentStatus, initialsFrom } from "../lib/data";
import type { SignalClient } from "../lib/backend/types";

function useViews() {
  return useSyncExternalStore(subscribeStreams, streamSnapshots, streamSnapshots);
}

function clientById(clients: SignalClient[], id: number | null) {
  if (id == null) {
    return null;
  }
  return clients.find((client) => client.id === id) ?? null;
}

function VideoPane({
  client,
  view,
  active,
  hud,
  onPick,
}: {
  client: SignalClient | null;
  view: ViewSnapshot | undefined;
  active: boolean;
  hud: boolean;
  onPick: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const live = view?.status === "live";
  const clientId = client?.id ?? null;

  useEffect(() => {
    const node = videoRef.current;
    if (!node) {
      return;
    }
    const attach = () => {
      const stream = clientId != null ? mediaFor(clientId) : null;
      if (node.srcObject !== stream) {
        node.srcObject = stream;
        if (stream) {
          void node.play().catch(() => undefined);
        }
      }
    };
    attach();
    return subscribeStreams(attach);
  }, [clientId, view?.status]);

  const waiting = client && client.status !== "sharing";
  const connecting = client && client.status === "sharing" && view?.status !== "error" && !live;
  const failed = view?.status === "error";

  const stageLabel =
    view?.stage === "negotiating"
      ? "Negotiating…"
      : view?.stage === "awaiting-media"
        ? "Waiting for agent video…"
        : "Connecting…";

  return (
    <button
      type="button"
      onClick={onPick}
      className={`cctv-cell ${active ? "cctv-cell-active" : ""}`}
      aria-label={client ? `Choose replacement for ${client.fullName}` : "Assign agent to this pane"}
    >
      <video ref={videoRef} className="cctv-video" autoPlay muted playsInline />
      {!live ? (
        <div className="cctv-empty">
          <p>
            {!client
              ? hud || active
                ? "Click to assign"
                : ""
              : failed
                ? view?.error || "No signal"
                : waiting
                  ? "Agent offline — not publishing"
                  : connecting
                    ? stageLabel
                    : "No signal"}
          </p>
        </div>
      ) : null}
      {client ? (
        <div className="cctv-meta">
          <span className="cctv-name">{client.fullName}</span>
          <span className={`cctv-rec ${live ? "is-live" : ""}`}>{live ? "LIVE" : "NO SIG"}</span>
        </div>
      ) : null}
    </button>
  );
}

function Picker({
  slot,
  clients,
  selectedIds,
  onClose,
}: {
  slot: number;
  clients: SignalClient[];
  selectedIds: Set<number>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const list = clients.filter((client) => {
    if (!query.trim()) {
      return true;
    }
    const hay = `${client.fullName} ${client.orgName ?? ""}`.toLowerCase();
    return hay.includes(query.trim().toLowerCase());
  });

  return (
    <div className="cctv-picker" role="dialog" aria-label="Choose agent">
      <div className="cctv-picker-panel">
        <div className="cctv-picker-head">
          <p>Pane {slot + 1}</p>
          <button type="button" onClick={onClose} className="cctv-picker-close">
            Close
          </button>
        </div>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search agents"
          className="cctv-picker-search"
        />
        <ul className="cctv-picker-list">
          <li>
            <button
              type="button"
              onClick={() => {
                setScreenSlot(slot, null);
                onClose();
              }}
              className="cctv-picker-item"
            >
              <span>Clear pane</span>
            </button>
          </li>
          {list.map((client) => {
            const live = client.status === "sharing";
            const taken = selectedIds.has(client.id);
            return (
              <li key={client.id}>
                <button
                  type="button"
                  onClick={() => {
                    setScreenSlot(slot, client.id);
                    onClose();
                  }}
                  className="cctv-picker-item"
                >
                  <span className="cctv-picker-avatar">{initialsFrom(client.fullName)}</span>
                  <span className="min-w-0 flex-1 truncate text-left">{client.fullName}</span>
                  <span className="cctv-picker-status">
                    {taken ? "On wall" : live ? "Live" : agentLabel(agentStatus(client))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export function StreamGrid({ onLeave }: { onLeave: () => void | Promise<void> }) {
  const data = useWorkspaceData();
  const views = useViews();
  const token = data.session?.token ?? "";
  const [hud, setHud] = useState(true);
  const [slot, setSlot] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slotRef = useRef<number | null>(null);

  useEffect(() => {
    slotRef.current = slot;
  }, [slot]);

  const selected = data.screenSlots;
  const selectedIds = useMemo(
    () => new Set(selected.filter((id): id is number => id != null)),
    [selected],
  );

  const targets = useMemo(() => {
    return selected
      .map((id) => clientById(data.clients, id))
      .filter((client): client is SignalClient => Boolean(client && client.status === "sharing"));
  }, [data.clients, selected]);

  const rosterKey = targets.map((client) => `${client.id}:${client.socketId || ""}`).join(",");
  const viewById = useMemo(() => new Map(views.map((view) => [view.clientId, view])), [views]);

  useEffect(() => {
    if (!token) {
      return;
    }
    void watchRoster(targets, token, data.transport, 4);
    // rosterKey stands in for `targets`: a new array identity on every roster
    // refresh would retrigger the watch and churn the peer connections.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, rosterKey, data.transport]);

  useEffect(() => {
    return () => {
      void unwatchAll(token);
    };
  }, [token]);

  useEffect(() => {
    function bump() {
      setHud(true);
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      hideTimer.current = setTimeout(() => setHud(false), 2200);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      if (slotRef.current != null) {
        setSlot(null);
        return;
      }
      onLeave();
    }
    bump();
    window.addEventListener("mousemove", bump);
    window.addEventListener("pointerdown", bump);
    window.addEventListener("keydown", onKeyDown, { capture: true });
    return () => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
      }
      window.removeEventListener("mousemove", bump);
      window.removeEventListener("pointerdown", bump);
      window.removeEventListener("keydown", onKeyDown, { capture: true });
    };
  }, [onLeave]);

  const liveCount = data.clients.filter((client) => client.status === "sharing").length;
  const host = signalingConfig().wsUrl;

  return (
    <div className="cctv-wall">
      {selected.map((id, index) => {
        const client = clientById(data.clients, id);
        return (
          <VideoPane
            key={index}
            client={client}
            view={client ? viewById.get(client.id) : undefined}
            active={slot === index}
            hud={hud}
            onPick={() => setSlot(index)}
          />
        );
      })}
      {hud && slot == null ? (
        <p className="cctv-hint">
          {!webrtcSupported()
            ? "This webview has no WebRTC support — install the GStreamer WebRTC plugins"
            : liveCount === 0
              ? `No agents publishing to ${host}. Click a pane to assign · Esc to leave`
              : "Click a pane to choose an agent · Esc to leave"}
        </p>
      ) : null}
      {slot != null ? (
        <Picker
          slot={slot}
          clients={data.clients}
          selectedIds={selectedIds}
          onClose={() => setSlot(null)}
        />
      ) : null}
    </div>
  );
}
