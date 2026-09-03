import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { OrderRecord } from "../lib/store";
import {
  clearOrders,
  deleteOrder,
  patchOrder,
  saveSettings,
  timeAgo,
  useOrders,
  useSettings,
} from "../lib/store";
import { getPeerCount, startLiveSync, useSyncStatus } from "../lib/sync";
import { inr, validateUpiVpa } from "../lib/pricing";
import {
  IconDoc,
  IconPhoto,
  IconPrinter,
  IconQr,
  IconRupee,
  IconShield,
  IconTrash,
} from "../components/icons";
import PrintStation from "../components/PrintStation";

/* ---------- status visuals ---------- */
const STATUS_META: Record<OrderRecord["status"], { label: string; cls: string; rail: string }> = {
  files: { label: "FILES MILI", cls: "bg-cyan text-ink", rail: "bg-cyan" },
  paid: { label: "PAID", cls: "bg-leaf text-paper", rail: "bg-leaf" },
  printing: { label: "PRINTING", cls: "bg-yellow text-ink", rail: "stripes-live" },
  done: { label: "DONE", cls: "bg-ink text-paper", rail: "bg-ink" },
};

const inputCls =
  "w-full border-2 border-ink bg-paper px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-magenta";

/* ---------- helpers ---------- */
function beep() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "square";
    o.frequency.value = 880;
    g.gain.setValueAtTime(0.05, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.26);
  } catch {
    /* audio not available */
  }
}

async function compressImage(file: File, maxSide: number): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("image load failed"));
      img.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const Chip = ({ children }: { children: ReactNode }) => (
  <span className="border border-ink bg-paper px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider">
    {children}
  </span>
);

const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <label className="block">
    <span className="mb-1 block font-mono text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase">{label}</span>
    {children}
  </label>
);

/* ---------- PIN gate (optional) ---------- */
function PinGate({ pin, onOk }: { pin: string; onOk: () => void }) {
  const [val, setVal] = useState("");
  const [err, setErr] = useState(false);
  const submit = () => {
    if (val === pin) onOk();
    else {
      setErr(true);
      setVal("");
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-6">
      <div className="pop-in w-full max-w-xs border-2 border-paper/30 bg-panel p-7 shadow-[8px_8px_0_0_rgba(241,241,234,0.2)]">
        <p className="flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.3em] text-magenta uppercase">
          <IconShield size={14} /> Restricted
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-wide uppercase">Admin PIN</h1>
        <input
          type="password"
          inputMode="numeric"
          autoFocus
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            setErr(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="••••"
          className={`${inputCls} mt-4 text-center text-2xl tracking-[0.5em] ${err ? "border-magenta" : ""}`}
        />
        {err && <p className="mt-2 font-mono text-[11px] font-bold text-magenta">Galat PIN — dobara try karo</p>}
        <button
          onClick={submit}
          className="btn-press mt-4 w-full border-2 border-ink bg-ink px-4 py-2.5 font-display text-lg tracking-wide text-paper uppercase shadow-press-sm"
        >
          Unlock
        </button>
        <Link to="/" className="mt-3 block text-center font-mono text-[10px] tracking-[0.2em] text-ink-soft uppercase hover:text-ink">
          ← Kiosk par wapas
        </Link>
      </div>
    </div>
  );
}

/* ---------- single order card ---------- */
function OrderCard({ o, onPrint }: { o: OrderRecord; onPrint: (o: OrderRecord) => void }) {
  const meta = STATUS_META[o.status];
  const [confirmDel, setConfirmDel] = useState(false);

  return (
    <article className="pop-in relative overflow-hidden border-2 border-ink bg-panel shadow-press-sm">
      <span className={`absolute inset-y-0 left-0 w-2 ${meta.rail}`} />
      <div className="p-4 pl-6">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-xl tracking-wide">{o.id}</h3>
          <span className={`border-2 border-ink px-2 py-0.5 font-mono text-[10px] font-bold tracking-widest ${meta.cls}`}>
            {meta.label}
          </span>
          <span className="ml-auto font-mono text-[10px] tracking-wider text-ink-soft uppercase">
            {timeAgo(o.updatedAt)}
          </span>
        </div>

        {/* files */}
        <ul className="mt-3 space-y-1.5">
          {o.files.map((f, i) => (
            <li key={i} className="flex items-center gap-2.5 border border-dashed border-ink/30 bg-paper/60 px-2.5 py-1.5">
              {f.thumb ? (
                <img src={f.thumb} alt="" className="h-9 w-9 shrink-0 border border-ink object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-ink bg-ink text-paper">
                  {f.kind === "pdf" ? <IconDoc size={16} /> : <IconPhoto size={16} />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-bold">{f.name}</span>
                <span className="font-mono text-[10px] text-ink-soft">
                  {f.kind === "pdf" ? `PDF · ${f.pages} page${f.pages > 1 ? "s" : ""}` : "PHOTO · 1 page"} · {f.sizeLabel}
                </span>
              </span>
              <span className="font-mono text-xs font-bold">{f.pages}pg</span>
            </li>
          ))}
          {o.files.length === 0 && (
            <li className="font-mono text-[11px] text-ink-soft">Files hatayi gayi hain</li>
          )}
        </ul>

        {/* options + amount */}
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {o.options ? (
            <>
              <Chip>{o.options.color === "bw" ? "B&W" : "COLOUR"}</Chip>
              <Chip>{o.options.size}</Chip>
              <Chip>{o.options.duplex ? "BOTH SIDES" : "ONE SIDE"}</Chip>
              <Chip>×{o.options.copies}</Chip>
            </>
          ) : (
            <span className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">Options pending…</span>
          )}
          {o.payment && (
            <span className="ml-auto flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold tracking-widest text-leaf uppercase">
                {o.payment.method}
              </span>
              <span className="font-display text-2xl">{inr(o.payment.amount)}</span>
            </span>
          )}
        </div>
        {o.payment && (
          <p className="mt-1 font-mono text-[10px] tracking-wider text-ink-soft">
            UPI Ref: {o.payment.upiRef} · Pay Order: {o.payment.orderId}
          </p>
        )}

        {/* timeline */}
        <div className="tear-line mt-3 pt-2.5">
          <ol className="space-y-1">
            {[...o.events].reverse().slice(0, 4).map((e, i) => (
              <li key={i} className="flex items-baseline gap-2 font-mono text-[10px]">
                <span className="shrink-0 text-ink/45 tabular-nums">
                  {new Date(e.at).toLocaleTimeString("en-IN", { hour12: false })}
                </span>
                <span className={i === 0 ? "font-bold text-ink" : "text-ink-soft"}>{e.label}</span>
              </li>
            ))}
          </ol>
        </div>

        {/* actions */}
        <div className="mt-3 flex gap-2">
          {o.status === "files" ? (
            <span className="flex flex-1 cursor-not-allowed items-center justify-center gap-2 border-2 border-dashed border-ink/40 bg-paper px-3 py-2 font-mono text-[11px] font-bold tracking-widest text-ink-soft uppercase">
              ₹ Payment ka intezaar…
            </span>
          ) : (
            <>
              <button
                onClick={() => onPrint(o)}
                className="btn-press group flex flex-1 items-center justify-center gap-2 border-2 border-ink bg-yellow px-3 py-2 font-display text-lg tracking-wide uppercase shadow-press-sm"
              >
                <IconPrinter size={18} className="transition-transform group-hover:-translate-y-0.5" />
                {o.status === "done" ? "Print / Reprint" : "Print Karo"}
              </button>
              {(o.status === "paid" || o.status === "printing") && (
                <button
                  onClick={() => patchOrder(o.id, { status: "done" }, "Marked done by admin")}
                  className="btn-press border-2 border-ink bg-leaf px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest text-paper uppercase shadow-press-sm"
                >
                  ✓ Done
                </button>
              )}
            </>
          )}
          <button
            onClick={() => (confirmDel ? deleteOrder(o.id) : setConfirmDel(true))}
            onBlur={() => setConfirmDel(false)}
            className={`btn-press border-2 border-ink px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest uppercase shadow-press-sm ${
              confirmDel ? "bg-magenta text-paper" : "bg-paper text-ink hover:bg-magenta/20"
            }`}
          >
            {confirmDel ? "Pakka?" : <IconTrash size={14} />}
          </button>
        </div>
      </div>
    </article>
  );
}

/* ---------- UPI / QR settings ---------- */
function SettingsPanel() {
  const settings = useSettings();
  const [upiId, setUpiId] = useState(settings.upiId);
  const [payee, setPayee] = useState(settings.payeeName);
  const [note, setNote] = useState(settings.note);
  const [pin, setPin] = useState(settings.pin);
  const [qr, setQr] = useState<string | null>(settings.qrImage);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUpiId(settings.upiId);
    setPayee(settings.payeeName);
    setNote(settings.note);
    setPin(settings.pin);
    setQr(settings.qrImage);
  }, [settings]);

  const onQrFile = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    try {
      setQr(await compressImage(file, 640));
    } catch {
      /* ignore bad image */
    }
    setBusy(false);
  };

  const save = () => {
    saveSettings({
      upiId: upiId.trim(),
      payeeName: payee.trim(),
      note: note.trim(),
      pin: pin.trim(),
      qrImage: qr,
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2400);
  };

  return (
    <div className="border-2 border-ink bg-panel shadow-press">
      <div className="flex items-center justify-between border-b-2 border-ink bg-cyan px-4 py-2">
        <span className="font-mono text-[11px] font-bold tracking-[0.3em] uppercase">Meri UPI Settings</span>
        <IconRupee size={16} />
      </div>
      <div className="space-y-3 p-4">
        <Field label="UPI ID (VPA)">
          <input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="9723121192@hdfcbank" className={inputCls} />
          {(() => {
            const err = validateUpiVpa(upiId);
            return err ? (
              <span className="mt-1 block border border-magenta/50 bg-magenta/10 px-2 py-1 font-mono text-[10px] font-bold tracking-wide text-magenta">
                ⚠ {err}
              </span>
            ) : (
              <span className="mt-1 block font-mono text-[10px] font-bold tracking-wide text-leaf">
                ✓ Valid UPI ID — payment is par aayegi
              </span>
            );
          })()}
        </Field>
        <Field label="Payee Name">
          <input value={payee} onChange={(e) => setPayee(e.target.value)} placeholder="Aapki dukaan ka naam" className={inputCls} />
        </Field>
        <Field label="Customer Note (payment screen par dikhega)">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Koi zaroori baat…" className={inputCls} />
        </Field>
        <Field label="Admin PIN (optional — khali = no lock)">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            placeholder="1234"
            className={inputCls}
          />
        </Field>

        <div>
          <p className="mb-1 font-mono text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase">
            Apni QR Code Photo
          </p>
          {qr ? (
            <div className="relative inline-block">
              <img src={qr} alt="Aapki UPI QR" className="w-36 border-2 border-ink" />
              <button
                onClick={() => setQr(null)}
                className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center border-2 border-ink bg-magenta font-bold text-paper"
                title="QR photo hatao"
              >
                ×
              </button>
            </div>
          ) : (
            <label className="btn-press flex cursor-pointer items-center justify-center gap-2 border-2 border-dashed border-ink/50 bg-paper px-3 py-4 font-mono text-[11px] font-bold tracking-widest uppercase hover:bg-yellow/20">
              <IconQr size={16} /> {busy ? "Load ho rahi hai…" : "QR Photo Upload karo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onQrFile(e.target.files?.[0])} />
            </label>
          )}
          <p className="mt-1 font-mono text-[10px] leading-snug text-ink-soft">
            Photo save karte hi kiosk ki payment screen par generated QR ki jagah <b>aapki QR</b> dikhegi.
          </p>
        </div>

        <button
          onClick={save}
          className={`btn-press w-full border-2 border-ink px-4 py-2.5 font-display text-lg tracking-wide uppercase shadow-press-sm ${
            saved ? "bg-leaf text-paper" : "bg-ink text-paper"
          }`}
        >
          {saved ? "✓ Saved — Kiosk par live hai" : "Save Settings"}
        </button>
      </div>
    </div>
  );
}

/* ---------- live cloud sync panel (auto — no code) ---------- */
function SyncPanel() {
  const syncStatus = useSyncStatus();
  const [peers, setPeers] = useState(getPeerCount());
  useEffect(() => {
    const t = setInterval(() => setPeers(getPeerCount()), 4000);
    return () => clearInterval(t);
  }, []);
  const linked = syncStatus === "live";

  return (
    <div className="border-2 border-ink bg-panel shadow-press">
      <div className="flex items-center justify-between border-b-2 border-ink bg-magenta px-4 py-2">
        <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-paper uppercase">Live Cloud Sync</span>
        <span
          className={`flex items-center gap-1.5 border border-paper/60 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest text-paper ${
            linked ? "" : "opacity-80"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              linked ? "led bg-paper" : syncStatus === "connecting" ? "bg-yellow" : "bg-paper/40"
            }`}
          />
          {linked ? "CONNECTED" : syncStatus === "connecting" ? "LINKING…" : "OFFLINE"}
        </span>
      </div>
      <div className="p-4">
        {linked ? (
          <div className="pop-in">
            <div className="flex items-center gap-2 border-2 border-dashed border-leaf/60 bg-leaf/10 px-3 py-2.5">
              <span className="led h-2.5 w-2.5 rounded-full bg-leaf" />
              <p className="font-mono text-[10px] font-bold tracking-[0.18em] text-ink-soft uppercase">
                {peers > 0 ? `${peers + 1} devices linked · realtime` : "Realtime channel khula hai"}
              </p>
            </div>
            <p className="mt-3 text-xs leading-relaxed font-medium text-ink-soft">
              Customer <b className="text-ink">kisi bhi phone</b> par file daale ya payment kare — order{" "}
              <b className="text-ink">yahin live</b> aayega. Aap <b className="text-ink">kisi bhi device</b> par yeh admin
              kholo — sab kuch sync milega. Koi code nahi.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs leading-relaxed font-medium text-ink-soft">
              {syncStatus === "connecting"
                ? "Cloud relay se juda ja raha hai… (internet chahiye)"
                : "Internet nahi mil raha — dobara koshish jaari hai. Local orders fir bhi dikhenge."}
            </p>
            <div className="mt-3 h-2 border-2 border-ink bg-paper">
              <div className="stripes-live h-full w-full opacity-60" />
            </div>
          </>
        )}
        <div className="tear-line mt-3 pt-2.5">
          <ol className="space-y-1">
            {[
              "Customer phone par kiosk kholta hai",
              "Upload/pay karte hi yahan order live aata hai 🔔",
              "PRINT dabao — file khud kiosk se aa jaati hai",
            ].map((s, i) => (
              <li key={i} className="flex items-baseline gap-2 font-mono text-[10px] tracking-wider text-ink-soft">
                <span className="font-display text-sm text-magenta">{i + 1}</span> {s}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ---------- main admin screen ---------- */
export default function AdminScreen() {
  const orders = useOrders();
  const settings = useSettings();
  const syncStatus = useSyncStatus();
  const [peerCount, setPeerCount] = useState(getPeerCount());
  useEffect(() => {
    const t = setInterval(() => setPeerCount(getPeerCount()), 4000);
    return () => clearInterval(t);
  }, []);
  const [unlocked, setUnlocked] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [printOrder, setPrintOrder] = useState<OrderRecord | null>(null);
  const [toasts, setToasts] = useState<{ id: number; title: string; sub: string; tone: string }[]>([]);

  /* refresh relative times */
  const [, forceTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forceTick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  /* cloud sync shuru karo — orders har device par live */
  useEffect(() => {
    startLiveSync("admin");
  }, []);

  const pushToast = (title: string, sub: string, tone: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, title, sub, tone }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  };

  /* live watch: new order / payment confirm → toast + beep */
  const prev = useRef<Map<string, OrderRecord["status"]> | null>(null);
  useEffect(() => {
    if (prev.current) {
      for (const o of orders) {
        const before = prev.current.get(o.id);
        if (before === undefined) {
          pushToast("📄 Naya order aaya", `${o.id} · ${o.files.length} file(s), ${o.totalPages} pages`, "bg-cyan text-ink");
          beep();
        } else if (
          before === "files" &&
          (o.status === "paid" || o.status === "printing")
        ) {
          pushToast(
            "💰 Payment confirm",
            `${o.id} · ${o.payment ? inr(o.payment.amount) : ""} via ${o.payment?.method ?? "UPI"}`,
            "bg-leaf text-paper"
          );
          beep();
        }
      }
    }
    prev.current = new Map(orders.map((o) => [o.id, o.status]));
  }, [orders]);

  if (settings.pin && !unlocked) {
    return <PinGate pin={settings.pin} onOk={() => setUnlocked(true)} />;
  }

  const revenue = orders
    .filter((o) => o.status !== "files")
    .reduce((s, o) => s + (o.payment?.amount ?? o.total ?? 0), 0);
  const pending = orders.filter((o) => o.status === "files").length;
  const printingNow = orders.filter((o) => o.status === "printing").length;

  const sorted = [...orders].sort((a, b) => b.updatedAt - a.updatedAt);

  return (
    <div className="min-h-screen">
      {/* ambient */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="halftone-bg absolute inset-0 opacity-60" />
        <div className="blob-cyan animate-drift-a absolute -top-40 -right-40 h-[30rem] w-[30rem] rounded-full" />
        <div className="blob-magenta animate-drift-b absolute -bottom-40 -left-40 h-[30rem] w-[30rem] rounded-full" />
      </div>

      {/* top bar */}
      <header className="border-b-2 border-ink bg-ink">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center border-2 border-paper/25 bg-magenta">
              <IconShield size={20} className="text-paper" />
            </span>
            <div className="leading-tight">
              <p className="font-display text-xl tracking-wide text-paper">
                PRESS ROOM <span className="text-yellow">ADMIN</span>
              </p>
              <p className="font-mono text-[10px] tracking-[0.28em] text-paper/50 uppercase">
                Jay Dwarkadhish Shop · Live Orders
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`hidden items-center gap-2 border-2 px-3 py-1.5 sm:flex ${
                syncStatus === "live"
                  ? "border-leaf bg-leaf/20"
                  : syncStatus === "connecting"
                    ? "border-yellow bg-yellow/10"
                    : "border-paper/25"
              }`}
            >
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  syncStatus === "live" ? "led bg-leaf" : syncStatus === "connecting" ? "bg-yellow" : "bg-paper/40"
                }`}
              />
              <span className="font-mono text-xs font-bold tracking-widest text-paper">
                {syncStatus === "live"
                  ? peerCount > 0
                    ? `CLOUD · ${peerCount + 1} LINKED`
                    : "CLOUD LIVE"
                  : syncStatus === "connecting"
                    ? "LINKING…"
                    : "LOCAL MODE"}
              </span>
            </span>
            <span className="flex items-center gap-2 border-2 border-paper/25 px-3 py-1.5">
              <span className="led h-2.5 w-2.5 rounded-full bg-leaf" />
              <span className="font-mono text-xs font-bold tracking-widest text-paper">LIVE</span>
            </span>
            <Link
              to="/"
              className="btn-press border-2 border-paper bg-yellow px-4 py-1.5 font-display text-base tracking-wide text-ink shadow-[3px_3px_0_0_rgba(241,241,234,0.35)]"
            >
              Kiosk ↩
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1.6fr_1fr]">
        {/* ---------- order feed ---------- */}
        <section>
          <div className="mb-4 flex items-center gap-3">
            <h2 className="font-display text-3xl tracking-wide uppercase">
              Live Orders <span className="text-magenta">({orders.length})</span>
            </h2>
            {orders.length > 0 && (
              <button
                onClick={() => {
                  if (confirmClear) {
                    clearOrders();
                    setConfirmClear(false);
                  } else {
                    setConfirmClear(true);
                  }
                }}
                onBlur={() => setConfirmClear(false)}
                className={`btn-press ml-auto border-2 border-ink px-3 py-1 font-mono text-[10px] font-bold tracking-widest uppercase shadow-press-sm ${
                  confirmClear ? "bg-magenta text-paper" : "bg-panel hover:bg-magenta/20"
                }`}
              >
                {confirmClear ? "Pakka clear? Click again" : "Clear All"}
              </button>
            )}
          </div>

          {sorted.length === 0 ? (
            <div className="border-2 border-dashed border-ink/40 bg-panel/60 px-6 py-14 text-center">
              <IconQr size={44} className="mx-auto text-ink/30" />
              <h3 className="mt-4 font-display text-2xl tracking-wide uppercase">Abhi koi order nahi</h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
                Kiosk par jaise hi koi <b className="text-ink">file upload</b> karega ya <b className="text-ink">payment confirm</b>{" "}
                hogi — order yahan <b className="text-ink">turant live</b> dikhega.
              </p>
              <p className="mx-auto mt-1 max-w-sm font-mono text-[10px] tracking-wider text-magenta uppercase">
                Phone ke orders ke liye right mein "Kiosk Live Link" code daalein
              </p>
              <Link
                to="/"
                className="btn-press mt-5 inline-flex items-center gap-2 border-2 border-ink bg-yellow px-5 py-2.5 font-display text-lg tracking-wide uppercase shadow-press-sm"
              >
                Kiosk kholo →
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {sorted.map((o) => (
                <OrderCard key={o.id} o={o} onPrint={setPrintOrder} />
              ))}
            </div>
          )}
        </section>

        {/* ---------- live sync + stats + settings ---------- */}
        <aside className="space-y-6">
          <SyncPanel />

          <div className="border-2 border-ink bg-ink p-5 shadow-press">
            <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-paper/60 uppercase">Aaj ka Hisaab</p>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-4">
              <div>
                <p className="font-display text-4xl text-cyan tabular-nums">{orders.length}</p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">Total Orders</p>
              </div>
              <div>
                <p className="font-display text-4xl text-leaf tabular-nums">{inr(revenue)}</p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">Revenue</p>
              </div>
              <div>
                <p className="font-display text-4xl text-magenta tabular-nums">{pending}</p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">Pending Pay</p>
              </div>
              <div>
                <p className="font-display text-4xl text-yellow tabular-nums">{printingNow}</p>
                <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">Printing Now</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {(Object.keys(STATUS_META) as OrderRecord["status"][]).map((s) => (
                <span key={s} className={`border border-paper/30 px-2 py-0.5 font-mono text-[9px] font-bold tracking-widest ${STATUS_META[s].cls}`}>
                  {STATUS_META[s].label}
                </span>
              ))}
            </div>
          </div>

          <SettingsPanel />

          <p className="font-mono text-[10px] leading-relaxed tracking-wider text-ink-soft uppercase">
            Kiosk Link chalu ho toh phone ke orders is laptop par realtime aate hain — payment confirm hote hi PRINT
            button dikhta hai.
          </p>
        </aside>
      </main>

      {/* ---------- print station overlay ---------- */}
      {printOrder && (
        <PrintStation
          order={printOrder}
          onClose={() => setPrintOrder(null)}
          onDone={() => {
            patchOrder(printOrder.id, { status: "done" }, "Printed from admin Print Station");
            pushToast("✅ Order complete", `${printOrder.id} print ho gaya — DONE`, "bg-ink text-paper");
            setPrintOrder(null);
          }}
        />
      )}

      {/* ---------- live toasts ---------- */}
      <div className="pointer-events-none fixed top-4 right-4 z-50 flex w-72 flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`toast-in border-2 border-ink px-4 py-3 shadow-press-sm ${t.tone}`}>
            <p className="font-display text-lg leading-tight tracking-wide uppercase">{t.title}</p>
            <p className="mt-0.5 font-mono text-[10px] font-semibold tracking-wider">{t.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
