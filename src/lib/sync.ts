/**
 * Realtime kiosk ↔ admin sync over PeerJS (WebRTC, free cloud signaling).
 *
 *  - Kiosk device hosts a peer with a stable ID derived from a 4-digit shop code
 *    (shown on the kiosk screen, entered once on the admin device).
 *  - Admin device connects to that peer and receives a full snapshot + live
 *    order events. Admin actions (done/delete) flow back to the kiosk too.
 *  - Everything still works offline via the local store — sync only enhances it.
 */
import { useEffect, useState } from "react";
import type Peer from "peerjs";
import type { DataConnection } from "peerjs";
import type { OrderRecord } from "./store";
import { clearOrders, deleteOrder, getOrders, patchOrder, saveOrder, setBroadcastHook } from "./store";

export type SyncStatus = "off" | "connecting" | "live";

type Msg =
  | { t: "snapshot"; orders: OrderRecord[] }
  | { t: "upsert"; order: OrderRecord }
  | { t: "delete"; id: string }
  | { t: "clear" }
  | { t: "patch"; id: string; patch: Partial<OrderRecord>; event?: string };

/* ---------------- status ---------------- */
let status: SyncStatus = "off";
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}

export function getSyncStatus(): SyncStatus {
  return status;
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(status);
  useEffect(() => {
    const l = (v: SyncStatus) => setS(v);
    statusListeners.add(l);
    return () => {
      statusListeners.delete(l);
    };
  }, []);
  return s;
}

/* ---------------- stable kiosk code ---------------- */
const CODE_KEY = "jds_kiosk_code";

export function getKioskCode(): string {
  try {
    let c = window.localStorage.getItem(CODE_KEY);
    if (!c) {
      c = String(Math.floor(1000 + Math.random() * 9000));
      window.localStorage.setItem(CODE_KEY, c);
    }
    return c;
  } catch {
    return "0000";
  }
}

const peerIdFor = (code: string) => `jds-kiosk-${code}`;

/* ---------------- kiosk (host) mode ---------------- */
let kioskPeer: Peer | null = null;
const conns = new Set<DataConnection>();

function send(conn: DataConnection, msg: Msg) {
  try {
    if (conn.open) conn.send(msg);
  } catch {
    /* drop */
  }
}

function forwardToOthers(origin: DataConnection, msg: Msg) {
  conns.forEach((c) => {
    if (c !== origin) send(c, msg);
  });
}

export async function startKioskSync(code: string) {
  if (kioskPeer) return;
  const { default: PeerCtor } = await import("peerjs");
  setStatus("connecting");
  const peer = new PeerCtor(peerIdFor(code), { debug: 0 });
  kioskPeer = peer;

  peer.on("open", () => setStatus("live"));
  peer.on("disconnected", () => {
    setStatus("connecting");
    try {
      peer.reconnect();
    } catch {
      /* noop */
    }
  });
  peer.on("error", (err) => {
    const name = (err as { type?: string }).type;
    if (name === "peer-unavailable") return; // admin tried a wrong code — ignore
    setStatus("off");
  });

  peer.on("connection", (conn) => {
    conns.add(conn);
    conn.on("open", () => {
      setStatus("live");
      send(conn, { t: "snapshot", orders: getOrders() });
    });
    conn.on("data", (raw) => {
      const m = raw as Msg;
      switch (m.t) {
        case "upsert":
          saveOrder(m.order, true);
          forwardToOthers(conn, m);
          break;
        case "delete":
          deleteOrder(m.id, true);
          forwardToOthers(conn, m);
          break;
        case "clear":
          clearOrders(true);
          forwardToOthers(conn, m);
          break;
        case "patch":
          patchOrder(m.id, m.patch, m.event, true);
          forwardToOthers(conn, m);
          break;
        default:
          break;
      }
    });
    conn.on("close", () => {
      conns.delete(conn);
      if (conns.size === 0) setStatus("live");
    });
    conn.on("error", () => conns.delete(conn));
  });

  /* local kiosk changes → broadcast to linked admins */
  setBroadcastHook((m) => {
    conns.forEach((c) => send(c, m));
  });
}

/* ---------------- admin (client) mode ---------------- */
let adminPeer: Peer | null = null;
let adminConn: DataConnection | null = null;
let adminCode = "";
let retryTimer: number | null = null;
let connectFailTimer: number | null = null;

const ADMIN_CODE_KEY = "jds_admin_code";

export function getSavedAdminCode(): string {
  try {
    return window.localStorage.getItem(ADMIN_CODE_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveAdminCode(code: string) {
  try {
    if (code) window.localStorage.setItem(ADMIN_CODE_KEY, code);
    else window.localStorage.removeItem(ADMIN_CODE_KEY);
  } catch {
    /* noop */
  }
}

function clearTimers() {
  if (retryTimer) window.clearTimeout(retryTimer);
  retryTimer = null;
  if (connectFailTimer) window.clearTimeout(connectFailTimer);
  connectFailTimer = null;
}

function tryConnect() {
  if (!adminPeer || !adminCode) return;
  if (adminConn) {
    try {
      adminConn.close();
    } catch {
      /* noop */
    }
    adminConn = null;
  }
  setStatus("connecting");
  const conn = adminPeer.connect(peerIdFor(adminCode), { reliable: true });
  adminConn = conn;

  connectFailTimer = window.setTimeout(() => {
    if (!conn.open) {
      setStatus("off");
      scheduleRetry();
    }
  }, 9000);

  conn.on("open", () => {
    if (connectFailTimer) window.clearTimeout(connectFailTimer);
    connectFailTimer = null;
    setStatus("live");
  });
  conn.on("data", (raw) => {
    const m = raw as Msg;
    switch (m.t) {
      case "snapshot":
        m.orders.forEach((o) => saveOrder(o, true));
        break;
      case "upsert":
        saveOrder(m.order, true);
        break;
      case "delete":
        deleteOrder(m.id, true);
        break;
      case "clear":
        clearOrders(true);
        break;
      default:
        break;
    }
  });
  conn.on("close", () => {
    if (adminCode) {
      setStatus("connecting");
      scheduleRetry();
    }
  });
  conn.on("error", () => {
    /* handled by close/timeout */
  });
}

function scheduleRetry() {
  if (retryTimer || !adminCode) return;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    if (adminCode) tryConnect();
  }, 3000);
}

export async function connectAdmin(code: string) {
  adminCode = code.trim();
  saveAdminCode(adminCode);
  if (!adminCode) return;

  if (!adminPeer) {
    const { default: PeerCtor } = await import("peerjs");
    setStatus("connecting");
    adminPeer = new PeerCtor({ debug: 0 });
    await new Promise<void>((resolve) => {
      const p = adminPeer as Peer;
      const done = () => resolve();
      p.on("open", done);
      p.on("error", done);
      window.setTimeout(done, 9000);
    });
  }
  tryConnect();
}

export function disconnectAdmin() {
  adminCode = "";
  saveAdminCode("");
  clearTimers();
  if (adminConn) {
    try {
      adminConn.close();
    } catch {
      /* noop */
    }
    adminConn = null;
  }
  setStatus("off");
}

export function getConnectedCode(): string {
  return adminCode;
}

/* boot: reconnect automatically with the saved code */
export async function bootAdminSync() {
  const saved = getSavedAdminCode();
  if (saved) {
    setBroadcastHook((m) => {
      if (adminConn) send(adminConn, m);
    });
    await connectAdmin(saved);
  }
}

export function enableAdminBroadcast() {
  setBroadcastHook((m) => {
    if (adminConn) send(adminConn, m);
  });
}
