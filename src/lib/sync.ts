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
  | { t: "f-req"; fid: string; name: string; mime: string; need?: number[] }
  | { t: "f-meta"; fid: string; n: number; mime: string; total: number }
  | { t: "f-ch"; fid: string; i: number; d: string }
  | { t: "f-end"; fid: string; n: number };

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

/* ---------- file transfer (on-demand, chunked, ARQ = missing re-request) ----------
 * Public MQTT brokers bade/tez messages drop kar dete hain, isliye:
 *  - chhote chunks (16KB) rakhe hain
 *  - admin missing chunks ko khud dobara maangta hai (har 1.8s)
 *  - kiosk ek baar padhi file cache rakhta hai taaki re-request turant mile
 */
const FILE_CHUNK = 16000; /* raw bytes per chunk (~21KB base64 — broker safe) */
const serveCache = new Map<string, { buf: Uint8Array; mime: string; n: number }>();

interface PendingFile {
  n: number;
  total: number;
  got: Map<number, string>;
  mime: string;
  name: string;
  resolve: (b: Blob | null) => void;
  onProgress?: (got: number, total: number) => void;
  deadline: number;
  retryTimer: number;
}
const pendingFiles = new Map<string, PendingFile>();

/** Kiosk se original file mangwao (admin device par print ke liye). */
export function requestFile(
  fid: string,
  name: string,
  mime: string,
  opts?: { timeoutMs?: number; onProgress?: (got: number, total: number) => void }
): Promise<Blob | null> {
  const timeoutMs = opts?.timeoutMs ?? 60000;
  return new Promise((resolve) => {
    /* agar pehle se pending hai toh wahi reuse karo */
    if (pendingFiles.has(fid)) {
      const existing = pendingFiles.get(fid)!;
      const oldResolve = existing.resolve;
      existing.resolve = (b) => {
        oldResolve(b);
        resolve(b);
      };
      return;
    }

    const finish = (b: Blob | null) => {
      const p = pendingFiles.get(fid);
      if (p) {
        window.clearTimeout(p.retryTimer);
        pendingFiles.delete(fid);
      }
      resolve(b);
    };

    const p: PendingFile = {
      n: -1,
      total: -1,
      got: new Map(),
      mime,
      name,
      resolve: finish,
      onProgress: opts?.onProgress,
      deadline: Date.now() + timeoutMs,
      retryTimer: 0,
    };
    pendingFiles.set(fid, p);

    /* pehla request + regular ARQ re-request loop */
    send({ t: "f-req", fid, name, mime });
    p.retryTimer = window.setInterval(() => {
      const cur = pendingFiles.get(fid);
      if (!cur) return;
      if (Date.now() > cur.deadline) {
        finish(null);
        return;
      }
      if (cur.n > 0) {
        /* missing chunks dobara maango */
        const missing: number[] = [];
        for (let i = 0; i < cur.n; i++) if (!cur.got.has(i)) missing.push(i);
        if (missing.length > 0) send({ t: "f-req", fid, name, mime, need: missing.slice(0, 24) });
      } else {
        /* meta hi nahi mili — poora request dobara */
        send({ t: "f-req", fid, name, mime });
      }
    }, 1800);
  });
}

async function serveFile(fid: string, mime: string, need?: number[]) {
  try {
    let cached = serveCache.get(fid);
    if (!cached) {
      const blob = await getFile(fid);
      if (!blob) return;
      const buf = new Uint8Array(await blob.arrayBuffer());
      cached = { buf, mime: mime || blob.type || "application/octet-stream", n: Math.max(1, Math.ceil(buf.length / FILE_CHUNK)) };
      serveCache.set(fid, cached);
      /* memory limit — sirf recent 4 files cache mein */
      if (serveCache.size > 4) {
        const firstKey = serveCache.keys().next().value;
        if (firstKey) serveCache.delete(firstKey);
      }
    }
    const { buf, n } = cached;
    const indices = need && need.length > 0 ? need.filter((i) => i >= 0 && i < n) : Array.from({ length: n }, (_, i) => i);
    if (indices.length === n) {
      send({ t: "f-meta", fid, n, mime: cached.mime, total: buf.length });
    }
    for (const i of indices) {
      const slice = buf.subarray(i * FILE_CHUNK, (i + 1) * FILE_CHUNK);
      send({ t: "f-ch", fid, i, d: bytesToBase64(slice) });
      await sleep(20);
    }
    if (indices.length === n) {
      send({ t: "f-end", fid, n });
    }
  } catch {
    /* file read fail — ignore */
  }
}

/**
 * Payment confirm hote hi kiosk apni saari files channel par push kar deta hai —
 * online admin devices unhe turant store kar lete hain. Isse customer phone band
 * kar de tab bhi files admin ke paas reh jaati hain.
 */
export async function pushOrderFiles(files: { id: string; kind: "pdf" | "photo" }[]) {
  for (const f of files) {
    const mime = f.kind === "pdf" ? "application/pdf" : "image/jpeg";
    void serveFile(f.id, mime);
    await sleep(400);
  }
}

function tryAssemble(fid: string) {
  const p = pendingFiles.get(fid);
  if (!p || p.n <= 0 || p.got.size < p.n) return;
  const parts: BlobPart[] = [];
  for (let i = 0; i < p.n; i++) {
    const d = p.got.get(i);
    if (!d) return; /* abhi missing — ARQ dobara maangega */
    parts.push(base64ToBytes(d) as BlobPart);
  }
  const blob = new Blob(parts, { type: p.mime });
  void putFile(fid, blob).catch(() => {});
  p.resolve(blob);
}

function handleFileChunk(m: Extract<Msg, { t: "f-meta" } | { t: "f-ch" } | { t: "f-end" }>) {
  let p = pendingFiles.get(m.fid);
  if (!p) {
    /* koi request nahi thi — yeh kiosk ka proactive push hai; auto-accept karke store karo */
    p = {
      n: -1,
      total: -1,
      got: new Map(),
      mime: "application/octet-stream",
      name: "",
      resolve: () => {},
      deadline: Date.now() + 60000,
      retryTimer: 0,
    };
    pendingFiles.set(m.fid, p);
    /* adhoora push 70s baad saaf kar do */
    window.setTimeout(() => {
      const cur = pendingFiles.get(m.fid);
      if (cur && cur.retryTimer === 0 && (cur.n <= 0 || cur.got.size < cur.n)) pendingFiles.delete(m.fid);
    }, 70000);
  }
  if (m.t === "f-meta") {
    p.n = m.n;
    p.total = m.total;
    p.mime = m.mime;
  } else if (m.t === "f-ch") {
    p.got.set(m.i, m.d);
    const totalChunks = p.n > 0 ? p.n : Math.max(p.got.size, 1);
    p.onProgress?.(p.got.size, totalChunks);
  } else {
    /* f-end — agar meta gir gaya ho toh n yahin se le lo */
    if (p.n <= 0) p.n = m.n;
  }
  tryAssemble(m.fid);
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
        void serveFile(m.fid, m.mime, m.need);
        break;
      case "f-meta":
      case "f-ch":
      case "f-end":
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
