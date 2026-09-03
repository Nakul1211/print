import QRCode from "react-qr-code";
import { RATES, SHOP, inr } from "../lib/pricing";
import { usePeerCount, useSyncStatus } from "../lib/sync";
import { IconArrowR, IconDrops, IconDoc, IconFlip, IconMonoDrop, IconPhone, IconQr, IconReg, IconShield } from "../components/icons";

const RATE_ROWS = [
  { icon: IconMonoDrop, label: "Black & White", sub: "per page, one side", price: RATES.bw.single, chip: "bg-ink text-paper" },
  { icon: IconFlip, label: "Black & White", sub: "both sides · 1 sheet", price: RATES.bw.duplex, chip: "bg-ink text-paper" },
  { icon: IconDrops, label: "Colour Print", sub: "per page, one side", price: RATES.color.single, chip: "bg-magenta text-paper" },
  { icon: IconDrops, label: "Colour Print", sub: "both sides · 1 sheet", price: RATES.color.duplex, chip: "bg-magenta text-paper" },
  { icon: IconDoc, label: "PDF Document", sub: "per page (any mode)", price: RATES.pdf.single, chip: "bg-cyan text-ink" },
];

export default function IdleScreen({ onStart }: { onStart: () => void }) {
  const kioskUrl = typeof window !== "undefined" ? window.location.href : "https://jaydwarkadhish.shop";
  const syncStatus = useSyncStatus();
  const peerCount = usePeerCount();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pt-10 pb-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14">
      {/* left — big press-poster type + rate board */}
      <div className="screen-in flex flex-col justify-center">
        <p className="mb-4 inline-flex w-max items-center gap-2 border-2 border-ink bg-yellow px-3 py-1 font-mono text-[11px] font-bold tracking-[0.24em] shadow-press-sm">
          <IconReg size={14} /> 24×7 SELF-SERVICE KIOSK
        </p>

        <h1 className="font-display leading-[0.92] tracking-wide uppercase">
          <span className="block text-6xl sm:text-7xl lg:text-8xl">
            Scan<span className="text-cyan">.</span>
          </span>
          <span className="block text-6xl text-ink-soft/70 sm:text-7xl lg:text-8xl">
            Upload<span className="text-magenta">.</span>
          </span>
          <span className="mt-2 inline-block -rotate-1 border-2 border-ink bg-yellow px-4 py-1 text-6xl shadow-press sm:text-7xl lg:text-8xl">
            Print<span className="text-magenta">.</span>
          </span>
        </h1>

        <p className="mt-6 max-w-md text-base leading-relaxed font-medium text-ink-soft">
          QR scan karo ya seedha shuru karo — PDF / photo upload karo, options choose karo,
          <span className="font-bold text-ink"> UPI se pay karo</span> aur print turant. Har page ka hisaab automatic.
        </p>

        {/* rate board */}
        <div className="card-lift mt-8 border-2 border-ink bg-panel shadow-press">
          <div className="flex items-center justify-between border-b-2 border-ink bg-ink px-4 py-2">
            <span className="font-mono text-[11px] font-bold tracking-[0.3em] text-paper uppercase">Rate Card</span>
            <span className="font-mono text-[11px] font-bold tracking-widest text-yellow">GST INCL.</span>
          </div>
          <ul>
            {RATE_ROWS.map((r, i) => (
              <li
                key={i}
                className={`group flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-yellow/25 ${
                  i < RATE_ROWS.length - 1 ? "border-b border-dashed border-ink/25" : ""
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center border-2 border-ink ${r.chip}`}>
                  <r.icon size={16} />
                </span>
                <span className="flex-1 leading-tight">
                  <span className="block text-sm font-bold">{r.label}</span>
                  <span className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">{r.sub}</span>
                </span>
                <span className="font-display text-2xl transition-transform group-hover:-translate-y-0.5">
                  {inr(r.price)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* live cloud sync strip */}
        <div className="card-lift mt-5 flex items-center gap-4 border-2 border-dashed border-ink bg-panel px-4 py-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-ink ${
              syncStatus === "live" ? "bg-leaf text-paper" : syncStatus === "connecting" ? "bg-yellow text-ink" : "bg-paper text-ink-soft"
            }`}
          >
            <IconShield size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold tracking-[0.24em] text-ink-soft uppercase">
              Admin Panel — kisi bhi laptop/phone par <span className="text-magenta">#/admin</span> kholo
            </p>
            <p className="text-sm leading-snug font-bold">
              Orders & payments wahan <span className="text-leaf">khud live</span> pahunchte hain — koi code nahi
            </p>
          </div>
          <span
            className={`flex items-center gap-1.5 border-2 border-ink px-2 py-1 font-mono text-[9px] font-bold tracking-widest ${
              syncStatus === "live"
                ? "bg-leaf text-paper"
                : syncStatus === "connecting"
                  ? "bg-yellow text-ink"
                  : "bg-paper text-ink-soft"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${syncStatus === "live" ? "led bg-paper" : "bg-ink/40"}`} />
            {syncStatus === "live"
              ? peerCount > 0
                ? `LIVE · ${peerCount + 1} DEVICES`
                : "LIVE"
              : syncStatus === "connecting"
                ? "LINKING"
                : "OFFLINE"}
          </span>
        </div>
      </div>

      {/* right — QR kiosk panel */}
      <div className="screen-in flex items-center" style={{ animationDelay: "0.12s" }}>
        <div className="w-full border-2 border-ink bg-ink p-6 shadow-press-lg sm:p-8">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-bold tracking-[0.3em] text-paper/70 uppercase">Step 01 — Scan QR</p>
            <span className="led h-2.5 w-2.5 rounded-full bg-leaf" />
          </div>

          <div className="relative mt-5 border-2 border-ink bg-panel p-5">
            <span className="pulse-ring absolute -top-2 -right-2 h-4 w-4 rounded-full bg-cyan" />
            <div className="relative">
              <QRCode value={kioskUrl} size={188} bgColor="#FBFBF6" fgColor="#15172B" style={{ margin: "0 auto" }} />
            </div>
            <p className="mt-3 text-center font-mono text-[11px] font-semibold tracking-wider text-ink-soft">
              {kioskUrl.replace(/^https?:\/\//, "").slice(0, 34)}
            </p>
          </div>

          <p className="mt-4 flex items-start gap-2 text-sm leading-snug font-medium text-paper/85">
            <IconPhone size={18} className="mt-0.5 shrink-0 text-yellow" />
            Apne phone ke camera se scan karo — files phone se seedha kiosk tak pahunchengi.
          </p>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-paper/20" />
            <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-paper/50 uppercase">ya yahin se shuru karo</span>
            <span className="h-px flex-1 bg-paper/20" />
          </div>

          <button
            onClick={onStart}
            className="btn-press group flex w-full items-center justify-center gap-3 border-2 border-ink bg-yellow px-6 py-4 font-display text-2xl tracking-wide uppercase shadow-press-sm"
          >
            <IconQr size={22} />
            Start Printing
            <IconArrowR size={22} className="transition-transform group-hover:translate-x-1" />
          </button>

          <div className="mt-5 grid grid-cols-3 gap-2 text-center">
            {["PDF", "JPG / PNG", "UPI PAY"].map((t) => (
              <span key={t} className="border border-paper/25 px-2 py-1.5 font-mono text-[10px] font-bold tracking-[0.18em] text-paper/70">
                {t}
              </span>
            ))}
          </div>

          <p className="mt-4 text-center font-mono text-[10px] tracking-widest text-paper/45 uppercase">
            {SHOP.vpa}
          </p>
        </div>
      </div>
    </section>
  );
}
