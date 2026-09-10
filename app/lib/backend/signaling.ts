import { signalingConfig, socketUrl } from "./config";
import type { SignalMessage } from "./types";

type Handler = (message: SignalMessage) => void;

const HEARTBEAT_MS = 3000;

type Pending = {
  gen: number;
  responseType: string;
  match?: (message: SignalMessage) => boolean;
  resolve: (message: SignalMessage) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

function asMessage(value: unknown): SignalMessage | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as SignalMessage;
}

export class SignalingClient {
  private ws: WebSocket | null = null;
  private gen = 0;
  private attempt = 0;
  private wanted = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private typed = new Map<string, Set<Handler>>();
  private any = new Set<Handler>();
  private pending: Pending[] = [];
  private welcomeWaiters = new Set<{
    gen: number;
    resolve: () => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();

  get generation() {
    return this.gen;
  }

  get open() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  on(type: string, handler: Handler) {
    const bag = this.typed.get(type) ?? new Set<Handler>();
    bag.add(handler);
    this.typed.set(type, bag);
    return () => {
      bag.delete(handler);
    };
  }

  onAny(handler: Handler) {
    this.any.add(handler);
    return () => {
      this.any.delete(handler);
    };
  }

  connect() {
    this.wanted = true;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }
    this.openSocket();
  }

  disconnect() {
    this.wanted = false;
    this.clearReconnect();
    this.stopHeartbeat();
    this.failPending(new Error("Disconnected"));
    this.failWelcome(new Error("Disconnected"));
    this.ws?.close();
    this.ws = null;
  }

  send(message: SignalMessage) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error("Signaling is not connected");
    }
    this.ws.send(JSON.stringify(message));
  }

  request(
    type: string,
    payload: SignalMessage,
    responseType: string,
    timeoutMs = 12000,
    match?: (message: SignalMessage) => boolean,
  ) {
    const gen = this.gen;

    return new Promise<SignalMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pending.includes(pending)) {
          return;
        }
        this.pending = this.pending.filter((item) => item !== pending);
        reject(new Error(`Timed out waiting for ${responseType}`));
      }, timeoutMs);

      const pending: Pending = { gen, responseType, match, resolve, reject, timer };
      this.pending.push(pending);

      try {
        this.send({ ...payload, type });
      } catch (error) {
        clearTimeout(timer);
        this.pending = this.pending.filter((item) => item !== pending);
        reject(error instanceof Error ? error : new Error("Send failed"));
      }
    });
  }

  waitForWelcome(timeoutMs = 8000) {
    const gen = this.gen;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error("Timed out waiting for welcome"));
      }, timeoutMs);
      this.welcomeWaiters.add({ gen, resolve, reject, timer });
    });
  }

  private openSocket() {
    this.gen += 1;
    const gen = this.gen;
    const config = signalingConfig();

    try {
      this.ws = new WebSocket(socketUrl(config));
    } catch (error) {
      this.scheduleReconnect();
      this.emit({
        type: "client-connection-error",
        success: false,
        error: error instanceof Error ? error.message : "Socket failed",
      });
      return;
    }

    this.ws.onopen = () => {
      if (gen !== this.gen) {
        return;
      }
      this.attempt = 0;
      this.startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      if (gen !== this.gen) {
        return;
      }
      try {
        const message = asMessage(JSON.parse(String(event.data)));
        if (!message?.type) {
          return;
        }
        this.dispatch(gen, message);
      } catch {
        // Ignore malformed frames.
      }
    };

    this.ws.onerror = () => {
      if (gen !== this.gen) {
        return;
      }
      this.emit({ type: "client-connection-error", success: false, error: "SOCKET_ERROR" });
    };

    this.ws.onclose = () => {
      if (gen !== this.gen) {
        return;
      }
      this.stopHeartbeat();
      this.failPending(new Error("Disconnected"));
      this.failWelcome(new Error("Disconnected"));
      this.emit({ type: "client-disconnected", success: false });
      if (this.wanted) {
        this.scheduleReconnect();
      }
    };
  }

  private dispatch(gen: number, message: SignalMessage) {
    if (message.type === "heartbeat-ack") {
      return;
    }

    if (message.type === "welcome") {
      for (const waiter of [...this.welcomeWaiters]) {
        if (waiter.gen === gen) {
          clearTimeout(waiter.timer);
          this.welcomeWaiters.delete(waiter);
          waiter.resolve();
        }
      }
    }

    if (message.type === "error" && message.error === "RATE_LIMITED") {
      this.emit(message);
      return;
    }

    if (message.type) {
      const index = this.pending.findIndex((pending) => {
        if (pending.gen !== gen || pending.responseType !== message.type) {
          return false;
        }
        return pending.match ? pending.match(message) : true;
      });
      if (index >= 0) {
        const pending = this.pending[index];
        this.pending.splice(index, 1);
        clearTimeout(pending.timer);
        pending.resolve(message);
      }
    }

    this.emit(message);
  }

  private emit(message: SignalMessage) {
    if (message.type) {
      const bag = this.typed.get(message.type);
      if (bag) {
        for (const handler of bag) {
          handler(message);
        }
      }
    }
    for (const handler of this.any) {
      handler(message);
    }
  }

  private failPending(error: Error) {
    for (const pending of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending = [];
  }

  private failWelcome(error: Error) {
    for (const waiter of this.welcomeWaiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
    this.welcomeWaiters.clear();
  }

  private scheduleReconnect() {
    if (!this.wanted || this.reconnectTimer) {
      return;
    }
    const delay = Math.min(12000, 600 * 2 ** this.attempt) + Math.floor(Math.random() * 250);
    this.attempt += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.wanted) {
        this.openSocket();
      }
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: "heartbeat" }));
      }
    }, HEARTBEAT_MS);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

export const signaling = new SignalingClient();
