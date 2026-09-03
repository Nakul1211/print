import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import confetti from "canvas-confetti";
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
  IconReg,
  IconRupee,
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
  { name: "Google Pay", scheme: "tez", glyph: GlyphGPay, hint: "GPay app khulega" },
  { name: "PhonePe", scheme: "phonepe", glyph: GlyphPhonePe, hint: "PhonePe app khulega" },
  { name: "Paytm", scheme: "paytm", glyph: GlyphPaytm, hint: "Paytm app khulega" },
  { name: "Any UPI App", scheme: "upi", glyph: GlyphUpi, hint: "BHIM / koi bhi UPI app" },
];

/** clipboard copy that never throws */
async function copyQuiet(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}

export default function PaymentScreen({ quote, options, onSuccess, onBack }: Props) {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>("pay");
  const [method, setMethod] = useState("UPI QR Scan");
  const [launching, setLaunching] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const orderIdRef = useRef(makeOrderId());
  const orderId = orderIdRef.current;
  const amount = quote.total;

  const vpa = settings.upiId || SHOP.vpa;
  const payee = settings.payeeName || SHOP.name;
  const qrValue = upiLink(amount, orderId, "upi", vpa, payee);

  /* verifying → success → hand over to printing */
  useEffect(() => {
    if (phase !== "verifying") return;
    const t = setTimeout(() => setPhase("success"), 2100);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "success") return;
    confetti({
      particleCount: 110,
      spread: 80,
      origin: { y: 0.55 },
      colors: ["#00a5c8", "#e5097f", "#ffd21f", "#178f4c", "#15172b"],
    });
    const t = setTimeout(
      () =>
        onSuccess({
          orderId,
          amount,
          method,
          upiRef: makeUpiRef(),
          paidAt: new Date(),
        }),
      1400
    );
    return () => clearTimeout(t);
  }, [phase, amount, method, orderId, onSuccess]);

  /** Anchor-based deep link: browser handles the scheme natively (best compatibility). */
  const onAppClick = (scheme: string, name: string) => {
    if (phase !== "pay") return;
    setMethod(name);
    setShowHint(false);
    setLaunching(name);
    void copyQuiet(qrValue); /* silent fallback — link clipboard mein ready */
    window.setTimeout(() => setShowHint(true), 2400);
    window.setTimeout(() => setLaunching(null), 2600);
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
            <span className="flex items-center gap-2">
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-yellow" />
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-yellow" style={{ animationDelay: "0.15s" }} />
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-yellow" style={{ animationDelay: "0.3s" }} />
              <span className="led ml-1 h-2.5 w-2.5 rounded-full bg-leaf" />
            </span>
          </div>

          <p className="mt-4 text-center font-display text-2xl tracking-wide text-paper uppercase">{payee}</p>

          <div className="relative mt-4 overflow-hidden border-2 border-ink bg-panel p-4">
            <span
              key={amount}
              className="amount-pop absolute -top-3.5 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 border-2 border-ink bg-yellow px-4 py-0.5 font-display text-2xl tracking-wide shadow-press-sm"
            >
              <IconRupee size={18} /> {amount}
            </span>

            {settings.qrImage ? (
              <img
                src={settings.qrImage}
                alt={`${payee} UPI QR`}
                className="mx-auto mt-3 w-56 border border-ink/20 object-contain"
              />
            ) : (
              <div className="relative mx-auto mt-3 w-max">
                <QRCode value={qrValue} size={212} bgColor="#FBFBF6" fgColor="#15172B" />
                {/* scanner beam */}
                <span className="qr-scanline pointer-events-none absolute left-0 right-0" aria-hidden="true" />
                {/* corner brackets */}
                <span className="pointer-events-none absolute -top-1.5 -left-1.5 h-5 w-5 border-t-[3px] border-l-[3px] border-magenta" />
                <span className="pointer-events-none absolute -top-1.5 -right-1.5 h-5 w-5 border-t-[3px] border-r-[3px] border-cyan" />
                <span className="pointer-events-none absolute -bottom-1.5 -left-1.5 h-5 w-5 border-b-[3px] border-l-[3px] border-cyan" />
                <span className="pointer-events-none absolute -right-1.5 -bottom-1.5 h-5 w-5 border-r-[3px] border-b-[3px] border-magenta" />
              </div>
            )}

            <p className="mt-3 text-center font-mono text-[11px] font-bold break-all">{vpa}</p>
            <p className="mt-1 text-center font-mono text-[10px] tracking-wider text-ink-soft">
              {settings.qrImage ? `Scan ke baad amount ${inr(amount)} daal dena` : "QR mein amount auto-fill hai"} · Order {orderId}
            </p>
          </div>

          {settings.note && (
            <p className="mt-3 text-center font-mono text-[10px] tracking-wider text-yellow/90">{settings.note}</p>
          )}
          <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.2em] text-paper/50 uppercase">
            <IconShield size={13} /> Secure UPI Payment
          </p>
        </div>

        {/* ---------- app buttons + confirm ---------- */}
        <div className="flex flex-col">
          <div className="border-2 border-ink bg-panel p-5 shadow-press">
            <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-ink-soft uppercase">
              Ya phone se app kholo
            </p>

            <div className="mt-3 grid grid-cols-2 gap-3">
              {APPS.map((a, i) => (
                <a
                  key={a.scheme}
                  href={upiLink(amount, orderId, a.scheme, vpa, payee)}
                  onClick={() => onAppClick(a.scheme, a.name)}
                  className="btn-press pop-in group flex items-center gap-3 border-2 border-ink bg-paper px-3.5 py-3 shadow-press-sm hover:bg-yellow/25"
                  style={{ animationDelay: `${0.08 + i * 0.07}s` }}
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink bg-panel transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3">
                    <a.glyph size={24} />
                  </span>
                  <span className="min-w-0 text-left leading-tight">
                    <span className="block truncate text-sm font-extrabold">{a.name}</span>
                    <span className="font-mono text-[9px] font-bold tracking-[0.16em] text-ink-soft uppercase">
                      {launching === a.name ? "Khul rahi hai…" : a.hint}
                    </span>
                  </span>
                </a>
              ))}
            </div>

            {showHint && phase === "pay" && (
              <p className="pop-in mt-3 border-2 border-dashed border-ink/50 bg-yellow/25 px-3 py-2 text-xs font-bold">
                App nahi khuli? UPI link <b>copy ho chuka hai</b> — browser address bar mein paste karo, ya upar QR scan
                karo. (Desktop par QR scan best hai)
              </p>
            )}

            <div className="tear-line mt-4 pt-4">
              <button
                onClick={() => setPhase("verifying")}
                disabled={phase !== "pay"}
                className="btn-press group flex w-full items-center justify-center gap-2 border-2 border-ink bg-leaf px-5 py-3.5 font-display text-xl tracking-wide text-paper uppercase shadow-press-sm"
              >
                <IconCheck size={20} className="transition-transform group-hover:scale-125" /> Maine Pay Kar Diya
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
              Mobile par app button dabao — app khulega with amount <b className="text-ink">{inr(amount)}</b>. Desktop /
              laptop par phone se <b className="text-ink">QR scan</b> karo.
            </p>
          </div>
        </div>
      </div>

      {/* ---------- verify / success overlay ---------- */}
      {phase !== "pay" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/75 p-4 backdrop-blur-[2px]">
          <div className="pop-in w-full max-w-sm border-2 border-ink bg-panel p-8 text-center shadow-press-lg">
            {phase === "verifying" ? (
              <>
                <IconReg size={52} className="animate-spin-slow mx-auto text-magenta" />
                <h3 className="mt-4 font-display text-3xl tracking-wide uppercase">
                  Payment <span className="text-cyan">check ho raha hai</span>
                </h3>
                <p className="mt-2 font-mono text-[11px] tracking-wider text-ink-soft uppercase">
                  {method} · Order {orderId}
                </p>
                <div className="shimmer-bar mt-5 h-3 w-full border-2 border-ink bg-leaf/80" />
                <p className="mt-3 font-mono text-[10px] font-bold tracking-[0.25em] text-ink-soft uppercase">
                  Bank se confirm ho raha hai…
                </p>
              </>
            ) : (
              <>
                <span className="pop-in mx-auto flex h-16 w-16 items-center justify-center border-2 border-ink bg-leaf shadow-press-sm">
                  <IconCheck size={34} className="text-paper" />
                </span>
                <h3 className="mt-4 font-display text-3xl tracking-wide uppercase">
                  Payment <span className="text-leaf">mil gaya!</span>
                </h3>
                <p className="mt-1 font-display text-2xl">{inr(amount)}</p>
                <p className="mt-2 font-mono text-[10px] font-bold tracking-[0.25em] text-ink-soft uppercase">
                  Printing shuru ho rahi hai…
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
