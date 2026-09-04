/**
 * REALTIME CROSS-DEVICE SYNC — MQTT cloud relay
 * ------------------------------------------------
 * Kiosk (customer phone) aur Admin (laptop / doosra phone) — koi bhi device,
 * koi bhi network — sab orders, payments aur files live ek shared channel par
 * sync hote hain. WebSocket relay har network/firewall se guzarta hai
 * (WebRTC/P2P ki tarah NAT par fail nahi hota). Koi code entry nahi —
 * /#/admin kholo aur orders khud aane lagte hain.
 *
 * Files: original PDF/photo kiosk device ke IndexedDB mein hoti hai. Admin
 * print kare toh file MQTT relay se chunk-wise mangwa li jaati hai (on-demand).
 */
import { useEffect, useState } from "react";
import type { OrderRecord } from "./store";
import {
  clearOrders,
  deleteOrder,
  getOrders,
  mergeOrder,
  saveOrder,
  setBroadcastHook,
} from "./store";
import { getFile, putFile } from "./filestore";

export type SyncRole = "kiosk" | "admin";
export type SyncStatus = "connecting" | "live" | "offline";

/* public cloud MQTT relays (free, no account). Fallback chain. */
const BROKERS = [
  "wss://broker.emqx.io:8084/mqtt",
  "wss://broker.hivemq.com:8884/mqtt",
];
/* shop ka private channel */
const TOPIC = "jdx7f3a/jaydwarkadhishshop36698672/v1";
const CLIENT_KEY = "qpx_client_id";

/* ---------- message protocol ---------- */
type Msg =
  | { t: "up"; order: OrderRecord }
  | { t: "del"; id: string }
  | { t: "clr" }
  | { t: "hi"; role: SyncRole }
  | { t: "req" }
  | { t: "f-req"; fid: string; name: string; mime: string }
  | { t: "f-meta"; fid: string; n: number; mime: string }
  | { t: "f-ch"; fid: string; i: number; d: string };

interface Envelope {
  v: 1;
  from: string;
  m: Msg;
}

/* ---------- module state ---------- */
interface MqttLike {
  connected: boolean;
  publish: (topic: string, payload: string) => void;
  subscribe: (topic: string) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
  end: (force?: boolean) => void;
}

let client: MqttLike | null = null;
let role: SyncRole = "kiosk";
let started = false;
let status: SyncStatus = "connecting";
let brokerUrl = "";
const peers = new Map<string, { role: SyncRole; seen: number }>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function setStatus(s: SyncStatus) {
  if (status !== s) {
    status = s;
    emit();
  }
}

/* ---------- client id (per browser, persisted) ---------- */
function makeClientId(): string {
  const rnd = "jd" + Math.random().toString(36).slice(2, 10);
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = rnd;
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return rnd;
  }
}
const SELF = typeof window !== "undefined" ? makeClientId() : "server";

/* ---------- base64 helpers (binary safe) ---------- */
function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ---------- send ---------- */
function send(m: Msg) {
  if (!client || !client.connected) return;
  try {
    const env: Envelope = { v: 1, from: SELF, m };
    client.publish(TOPIC, JSON.stringify(env));
  } catch {
    /* payload too big etc. — ignore */
  }
}

/* ---------- file transfer (on-demand, chunked) ---------- */
interface PendingFile {
  n: number;
  got: Map<number, string>;
  mime: string;
  resolve: (b: Blob | null) => void;
  timer: number;
}
const pendingFiles = new Map<string, PendingFile>();

/** Kiosk se original file mangwao (admin device par print ke liye). */
export function requestFile(fid: string, name: string, mime: string, timeoutMs = 30000): Promise<Blob | null> {
  return new Promise((resolve) => {
    const p: PendingFile = {
      n: -1,
      got: new Map(),
      mime,
      resolve,
      timer: window.setTimeout(() => {
        pendingFiles.delete(fid);
        resolve(null);
      }, timeoutMs),
    };
    pendingFiles.set(fid, p);
    send({ t: "f-req", fid, name, mime });
    /* ek aur request 3s baad (agar pehli connect se pehle thi) */
    window.setTimeout(() => {
      if (pendingFiles.has(fid)) send({ t: "f-req", fid, name, mime });
    }, 3000);
  });
}

async function serveFile(fid: string, mime: string) {
  try {
    const blob = await getFile(fid);
    if (!blob) return;
    const buf = new Uint8Array(await blob.arrayBuffer());
    const CHUNK = 40000;
    const n = Math.max(1, Math.ceil(buf.length / CHUNK));
    send({ t: "f-meta", fid, n, mime: mime || blob.type || "application/octet-stream" });
    for (let i = 0; i < n; i++) {
      const slice = buf.subarray(i * CHUNK, (i + 1) * CHUNK);
      send({ t: "f-ch", fid, i, d: bytesToBase64(slice) });
      await sleep(35);
    }
  } catch {
    /* file read fail — ignore */
  }
}

function handleFileChunk(m: Extract<Msg, { t: "f-meta" } | { t: "f-ch" }>) {
  const fid = m.fid;
  const p = pendingFiles.get(fid);
  if (!p) return;
  if (m.t === "f-meta") {
    p.n = m.n;
    p.mime = m.mime;
  } else {
    p.got.set(m.i, m.d);
  }
  if (p.n > 0 && p.got.size >= p.n) {
    const parts: BlobPart[] = [];
    for (let i = 0; i < p.n; i++) {
      const d = p.got.get(i);
      if (!d) return; /* missing chunk — wait */
      parts.push(base64ToBytes(d) as BlobPart);
    }
    const blob = new Blob(parts, { type: p.mime });
    void putFile(fid, blob).catch(() => {});
    window.clearTimeout(p.timer);
    pendingFiles.delete(fid);
    p.resolve(blob);
  }
}

/* ---------- snapshot (naya device juda → purane orders le lo) ---------- */
async function sendSnapshot() {
  const orders = getOrders().slice(0, 40);
  for (const o of orders) {
    send({ t: "up", order: o });
    await sleep(30);
  }
}

/* ---------- receive ---------- */
function payloadToText(payload: unknown): string {
  if (typeof payload === "string") return payload;
  if (payload instanceof Uint8Array) return new TextDecoder().decode(payload);
  if (payload instanceof ArrayBuffer) return new TextDecoder().decode(payload);
  return String(payload);
}

function handle(payload: unknown) {
  try {
    const env = JSON.parse(payloadToText(payload)) as Envelope;
    if (!env || env.v !== 1 || env.from === SELF) return;
    const m = env.m;
    switch (m.t) {
      case "up":
        mergeOrder(m.order);
        break;
      case "del":
        deleteOrder(m.id, true);
        break;
      case "clr":
        clearOrders(true);
        break;
      case "hi":
        peers.set(env.from, { role: m.role, seen: Date.now() });
        emit();
        break;
      case "req":
        send({ t: "hi", role });
        void sendSnapshot();
        break;
      case "f-req":
        void serveFile(m.fid, m.mime);
        break;
      case "f-meta":
      case "f-ch":
        handleFileChunk(m);
        break;
    }
  } catch {
    /* bad packet — ignore */
  }
}

/* ---------- connect with broker fallback + auto retry ---------- */
async function connect() {
  let mqttMod: { default?: unknown; connect?: unknown } | null = null;
  try {
    mqttMod = (await import("mqtt")) as { default?: unknown; connect?: unknown };
  } catch {
    setStatus("offline");
    return;
  }
  const mqttLib = (mqttMod?.default ?? mqttMod) as {
    connect: (url: string, opts: Record<string, unknown>) => MqttLike;
  };

  if (typeof mqttLib?.connect !== "function") {
    setStatus("offline");
    return;
  }

  let attempt = 0;
  const loop = () => {
    try {
      const url = BROKERS[attempt % BROKERS.length];
      brokerUrl = url;
      setStatus("connecting");
      let settled = false;
      let c: MqttLike;
      try {
        c = mqttLib.connect(url, {
          clientId: SELF + Math.floor(Math.random() * 1e6).toString(36),
          clean: true,
          connectTimeout: 8000,
          reconnectPeriod: 0,
          keepalive: 30,
        });
      } catch {
        throw new Error("mqtt connect throw");
      }
      client = c;

      const fail = () => {
        if (settled) return;
        settled = true;
        try {
          c.end(true);
        } catch {
          /* noop */
        }
        attempt++;
        setStatus("offline");
        window.setTimeout(loop, 2500);
      };
      const guard = window.setTimeout(fail, 9000);

      c.on("connect", () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(guard);
        attempt = 0;
        client = c;
        setStatus("live");
        try {
          c.subscribe(TOPIC);
        } catch {
          /* noop */
        }
        send({ t: "hi", role });
        send({ t: "req" });
      });
      c.on("error", () => fail());
      c.on("close", () => {
        if (!settled) {
          fail();
        } else {
          setStatus("offline");
          window.setTimeout(loop, 3000);
        }
      });
      c.on("message", (_topic: unknown, payload: unknown) => {
        try {
          handle(payload);
        } catch {
          /* bad packet — ignore */
        }
      });
    } catch {
      attempt++;
      setStatus("offline");
      window.setTimeout(loop, 2500);
    }
  };
  loop();
}

/* ---------- heartbeat + presence ---------- */
if (typeof window !== "undefined") {
  window.setInterval(() => {
    if (client?.connected) send({ t: "hi", role });
  }, 15000);
  window.setInterval(() => {
    const now = Date.now();
    let changed = false;
    peers.forEach((p, k) => {
      if (now - p.seen > 45000) {
        peers.delete(k);
        changed = true;
      }
    });
    if (changed) emit();
  }, 10000);
}

/* ---------- public API ---------- */
export function startLiveSync(r: SyncRole) {
  if (typeof window === "undefined") return;
  if (started) {
    role = r;
    return;
  }
  started = true;
  role = r;

  try {
    /* local store changes → relay par broadcast (kiosk + admin dono) */
    setBroadcastHook((bm) => {
      try {
        if (bm.t === "upsert") send({ t: "up", order: bm.order });
        else if (bm.t === "delete") send({ t: "del", id: bm.id });
        else send({ t: "clr" });
      } catch {
        /* broadcast fail — silent */
      }
    });
  } catch {
    /* noop */
  }

  /* thoda defer karo — pehla paint kabhi block na ho */
  window.setTimeout(() => {
    try {
      void connect();
    } catch {
      setStatus("offline");
    }
  }, 900);
}

export function getSyncStatus(): SyncStatus {
  return status;
}
export function getPeerCount(): number {
  return peers.size;
}
export function getBrokerUrl(): string {
  return brokerUrl;
}

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(status);
  useEffect(() => {
    const l = () => setS(status);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return s;
}

export function usePeerCount(): number {
  const [n, setN] = useState<number>(peers.size);
  useEffect(() => {
    const l = () => setN(peers.size);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return n;
}
