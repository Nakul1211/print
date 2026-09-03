import { useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import QRCode from "react-qr-code";
import type { PaymentRecord, PrintOptions, Quote } from "../lib/pricing";
import { SHOP, inr, makeOrderId, makeUpiRef, upiLink } from "../lib/pricing";
import { useSettings } from "../lib/store";
import { GlyphUpi, IconArrowL, IconCheck, IconQr, IconReg, IconShield } from "../components/icons";

interface Props {
  quote: Quote;
  options: PrintOptions;
  onSuccess: (payment: PaymentRecord) => void;
  onBack: () => void;
}

type Phase = "pay" | "verifying" | "success";

const STEPS = [
  { n: "1", text: "QR scan karo ya UPI button dabao" },
  { n: "2", text: "App mein amount confirm karke pay karo" },
  { n: "3", text: "Neeche green button se payment confirm karo" },
];

export default function PaymentScreen({ quote, options, onSuccess, onBack }: Props) {
  const settings = useSettings();
  const [phase, setPhase] = useState<Phase>("pay");
  const [opened, setOpened] = useState(false);
  const orderIdRef = useRef(makeOrderId());
  const orderId = orderIdRef.current;
  const amount = quote.total;

  const vpa = settings.upiId || SHOP.vpa;
  const payee = settings.payeeName || SHOP.name;
  const qrValue = upiLink(amount, orderId, "upi", vpa, payee);

  useEffect(() => {
    if (phase !== "verifying") return;
    const t = window.setTimeout(() => setPhase("success"), 2000);
    return () => window.clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "success") return;
    const t = window.setTimeout(() => {
      onSuccess({
        orderId,
        amount,
        method: "UPI",
        upiRef: makeUpiRef(),
        paidAt: new Date(),
      });
    }, 1100);
    return () => window.clearTimeout(t);
  }, [phase, amount, orderId, onSuccess]);

  /* silent fallback: link copy ho jata hai agar app na khule */
  const openUpi = () => {
    if (phase !== "pay") return;
    try {
      const ta = document.createElement("textarea");
      ta.value = qrValue;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    } catch {
      /* clipboard unavailable */
    }
    setOpened(true);
    window.setTimeout(() => setOpened(false), 3200);
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
            <span className="flex items-center gap-1.5">
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-cyan" />
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-magenta" style={{ animationDelay: "0.2s" }} />
              <span className="wait-dot h-1.5 w-1.5 rounded-full bg-yellow" style={{ animationDelay: "0.4s" }} />
            </span>
          </div>

          <div className="relative mt-5 border-2 border-ink bg-panel p-4">
            <span
              key={amount}
              className="amount-pop absolute -top-3.5 left-1/2 border-2 border-ink bg-yellow px-4 py-0.5 font-display text-2xl tracking-wide shadow-press-sm"
            >
              {inr(amount)}
            </span>

            <div className="relative mt-3 px-2">
              {/* CMYK corner brackets */}
              <span className="absolute -top-1 -left-1 h-4 w-4 border-t-[3px] border-l-[3px] border-cyan" />
              <span className="absolute -top-1 -right-1 h-4 w-4 border-t-[3px] border-r-[3px] border-magenta" />
              <span className="absolute -bottom-1 -left-1 h-4 w-4 border-b-[3px] border-l-[3px] border-yellow" />
              <span className="absolute -right-1 -bottom-1 h-4 w-4 border-r-[3px] border-b-[3px] border-ink" />

              {settings.qrImage ? (
                <img
                  src={settings.qrImage}
                  alt="Shop UPI QR"
                  className="relative mx-auto w-56 border border-ink/20 object-contain"
                />
              ) : (
                <QRCode value={qrValue} size={212} bgColor="#FBFBF6" fgColor="#15172B" style={{ margin: "0 auto" }} />
              )}
              <span className="qr-scanline" aria-hidden="true" />
            </div>

            <p className="mt-3 text-center font-display text-lg tracking-wide break-all">{payee}</p>
            <p className="mt-1 text-center font-mono text-[11px] font-bold tracking-wider break-all text-ink-soft">{vpa}</p>
            <p className="mt-1 text-center font-mono text-[10px] tracking-wider text-ink-soft">
              {settings.qrImage ? `Scan ke baad amount ${inr(amount)} daal dena` : "QR mein amount auto-fill hai"}
            </p>
          </div>

          {settings.note && (
            <p className="mt-3 text-center font-mono text-[10px] tracking-wider text-yellow/90">{settings.note}</p>
          )}
          <p className="mt-3 flex items-center justify-center gap-2 font-mono text-[10px] tracking-[0.2em] text-paper/50 uppercase">
            <IconShield size={13} /> Secure UPI · Order {orderId}
          </p>
        </div>

        {/* ---------- single UPI pay + confirm ---------- */}
        <div className="flex flex-col">
          <div className="border-2 border-ink bg-panel p-5 shadow-press">
            <p className="font-mono text-[10px] font-bold tracking-[0.3em] text-ink-soft uppercase">Pay with UPI</p>

            {/* the one professional pay button */}
            <a
              href={qrValue}
              onClick={openUpi}
              className="btn-press group mt-3 flex w-full items-center justify-center gap-3 border-2 border-ink bg-cyan px-5 py-4 shadow-press-sm hover:bg-cyan/85"
            >
              <span className="flex h-11 w-11 items-center justify-center border-2 border-ink bg-panel">
                <GlyphUpi size={26} />
              </span>
              <span className="text-left leading-tight">
                <span className="block font-display text-2xl tracking-wide uppercase">
                  Pay {inr(amount)} <span className="inline-block transition-transform group-hover:translate-x-1">→</span>
                </span>
                <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-ink/70 uppercase">
                  GPay · PhonePe · Paytm · BHIM — koi bhi UPI app khulegi
                </span>
              </span>
            </a>

            {opened && (
              <p className="pop-in mt-2 flex items-center gap-2 font-mono text-[10px] font-bold tracking-wider text-leaf uppercase">
                <IconCheck size={13} /> Payment link copy bhi ho gaya — app na khule toh link paste karo
              </p>
            )}

            {/* mini steps */}
            <ol className="mt-4 space-y-1.5">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-center gap-2.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center border-2 border-ink bg-yellow font-display text-sm">
                    {s.n}
                  </span>
                  <span className="text-xs font-semibold text-ink-soft">{s.text}</span>
                </li>
              ))}
            </ol>

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
            <IconQr size={22} className="shrink-0 text-magenta" />
            <p className="text-xs leading-snug font-medium text-ink-soft">
              <b className="text-ink">Phone par:</b> button dabao — apni UPI app khulegi with amount {inr(amount)}.{" "}
              <b className="text-ink">Desktop par:</b> phone se QR scan karo. Payment ke baad admin panel mein order{" "}
              <b className="text-ink">PAID</b> ho jayega.
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
                <IconReg size={46} className="animate-spin-slow mx-auto text-cyan" />
                <h3 className="mt-4 font-display text-3xl tracking-wide uppercase">Payment verify…</h3>
                <div className="shimmer-bar mx-auto mt-4 h-2.5 w-48 border-2 border-ink bg-cyan" />
                <p className="mt-3 font-mono text-[11px] font-bold tracking-widest text-ink-soft uppercase">
                  UPI network check ho raha hai
                </p>
              </>
            ) : (
              <>
                <span className="pop-in mx-auto flex h-16 w-16 items-center justify-center border-2 border-ink bg-leaf text-paper shadow-press-sm">
                  <IconCheck size={34} />
                </span>
                <h3 className="mt-4 font-display text-3xl tracking-wide text-leaf uppercase">Payment Pakka!</h3>
                <p className="mt-2 font-mono text-xs font-bold tracking-widest text-ink-soft uppercase">
                  {inr(amount)} received · Press start…
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* confetti burst */}
      {phase === "success" && <ConfettiBurst />}
    </section>
  );
}

function ConfettiBurst() {
  useEffect(() => {
    const colors = ["#00a5c8", "#e5097f", "#ffd21f", "#15172b", "#178f4c"];
    confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, colors });
    const t = window.setTimeout(
      () => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4 }, colors }),
      250
    );
    return () => window.clearTimeout(t);
  }, []);
  return null;
}
