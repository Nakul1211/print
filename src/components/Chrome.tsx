import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SHOP } from "../lib/pricing";
import { IconCheck, IconReg, IconShield } from "./icons";

/* ---------------- ambient layered background ---------------- */
export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="halftone-bg absolute inset-0 opacity-60" />
      <div className="blob-cyan animate-drift-a absolute -top-40 -left-40 h-[34rem] w-[34rem] rounded-full" />
      <div className="blob-magenta animate-drift-b absolute top-1/3 -right-48 h-[38rem] w-[38rem] rounded-full" />
      <div className="blob-yellow animate-drift-a absolute -bottom-52 left-1/4 h-[30rem] w-[30rem] rounded-full" />
      <IconReg size={72} className="animate-spin-slow absolute top-24 right-[8%] text-ink/15" />
      <IconReg size={48} className="animate-spin-slow absolute bottom-28 left-[6%] text-ink/15" />
    </div>
  );
}

/* ---------------- header with live clock ---------------- */
function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function Header() {
  const now = useClock();
  return (
    <header className="border-b-2 border-ink bg-panel/85 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 items-center justify-center border-2 border-ink bg-ink shadow-press-sm">
            <span className="font-display text-lg tracking-wide text-yellow">JD</span>
            <span className="absolute -top-1.5 -right-1.5 h-3 w-3 rounded-full border border-ink bg-cyan" />
            <span className="absolute -bottom-1.5 -right-1.5 h-3 w-3 rounded-full border border-ink bg-magenta" />
          </div>
          <div className="leading-tight">
            <p className="font-display text-lg tracking-wide sm:text-xl">
              JAY <span className="text-cyan">DWARKADHISH</span> <span className="text-magenta">SHOP</span>
            </p>
            <p className="font-mono text-[10px] font-semibold tracking-[0.28em] text-ink-soft uppercase">
              Print & Copy Kiosk · No. 01
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 border-2 border-ink bg-panel px-3 py-1.5 shadow-press-sm sm:flex">
            <span className="led h-2.5 w-2.5 rounded-full bg-leaf" />
            <span className="font-mono text-xs font-bold tracking-widest">ONLINE</span>
          </div>
          <div className="hidden border-2 border-ink bg-ink px-3 py-1.5 md:block">
            <span className="font-mono text-xs font-semibold tracking-widest text-paper tabular-nums">
              {now.toLocaleTimeString("en-IN", { hour12: false })}
            </span>
          </div>
          <Link
            to="/admin"
            className="btn-press flex items-center gap-1.5 border-2 border-ink bg-magenta px-2.5 py-1.5 font-mono text-[11px] font-bold tracking-[0.18em] text-paper shadow-press-sm"
            title="Admin Panel"
          >
            <IconShield size={13} /> ADMIN
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ---------------- rate ticker ---------------- */
const TICKER_ITEMS = [
  "B&W ₹5 / PAGE",
  "B&W BOTH SIDES ₹10",
  "COLOUR ₹10 / PAGE",
  "COLOUR BOTH SIDES ₹20",
  "PDF ₹5 / PAGE",
  "A4 & LEGAL SIZES",
  "JAY DWARKADHISH SHOP",
  "UPI · GPAY · PAYTM · PHONEPE",
  "INSTANT RECEIPT",
];

export function Ticker() {
  const row = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div className="ticker-mask overflow-hidden border-b-2 border-ink bg-ink py-2">
      <div className="animate-ticker flex w-max items-center gap-6">
        {row.map((item, i) => (
          <span key={i} className="flex items-center gap-6 font-mono text-[11px] font-semibold tracking-[0.22em] whitespace-nowrap">
            <span className={i % 3 === 0 ? "text-cyan" : i % 3 === 1 ? "text-magenta" : "text-yellow"}>{item}</span>
            <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
              <rect x="1.6" y="1.6" width="6.8" height="6.8" transform="rotate(45 5 5)" fill="#F1F1EA" opacity="0.7" />
            </svg>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- wizard stepper ---------------- */
const STEPS = ["FILES", "OPTIONS", "PAY", "PRINT", "RECEIPT"] as const;
const STEP_COLORS = ["bg-cyan", "bg-magenta", "bg-yellow", "bg-ink", "bg-leaf"];

export function Stepper({ current }: { current: number }) {
  return (
    <nav aria-label="Order progress" className="mx-auto w-full max-w-6xl px-4 pt-6">
      <ol className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={label} className={`flex items-center ${i < STEPS.length - 1 ? "flex-1" : ""}`}>
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-8 w-8 items-center justify-center border-2 border-ink font-mono text-xs font-bold transition-all duration-300 ${
                    done
                      ? "bg-ink text-paper"
                      : active
                        ? `${STEP_COLORS[i]} text-ink shadow-press-sm`
                        : "bg-panel text-ink/40"
                  }`}
                >
                  {done ? <IconCheck size={14} /> : i + 1}
                </span>
                <span
                  className={`hidden font-mono text-[10px] font-bold tracking-[0.18em] sm:block ${
                    active ? "text-ink" : "text-ink/40"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <span
                  className={`mx-2 h-0.5 flex-1 border-t-2 transition-colors duration-500 sm:mx-3 ${
                    done ? "border-ink" : "border-dashed border-ink/25"
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-14 border-t-2 border-ink bg-ink py-4">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4">
        <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">
          {SHOP.name} · {SHOP.address}
        </p>
        <p className="font-mono text-[10px] tracking-[0.2em] text-paper/60 uppercase">
          UPI: {SHOP.vpa}
        </p>
        <Link
          to="/admin"
          className="font-mono text-[10px] tracking-[0.2em] text-yellow/80 uppercase underline decoration-dashed underline-offset-4 transition-colors hover:text-yellow"
        >
          Admin Panel →
        </Link>
      </div>
    </footer>
  );
}
