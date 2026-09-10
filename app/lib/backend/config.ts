export type SignalingConfig = {
  wsUrl: string;
  healthUrl: string;
  token: string;
};

function trimSlash(value: string) {
  return value.replace(/\/+$/, "");
}

export function signalingConfig(): SignalingConfig {
  const raw = (
    process.env.NEXT_PUBLIC_SIGNALING_URL || "wss://relay.salesradar.live"
  ).trim();
  const token = (
    process.env.NEXT_PUBLIC_WS_CONNECT_TOKEN || "aw_ws_dev_token_2026"
  ).trim();
  const wsUrl = raw.startsWith("http://")
    ? `ws://${raw.slice("http://".length)}`
    : raw.startsWith("https://")
      ? `wss://${raw.slice("https://".length)}`
      : raw;
  const httpUrl = wsUrl.startsWith("wss://")
    ? `https://${wsUrl.slice("wss://".length)}`
    : wsUrl.startsWith("ws://")
      ? `http://${wsUrl.slice("ws://".length)}`
      : wsUrl;

  return {
    wsUrl: trimSlash(wsUrl),
    healthUrl: `${trimSlash(httpUrl)}/health`,
    token,
  };
}

export function socketUrl(config = signalingConfig()) {
  const url = new URL(config.wsUrl);
  url.searchParams.set("token", config.token);
  return url.toString();
}
