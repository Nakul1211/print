import { useEffect, useRef, useState } from "react";
import QRCode from "react-qr-code";
import type { PaymentRecord, PrintOptions, Quote } from "../lib/pricing";
import { SHOP, inr, inr2, makeOrderId, makeUpiRef, upiLink } from "../lib/pricing";
import { GlyphGPay, GlyphPaytm, GlyphPhonePe, GlyphUpi, IconArrowL, IconCheck, IconPhone, IconShield } from "../components/icons";

interface Props {
  quote: Quote;
  options: PrintOptions;
  onSuccess: (payment: PaymentRecord) => void;
  onBack: () => void;
}

type Phase = "pay" | "verifying" | "success";

const APPS = [
  { name: "Google Pay", scheme: "tez", glyph: GlyphGPay, chip: "bg-panel" },
  { name: "PhonePe", scheme: "phonepe", glyph: GlyphPhonePe, chip: "bg-panel" },
  { name: "Paytm", scheme: "paytm", glyph: GlyphPaytm, chip: "bg-panel" },
  { name: "BHIM / Any UPI", scheme: "upi", glyph: GlyphUpi, chip: "bg-panel" },
];

export default function PaymentScreen({ quote, options, onSuccess, onBack }: Props) {
  const [phase, setPhase] = useState<Phase>("pay");
  const [method, setMethod] = useState("UPI QR Scan");
  const orderIdRef = useRef(makeOrderId());
  const orderId = orderIdRef.current;
  const amount = quote.total;

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

  const openApp = (scheme: string, name: string) => {
    setMethod(name);
    window.location.href = upiLink(amount, orderId, scheme);
  };

  return (
    <section className="screen-in relative mx-auto w-full max-w-4xl px-4 pt-8">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-amber uppercase">Step 03 / Payment</p>
        <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          UPI se <span className="text-cyan">pay karo</span>
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-[0.9fr_1.1fr]">
        {/* QR panel */}
        <div className="border-2 border-ink bg-ink p-6 shadow-press-lg">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[10px] font-bold tracking-[0.28em] text-paper/70 uppercase">Scan & Pay</p>
            <span className="led h-2.5 w-2.5 rounded-full bg-yellow" />
          </div>

          <div className="relative mt-4 border-2 border-ink bg-panel p-5">
            <QRCode value={upiLink(amount, orderId)} size={196} bgColor="#FBFBF6" fgColor="#15172B" style={{ margin: "0 auto" }} />
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 border-2 border-ink bg-yellow px-3 py-0.5 font-mono text-xs font-bold shadow-press-sm">
              {inr2(amount)}
            </span>
          </div>

          <div className="mt-4 space-y-1 font-mono text-[11px] font-semibold tracking-wider text-paper/75">
            <p className="flex justify-between gap-3">
              <span className="text-paper/50">ORDER</span>
              <span className="text-yellow">{orderId}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-paper/50">VPA</span>
              <span className="truncate">{SHOP.vpa}</span>
            </p>
            <p className="flex justify-between gap-3">
              <span className="text-paper/50">JOB</span>
              <span>
                {options.color === "bw" ? "B&W" : "COLOUR"} · {options.duplex ? "BOTH SIDES" : "ONE SIDE"} · {options.size.toUpperCase()} · ×{options.copies}
              </span>
            </p>
          </div>

          <p className="mt-4 flex items-start gap-2 text-xs leading-snug font-medium text-paper/70">
            <IconPhone size={16} className="mt-0.5 shrink-0 text-cyan" />
            Kisi bhi UPI app ke scanner se QR scan karo — amount apne aap bhara hua hai.
          </p>
        </div>

        {/* apps + confirm */}
        <div className="flex flex-col">
          <p className="mb-2 font-mono text-[11px] font-bold tracking-[0.24em] uppercase">Ya app se kholo</p>
          <div className="grid grid-cols-2 gap-3">
            {APPS.map((app) => (
              <button
                key={app.name}
                onClick={() => openApp(app.scheme, app.name)}
                className="btn-press card-lift flex items-center gap-3 border-2 border-ink bg-panel px-4 py-3.5 text-left shadow-press-sm"
              >
                <app.glyph size={26} />
                <span className="leading-tight">
                  <span className="block text-sm font-bold">{app.name}</span>
                  <span className="font-mono text-[9px] font-semibold tracking-[0.18em] text-ink-soft uppercase">Tap to open</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-5 flex-1 border-2 border-dashed border-ink/40 bg-yellow/15 p-4">
            <p className="flex items-start gap-2 text-sm leading-relaxed font-semibold">
              <IconShield size={18} className="mt-0.5 shrink-0 text-leaf" />
              Payment ho gaya? Neeche confirm karo — kiosk turant print job start kar dega. Galat amount par cancel ho jayega.
            </p>
          </div>

          <button
            onClick={() => setPhase("verifying")}
            className="btn-press mt-5 flex w-full items-center justify-center gap-3 border-2 border-ink bg-leaf px-6 py-4 font-display text-2xl tracking-wide text-paper uppercase shadow-press"
          >
            <IconCheck size={22} /> Maine Pay Kar Diya
          </button>

          <button
            onClick={onBack}
            className="btn-press mt-3 flex w-full items-center justify-center gap-2 border-2 border-ink bg-panel px-5 py-2.5 font-mono text-xs font-bold tracking-widest uppercase shadow-press-sm"
          >
            <IconArrowL size={16} /> Bill par wapas
          </button>
        </div>
      </div>

      {/* verify / success overlay */}
      {phase !== "pay" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4 backdrop-blur-sm">
          <div className="pop-in w-full max-w-sm border-2 border-ink bg-panel p-8 text-center shadow-press-lg">
            {phase === "verifying" ? (
              <>
                <div className="relative mx-auto mb-5 h-16 w-16">
                  <span className="pulse-ring absolute inset-0 rounded-full border-2 border-leaf" />
                  <span className="flex h-16 w-16 animate-spin items-center justify-center rounded-full border-4 border-ink border-t-leaf" style={{ animationDuration: "0.9s" }} />
                </div>
                <p className="font-display text-2xl tracking-wide uppercase">Payment verify ho raha hai</p>
                <p className="mt-2 font-mono text-xs font-semibold tracking-widest text-ink-soft uppercase">
                  {orderId} · {inr2(amount)}
                </p>
              </>
            ) : (
              <>
                <span className="stamp-in mx-auto mb-5 flex h-20 w-20 items-center justify-center border-4 border-leaf bg-leaf/10 text-leaf">
                  <IconCheck size={40} />
                </span>
                <p className="font-display text-3xl tracking-wide text-leaf uppercase">Payment Success!</p>
                <p className="mt-2 font-mono text-xs font-semibold tracking-widest text-ink-soft uppercase">
                  {inr2(amount)} received · print queue mein bheja ja raha hai…
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
