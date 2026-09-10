// Read-only probe: validates a signaling host end to end without mutating anything.
// Usage: node scripts/probe-signaling.mjs [wsUrl] [wsToken] [orgName user pass]
const url = process.argv[2] || "wss://relay.salesradar.live";
const wsToken = process.argv[3] || "aw_ws_dev_token_2026";
const orgName = process.argv[4] || "";
const username = process.argv[5] || "";
const password = process.argv[6] || "";

const target = new URL(url);
target.searchParams.set("token", wsToken);

const log = (...a) => console.log(new Date().toISOString().slice(11, 23), ...a);
const ws = new WebSocket(target.toString());
const send = (m) => ws.send(JSON.stringify(m));

let sessionToken = "";
const timeout = setTimeout(() => {
  log("DONE (timeout)");
  process.exit(0);
}, 25000);

ws.onopen = () => log("OPEN", target.origin);
ws.onerror = (e) => log("ERROR", e.message || String(e));
ws.onclose = (e) => {
  log("CLOSE", e.code, e.reason);
  clearTimeout(timeout);
  process.exit(0);
};

ws.onmessage = (event) => {
  const msg = JSON.parse(String(event.data));
  switch (msg.type) {
    case "heartbeat-ack":
      return;
    case "welcome":
      log("welcome socketId=", msg.socketId, "iceServers=", (msg.iceServers || []).length);
      log("  transport=", JSON.stringify(msg.streamTransport || null));
      setInterval(() => send({ type: "heartbeat" }), 3000);
      send({ type: "public-list-orgs" });
      break;
    case "public-list-orgs-response":
      log("orgs:", JSON.stringify(msg.orgs || msg.organizations || []));
      if (orgName && username) {
        send({ type: "admin-login", orgName, username, password, workstationIps: [] });
      } else {
        log("no credentials supplied -> stopping after roster-less probe");
        ws.close();
      }
      break;
    case "admin-login-response":
      log("login success=", msg.success, "error=", msg.error || "-", "role=", msg.admin?.role);
      if (!msg.success) return ws.close();
      sessionToken = msg.token;
      send({ type: "admin-get-clients", token: sessionToken, workstationIps: [] });
      break;
    case "admin-get-clients-response":
    case "admin-clients-updated": {
      const clients = msg.clients || [];
      const sharing = clients.filter((c) => c.status === "sharing");
      log(`roster(${msg.type}): total=${clients.length} sharing=${sharing.length}`);
      for (const c of clients.slice(0, 25)) {
        log(`  #${c.id} ${c.fullName} status=${c.status} socket=${c.socketId || c.socket_id || "-"}`);
      }
      if (msg.type === "admin-get-clients-response") {
        if (sharing.length) {
          log("--> attempting connect-to-client on", sharing[0].id, sharing[0].fullName);
          send({ type: "connect-to-client", token: sessionToken, clientId: sharing[0].id, workstationIps: [] });
        } else {
          log("--> NO SHARING CLIENTS on this host");
          ws.close();
        }
      }
      break;
    }
    case "start-offer":
      log("start-offer:", JSON.stringify(msg));
      break;
    case "connect-response":
      log("connect-response:", JSON.stringify(msg));
      if (!msg.success) ws.close();
      break;
    case "access-restricted":
      log("ACCESS RESTRICTED:", JSON.stringify(msg));
      ws.close();
      break;
    case "client-ready":
    case "offer":
    case "answer":
    case "ice-candidate":
      log("relay <-", msg.type, "from", msg.fromName, msg.fromSocketId, "keys=", Object.keys(msg).join(","));
      break;
    case "error":
      log("server error:", JSON.stringify(msg));
      break;
    default:
      log("<-", msg.type, JSON.stringify(msg).slice(0, 300));
  }
};
