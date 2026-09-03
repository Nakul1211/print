import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import type { PaymentRecord, PrintOptions, Quote } from "../lib/pricing";
import { SHOP, inr, makeOrderId, makeUpiRef, upiLink } from "../lib/pricing";
import { useSettings } from "../lib/store";
import {
  GlyphGPay,
  GlyphPaytm,
  GlyphPhonePe,
  GlyphUpi,
  IconArrowL,
  IconCheck,
  IconPhone,
  IconShield,
} from "../components/icons";

interface Props {
  quote: Quote;
  options: PrintOptions;
  onSuccess: (payment: PaymentRecord) => void;
  onBack: () => void;
}

type Phase = "pay" | "verifying" | "success";

const APPS = [
  { name: "Google Pay", scheme: "tez", glyph: GlyphGPay },
  { name: "PhonePe", scheme: "phonepe", glyph: GlyphPhonePe },
  { name: "Paytm", scheme: "paytm", glyph: GlyphPaytm },
  { name: "BHIM / Any UPI", scheme: "upi", glyph: GlyphUpi },
];

export default function PaymentScreen({ quote, options, onSuccess, onBack }: Props) {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>("pay");
  const [method, setMethod] = useState("UPI QR Scan");
  const [launching, setLaunching] = useState<string | null>(null);
  const [blockedLink, setBlockedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const orderIdRef = useRef(makeOrderId());
  const orderId = orderIdRef.current;
  const amount = quote.total;

  const vpa = settings.upiId || SHOP.vpa;
  const payee = settings.payeeName || SHOP.name;
  const qrValue = upiLink(amount, orderId, "upi", vpa, payee);

  useEffect(() => {
    if (phase !== "verifying") return;
    const t = setTimeout(() => setPhase("success"), 2000);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(() => {
      onSuccess({
        orderId,
        amount,
        method,
        upiRef: makeUpiRef(),
        paidAt: new Date(),
      });
    }, 1100);
    return () => clearTimeout(t);
  }, [phase, amount, method, orderId, onSuccess]);

  /** Opens the chosen UPI app via its deep link; shows a fallback if blocked. */
  const launch = (scheme: string, name: string) => {
    if (phase !== "pay") return;
    setMethod(name);
    setBlockedLink(null);
    setLaunching(name);
    const link = upiLink(amount, orderId, scheme, vpa, payee);
    let win: Window | null = null;
    try {
      win = window.open(link, "_blank", "noopener");
    } catch {
      win = null;
    }
    if (!win) setBlockedLink(link);
    window.setTimeout(() => setLaunching(null), 2600);
  };

  const copyLink = async () => {
    const link = blockedLink ?? qrValue;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* ignore */
      }
      ta.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section className="screen-in relative mx-auto w-full max-w-5xl px-4 pt-8 pb-12">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-amber uppercase">Step 03 / Payment</p>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
            UPI se <span className="text-cyan">pay karo</span>
          </h2>
          <p className="mb-1.5 font-mono text-[11px] font-bold tracking-widest text-ink-soft uppercase">
            {options.color === "bw" ? "B&W" : "Colour"} · {options.size} · {options.duplex ? "Both sides" : "One side"} · ×
            {options.copies}
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.15fr]">
        {/* ---------- QR panel ---------- */}
        <div className="border-2 border-ink bg-ink p-5 shadow-press-lg sm:p-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-paper/60 uppercase">Scan & Pay</span>
            <span className="led h-2.5 w-2.5 rounded-full bg-leaf" />
          </div>

          <div className="relative mt-5 border-2 border-ink bg-panel p-4">
            <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 border-2 border-ink bg-yellow px-4 py-0.5 font-display text-2xl tracking-wide shadow-press-sm">
              {inr(amount)}
            </span>
            {settings.qrImage ? (
              <img
                src={settings.qrImage}
                alt="Shop UPI QR"
                className="mx-auto mt-3 w-56 border border-ink/20 object-contain"
              />
            ) : (
              <QRCode value={qrValue} size={212} bgColor="#FBFBF6" fgColor="#15172B" style={{ margin: "12px auto 0" }} />
            )}
            <p className="mt-3 text-center font-mono text-[11px] font-bold tracking-wider break-all">{vpa}</p>
            <p className="mt-1 text-center font-mono text-[10px] tracking-wider text-ink-soft">
              {settings.qrImage
                ? `Scan ke baad amount ${inr(amount)} daal dena`
                : "QR mein amount auto-fill hai"}
            </p>
          </div>

          {settings.note && (
            <p className="mt-3 text-center font-mono text-[10px] tracking-wider text-yellow/90">{settings.note}</p>
          )}
          <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.2em] text-paper/50 uppercase">
            <IconShield size={13} /> Secure UPI · Order {orderId}
          </p>
        </div>

        {/* ---------- app buttons + confirm ---------- */}
        <div className="flex flex-col">
          <div className="border-2 border-ink bg-panel p-5 shadow-press">
            <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-ink-soft uppercase">
              Ya app se pay karo
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {APPS.map((a) => (
                <button
                  key={a.scheme}
                  onClick={() => launch(a.scheme, a.name)}
                  disabled={phase !== "pay"}
                  className="btn-press group flex items-center gap-3 border-2 border-ink bg-paper px-3.5 py-3 shadow-press-sm hover:bg-yellow/25"
                >
                  <a.glyph size={26} />
                  <span className="text-left leading-tight">
                    <span className="block text-sm font-extrabold">{a.name}</span>
                    <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-ink-soft uppercase">
                      {launching === a.name ? "Khul rahi hai…" : "Open app ↗"}
                    </span>
                  </span>
                </button>
              ))}
            </div>

            {blockedLink && (
              <div className="pop-in mt-3 border-2 border-ink bg-yellow/30 p-3">
                <p className="text-xs font-bold">
                  App nahi khuli? Payment link copy karke UPI app / browser mein paste karo:
                </p>
                <p className="mt-1 font-mono text-[10px] break-all text-ink-soft">{blockedLink}</p>
                <button
                  onClick={copyLink}
                  className="btn-press mt-2 border-2 border-ink bg-ink px-3 py-1.5 font-mono text-[11px] font-bold tracking-widest text-paper uppercase shadow-press-sm"
                >
                  {copied ? "✓ Copied!" : "Copy Link"}
                </button>
              </div>
            )}

            <div className="tear-line mt-4 pt-4">
              <button
                onClick={() => setPhase("verifying")}
                disabled={phase !== "pay"}
                className="btn-press flex w-full items-center justify-center gap-2 border-2 border-ink bg-leaf px-5 py-3.5 font-display text-xl tracking-wide text-paper uppercase shadow-press-sm"
              >
                <IconCheck size={20} /> Maine Pay Kar Diya
              </button>
              <button
                onClick={onBack}
                disabled={phase !== "pay"}
                className="btn-press mt-3 flex w-full items-center justify-center gap-2 border-2 border-ink bg-paper px-4 py-2 font-mono text-[11px] font-bold tracking-[0.2em] uppercase shadow-press-sm hover:bg-yellow/30"
              >
                <IconArrowL size={15} /> Bill par wapas
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 border-2 border-dashed border-ink/40 bg-panel/70 px-4 py-3">
            <IconPhone size={20} className="shrink-0 text-magenta" />
            <p className="text-xs leading-snug font-medium text-ink-soft">
              Phone par ho toh app button dabao — <b className="text-ink">{method === "UPI QR Scan" ? "GPay / PhonePe / Paytm" : method}</b>{" "}
              khulega with amount {inr(amount)}. Desktop par QR scan karo.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- verify / success overlay ---------- */}
      {phase !== "pay" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-[2px]">
          <div className="pop-in w-full max-w-sm border-2 border-ink bg-panel p-8 text-center shadow-press-lg">
            {phase === "verifying" ? (
              <>
                <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-ink border-t-magenta" />
                <h3 className="mt-5 font-display text-2xl tracking-wide uppercase">Payment verify ho rahi hai</h3>
                <p className="mt-2 font-mono text-[11px] tracking-wider text-ink-soft uppercase">
                  {orderId} · {inr(amount)} · {method}
                </p>
              </>
            ) : (
              <>
                <span className="stamp-in inline-block border-[3px] border-leaf px-5 py-2 font-display text-4xl tracking-[0.15em] text-leaf uppercase">
                  Paid
                </span>
                <h3 className="mt-4 font-display text-2xl tracking-wide uppercase">Payment confirm!</h3>
                <p className="mt-2 font-mono text-[11px] tracking-wider text-ink-soft uppercase">
                  Admin ko notify ho gaya · Press start ho rahi hai…
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
