import type { PrintFile, PrintOptions, Quote } from "../lib/pricing";
import { computeQuote, inr } from "../lib/pricing";
import { IconArrowL, IconDoc, IconDrops, IconFlip, IconPhoto, IconRupee, IconSheet } from "../components/icons";

interface Props {
  files: PrintFile[];
  options: PrintOptions;
  onNext: () => void;
  onBack: () => void;
}

export default function ReviewScreen({ files, options, onNext, onBack }: Props) {
  const quote: Quote = computeQuote(files, options);

  return (
    <section className="screen-in mx-auto w-full max-w-4xl px-4 pt-8">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-leaf uppercase">Step 03 / Bill</p>
        <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          Hisaab <span className="text-magenta">dekho</span>
        </h2>
      </div>

      <div className="border-2 border-ink bg-panel shadow-press">
        {/* job summary strip */}
        <div className="flex flex-wrap items-center gap-2 border-b-2 border-ink bg-ink px-4 py-3">
          <span className="flex items-center gap-1.5 border border-paper/30 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-paper uppercase">
            {options.color === "bw" ? <IconMonoOnly /> : <IconDrops size={13} className="text-magenta" />}
            {options.color === "bw" ? "Black & White" : "Full Colour"}
          </span>
          <span className="flex items-center gap-1.5 border border-paper/30 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-paper uppercase">
            <IconFlip size={13} className="text-cyan" />
            {options.duplex ? "Both sides" : "Single side"}
          </span>
          <span className="flex items-center gap-1.5 border border-paper/30 px-2.5 py-1 font-mono text-[10px] font-bold tracking-widest text-paper uppercase">
            <IconSheet size={13} className="text-yellow" /> {options.size}
          </span>
          <span className="ml-auto font-mono text-[10px] font-bold tracking-widest text-paper/60 uppercase">
            {quote.totalPages} pages · {quote.totalSheets} sheets
          </span>
        </div>

        {/* line items */}
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-dashed border-ink/30 px-4 py-2 font-mono text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase sm:grid">
          <span>File</span>
          <span className="w-16 text-right">Pages</span>
          <span className="w-24 text-right">Sheets/Pgs</span>
          <span className="w-20 text-right">Rate</span>
          <span className="w-20 text-right">Amount</span>
        </div>

        <ul>
          {quote.lines.map((l, i) => (
            <li
              key={l.file.id}
              className={`grid grid-cols-2 items-center gap-x-4 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_auto_auto_auto_auto] ${
                i < quote.lines.length - 1 ? "border-b border-dashed border-ink/30" : ""
              }`}
            >
              <span className="col-span-2 flex min-w-0 items-center gap-3 sm:col-span-1">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink ${l.file.kind === "pdf" ? "bg-magenta text-paper" : "bg-cyan text-ink"}`}>
                  {l.file.kind === "pdf" ? <IconDoc size={17} /> : <IconPhoto size={17} />}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{l.file.name}</span>
                  <span className="font-mono text-[10px] tracking-wider text-ink-soft uppercase">
                    {l.file.kind === "pdf" ? "PDF @ ₹5/page" : options.color === "bw" ? "Photo · B&W" : "Photo · Colour"}
                  </span>
                </span>
              </span>
              <span className="text-right font-mono text-sm font-semibold tabular-nums sm:w-16">{l.file.pages}</span>
              <span className="text-right font-mono text-sm font-semibold tabular-nums sm:w-24">
                {l.units} {options.duplex ? "sht" : "pg"}
              </span>
              <span className="text-right font-mono text-sm font-semibold tabular-nums sm:w-20">{inr(l.perUnit)}</span>
              <span className="text-right font-mono text-sm font-bold tabular-nums sm:w-20">{inr(l.subtotal)}</span>
            </li>
          ))}
        </ul>

        {/* totals */}
        <div className="space-y-1.5 border-t-2 border-ink px-4 py-4">
          <div className="flex justify-between font-mono text-sm font-semibold">
            <span className="text-ink-soft">Subtotal (1 copy)</span>
            <span className="tabular-nums">{inr(quote.perCopy)}</span>
          </div>
          <div className="flex justify-between font-mono text-sm font-semibold">
            <span className="text-ink-soft">Copies × {options.copies}</span>
            <span className="tabular-nums">{inr(quote.total)}</span>
          </div>
          <div className="tear-line my-2" />
          <div className="flex items-center justify-between">
            <span className="font-display text-2xl tracking-wide uppercase">Payable</span>
            <span className="font-display text-5xl text-magenta tabular-nums">{inr(quote.total)}</span>
          </div>
          <p className="pt-1 text-right font-mono text-[10px] font-semibold tracking-widest text-ink-soft uppercase">
            GST included · UPI only
          </p>
        </div>
      </div>

      <div className="mt-8 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
        <button
          onClick={onBack}
          className="btn-press flex items-center justify-center gap-2 border-2 border-ink bg-panel px-5 py-3 font-mono text-sm font-bold tracking-widest uppercase shadow-press-sm"
        >
          <IconArrowL size={18} /> Options
        </button>
        <button
          onClick={onNext}
          className="btn-press group flex items-center justify-center gap-3 border-2 border-ink bg-magenta px-10 py-4 font-display text-2xl tracking-wide text-paper uppercase shadow-press"
        >
          <IconRupee size={22} className="text-yellow" />
          Pay {inr(quote.total)}
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </button>
      </div>
    </section>
  );
}

function IconMonoOnly() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3.5S6.5 10 6.5 14a5.5 5.5 0 0 0 11 0c0-4-5.5-10.5-5.5-10.5z" />
    </svg>
  );
}
