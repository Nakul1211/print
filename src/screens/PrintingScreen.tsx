import { useEffect, useState } from "react";
import type { PaymentRecord, PrintOptions, Quote } from "../lib/pricing";
import { inr } from "../lib/pricing";
import { IconInk } from "../components/icons";

interface Props {
  quote: Quote;
  options: PrintOptions;
  payment: PaymentRecord;
  onComplete: () => void;
}

const INKS = [
  { label: "C", color: "bg-cyan", text: "text-cyan" },
  { label: "M", color: "bg-magenta", text: "text-magenta" },
  { label: "Y", color: "bg-yellow", text: "text-ink" },
  { label: "K", color: "bg-ink", text: "text-ink" },
];

export default function PrintingScreen({ quote, options, payment, onComplete }: Props) {
  const total = Math.max(1, quote.totalSheets);
  const [done, setDone] = useState(0);

  useEffect(() => {
    const per = Math.max(280, Math.min(800, 5200 / total));
    const t = setInterval(() => {
      setDone((d) => {
        if (d >= total) return d;
        return d + 1;
      });
    }, per);
    return () => clearInterval(t);
  }, [total]);

  useEffect(() => {
    if (done >= total) {
      const t = setTimeout(onComplete, 900);
      return () => clearTimeout(t);
    }
  }, [done, total, onComplete]);

  const pct = Math.min(100, Math.round((done / total) * 100));
  const finished = done >= total;

  return (
    <section className="screen-in mx-auto w-full max-w-3xl px-4 pt-8">
      <div className="mb-6 text-center">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-cyan uppercase">Step 04 / Press</p>
        <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          {finished ? (
            <>
              Job <span className="text-leaf">complete!</span>
            </>
          ) : (
            <>
              Chhapai <span className="text-magenta">jaari hai</span>
            </>
          )}
        </h2>
      </div>

      {/* press machine */}
      <div className="relative border-2 border-ink bg-panel p-6 shadow-press-lg sm:p-8">
        <div className="flex items-center justify-between border-b-2 border-dashed border-ink/30 pb-4">
          <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-ink-soft uppercase">
            {payment.orderId} · {options.size} · {options.duplex ? "Duplex" : "Simplex"}
          </p>
          <span className={`flex items-center gap-2 font-mono text-[10px] font-bold tracking-[0.24em] uppercase ${finished ? "text-leaf" : "text-amber"}`}>
            <span className={`h-2 w-2 rounded-full ${finished ? "bg-leaf" : "led bg-amber"}`} />
            {finished ? "Done" : "Printing"}
          </span>
        </div>

        {/* animated printer */}
        <div className="mx-auto mt-6 w-full max-w-sm">
          <div className="relative border-2 border-ink bg-ink p-4">
            {/* paper slot */}
            <div className="relative mx-auto h-28 w-40 overflow-hidden border-2 border-ink bg-ink">
              <div className="paper-feed absolute inset-x-3 top-2 bottom-0 border-2 border-ink bg-paper shadow-sm">
                <div className="space-y-1.5 p-2">
                  <div className="h-1.5 w-3/4 bg-cyan/70" />
                  <div className="h-1.5 w-full bg-ink/25" />
                  <div className="h-1.5 w-5/6 bg-ink/25" />
                  <div className="h-1.5 w-2/3 bg-magenta/60" />
                  <div className="h-1.5 w-full bg-ink/25" />
                  <div className="h-1.5 w-1/2 bg-ink/25" />
                </div>
              </div>
            </div>
            {/* printer body */}
            <div className="relative mt-2 border-2 border-ink bg-panel px-4 py-3">
              <div className="relative h-2.5 w-full overflow-hidden border border-ink bg-paper">
                <span className="head-scan absolute top-0 h-full w-10 bg-magenta/80" />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-display text-sm tracking-widest">JD-LASERJET 01</span>
                <span className="flex gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-cyan" />
                  <span className="h-2 w-2 rounded-full bg-magenta" />
                  <span className="h-2 w-2 rounded-full bg-yellow" />
                </span>
              </div>
            </div>
          </div>

          {/* ink cartridges */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {INKS.map((ink) => {
              const drain = options.color === "bw" && ink.label !== "K" ? 2 : Math.min(58, pct * 0.55);
              const level = 96 - drain;
              return (
                <div key={ink.label} className="border-2 border-ink bg-panel p-2">
                  <p className={`flex items-center gap-1 font-mono text-[10px] font-bold ${ink.text}`}>
                    <IconInk size={12} /> {ink.label}
                  </p>
                  <div className="mt-1.5 h-14 w-full border border-ink bg-paper">
                    <div
                      className={`ml-auto h-full w-full origin-bottom ${ink.color} transition-all duration-500`}
                      style={{ height: `${level}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center font-mono text-[9px] font-bold text-ink-soft">{level}%</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* progress */}
        <div className="mt-6">
          <div className="flex items-center justify-between font-mono text-xs font-bold tracking-widest uppercase">
            <span>{finished ? "Nikal lo — tray mein ready hai" : `Sheet ${Math.min(done + 1, total)} / ${total}`}</span>
            <span className="font-display text-2xl tabular-nums">{pct}%</span>
          </div>
          <div className="mt-2 h-5 border-2 border-ink bg-paper">
            <div
              className={`h-full transition-all duration-300 ${finished ? "bg-leaf" : "stripes-live"}`}
              style={{ width: `${Math.max(4, pct)}%` }}
            />
          </div>
          <p className="mt-3 text-center font-mono text-[11px] font-semibold tracking-wider text-ink-soft uppercase">
            {quote.totalPages} pages · {total} sheets · {options.copies} cop{options.copies === 1 ? "y" : "ies"} · paid {inr(payment.amount)}
          </p>
        </div>
      </div>
    </section>
  );
}
