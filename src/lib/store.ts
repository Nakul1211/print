import { useEffect, useState } from "react";
import type { PrintFile, PrintOptions } from "./pricing";
import { SHOP } from "./pricing";

/* =========================================================
   Live order store + kiosk settings
   - localStorage persistence (in-memory fallback if blocked)
   - same-tab + cross-tab realtime sync (storage events)
   ========================================================= */

export type OrderStatus = "files" | "paid" | "printing" | "done";

export interface OrderFileMeta {
  name: string;
  kind: "pdf" | "photo";
  pages: number;
  sizeLabel: string;
  thumb?: string;
}

export interface OrderEvent {
  at: number;
  label: string;
}

export interface OrderPayment {
  orderId: string;
  amount: number;
  method: string;
  upiRef: string;
  paidAt: number;
}

export interface OrderRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  status: OrderStatus;
  files: OrderFileMeta[];
  totalPages: number;
  options?: PrintOptions;
  total?: number;
  payment?: OrderPayment;
  events: OrderEvent[];
}

export interface KioskSettings {
  upiId: string;
  payeeName: string;
  note: string;
  /** merchant's own QR photo (dataURL) — replaces generated QR on kiosk */
  qrImage: string | null;
  /** optional admin PIN gate */
  pin: string;
}

const ORDERS_KEY = "qpx_orders_v1";
const SETTINGS_KEY = "qpx_settings_v1";

export const DEFAULT_SETTINGS: KioskSettings = {
  upiId: SHOP.vpa,
  payeeName: SHOP.name,
  note: "Payment ke baad 'Maine Pay Kar Diya' zaroor dabayein",
  qrImage: null,
  pin: "",
};

/* ---------- sandbox-safe storage ---------- */
const mem: Record<string, string> = {};

function lsGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return mem[key] ?? null;
  }
}

function lsSet(key: string, value: string) {
  mem[key] = value;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* in-memory only */
  }
}

/* ---------- listeners ---------- */
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (!e.key || e.key === ORDERS_KEY || e.key === SETTINGS_KEY) notify();
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/* ---------- orders ---------- */
export function getOrders(): OrderRecord[] {
  try {
    const raw = lsGet(ORDERS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as OrderRecord[]) : [];
  } catch {
    return [];
  }
}

function persistOrders(list: OrderRecord[]) {
  lsSet(ORDERS_KEY, JSON.stringify(list.slice(0, 120)));
  notify();
}

export function getOrder(id: string): OrderRecord | undefined {
  return getOrders().find((o) => o.id === id);
}

export function saveOrder(rec: OrderRecord) {
  const list = getOrders();
  const i = list.findIndex((o) => o.id === rec.id);
  if (i >= 0) list[i] = rec;
  else list.unshift(rec);
  persistOrders(list);
}

export function patchOrder(id: string, patch: Partial<OrderRecord>, event?: string) {
  const list = getOrders();
  const i = list.findIndex((o) => o.id === id);
  if (i < 0) return;
  const cur = list[i];
  list[i] = {
    ...cur,
    ...patch,
    updatedAt: Date.now(),
    events: event ? [...cur.events, { at: Date.now(), label: event }] : cur.events,
  };
  persistOrders(list);
}

export function deleteOrder(id: string) {
  persistOrders(getOrders().filter((o) => o.id !== id));
}

export function clearOrders() {
  persistOrders([]);
}

export function toMeta(files: PrintFile[]): OrderFileMeta[] {
  return files.map((f) => ({
    name: f.name,
    kind: f.kind,
    pages: f.pages,
    sizeLabel: f.sizeLabel,
    thumb: f.thumb,
  }));
}

/* ---------- settings ---------- */
export function getSettings(): KioskSettings {
  try {
    const raw = lsGet(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<KioskSettings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch: Partial<KioskSettings>) {
  lsSet(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...patch }));
  notify();
}

/* ---------- react hooks (live) ---------- */
export function useOrders(): OrderRecord[] {
  const [orders, setOrders] = useState<OrderRecord[]>(getOrders);
  useEffect(() => subscribe(() => setOrders(getOrders())), []);
  return orders;
}

export function useSettings(): KioskSettings {
  const [s, setS] = useState<KioskSettings>(getSettings);
  useEffect(() => subscribe(() => setS(getSettings())), []);
  return s;
}

/* ---------- helpers ---------- */
export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 8) return "abhi abhi";
  if (s < 60) return `${s}s pehle`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min pehle`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h pehle`;
  return new Date(ts).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
