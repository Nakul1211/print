import type { PrintFile, PrintOptions, Quote } from "../lib/pricing";
import { RATES, computeQuote, inr } from "../lib/pricing";
import {
  IconArrowL,
  IconArrowR,
  IconCopy,
  IconDrops,
  IconFlip,
  IconMinus,
  IconMonoDrop,
  IconPlus,
  IconSheet,
} from "../components/icons";

interface Props {
  files: PrintFile[];
  options: PrintOptions;
  onChange: (o: PrintOptions) => void;
  onNext: () => void;
  onBack: () => void;
}

function OptionCard({
  active,
  onClick,
  badgeClass,
  icon,
  title,
  sub,
  price,
}: {
  active: boolean;
  onClick: () => void;
  badgeClass: string;
  icon: React.ReactNode;
  title: string;
  sub: string;
  price: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`btn-press relative border-2 border-ink p-4 text-left shadow-press-sm ${
        active ? "bg-ink text-paper" : "bg-panel hover:bg-yellow/20"
      }`}
    >
      {active && (
        <span className="pop-in absolute -top-2.5 -right-2.5 flex h-6 w-6 items-center justify-center border-2 border-ink bg-leaf text-paper">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="m4.5 12.5 5 5 10-11" />
          </svg>
        </span>
      )}
      <span className={`mb-3 flex h-10 w-10 items-center justify-center border-2 ${active ? "border-paper/60" : "border-ink"} ${badgeClass}`}>
        {icon}
      </span>
      <span className="block font-display text-xl tracking-wide uppercase">{title}</span>
      <span className={`mt-0.5 block font-mono text-[10px] font-semibold tracking-[0.16em] uppercase ${active ? "text-paper/65" : "text-ink-soft"}`}>
        {sub}
      </span>
      <span className={`mt-2 inline-block border px-2 py-0.5 font-mono text-sm font-bold ${active ? "border-paper/50 text-yellow" : "border-ink bg-yellow"}`}>
        {price}
      </span>
    </button>
  );
}

export default function OptionsScreen({ files, options, onChange, onNext, onBack }: Props) {
  const quote: Quote = computeQuote(files, options);
  const set = (patch: Partial<PrintOptions>) => onChange({ ...options, ...patch });
  const hasPdf = files.some((f) => f.kind === "pdf");

  return (
    <section className="screen-in mx-auto w-full max-w-4xl px-4 pt-8">
      <div className="mb-6">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-magenta uppercase">Step 02 / Options</p>
        <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          Print kaise <span className="text-cyan">chahiye?</span>
        </h2>
      </div>

      {/* colour mode */}
      <fieldset className="mb-6">
        <legend className="mb-2 font-mono text-[11px] font-bold tracking-[0.24em] uppercase">Ink Mode</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            active={options.color === "bw"}
            onClick={() => set({ color: "bw" })}
            badgeClass={options.color === "bw" ? "bg-paper text-ink" : "bg-ink text-paper"}
            icon={<IconMonoDrop size={20} />}
            title="Black & White"
            sub="Sirf black ink · sharp text"
            price={`₹${RATES.bw.single} / page`}
          />
          <OptionCard
            active={options.color === "color"}
            onClick={() => set({ color: "color" })}
            badgeClass={options.color === "color" ? "bg-yellow text-ink" : "bg-magenta text-paper"}
            icon={<IconDrops size={20} />}
            title="Full Colour"
            sub="CMYK · photos ke liye best"
            price={`₹${RATES.color.single} / page`}
          />
        </div>
        {hasPdf && (
          <p className="mt-2 font-mono text-[11px] font-semibold tracking-wider text-ink-soft">
            ⓘ PDF pages flat ₹{RATES.pdf.single}/page rate par calculate hongi{options.duplex ? ` (both sides ₹${RATES.pdf.duplex}/sheet)` : ""}.
          </p>
        )}
      </fieldset>

      {/* sides */}
      <fieldset className="mb-6">
        <legend className="mb-2 font-mono text-[11px] font-bold tracking-[0.24em] uppercase">Printing Side</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <OptionCard
            active={!options.duplex}
            onClick={() => set({ duplex: false })}
            badgeClass={options.duplex ? "bg-ink text-paper" : "bg-cyan text-ink"}
            icon={<IconSheet size={20} />}
            title="Single Side"
            sub="Har page alag sheet par"
            price={options.color === "bw" ? `₹${RATES.bw.single} / page` : `₹${RATES.color.single} / page`}
          />
          <OptionCard
            active={options.duplex}
            onClick={() => set({ duplex: true })}
            badgeClass={options.duplex ? "bg-yellow text-ink" : "bg-ink text-paper"}
            icon={<IconFlip size={20} />}
            title="Both Sides"
            sub="Aage–peeche · paper bachao"
            price={options.color === "bw" ? `₹${RATES.bw.duplex} / sheet` : `₹${RATES.color.duplex} / sheet`}
          />
        </div>
      </fieldset>

      {/* paper size + copies */}
      <div className="grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 font-mono text-[11px] font-bold tracking-[0.24em] uppercase">Paper Size</legend>
          <div className="flex gap-3">
            {(
              [
                { v: "A4", dims: "210 × 297 mm" },
                { v: "Legal", dims: "216 × 356 mm" },
              ] as const
            ).map((s) => (
              <button
                key={s.v}
                onClick={() => set({ size: s.v })}
                aria-pressed={options.size === s.v}
                className={`btn-press flex-1 border-2 border-ink px-4 py-3 text-center shadow-press-sm ${
                  options.size === s.v ? "bg-cyan" : "bg-panel hover:bg-yellow/20"
                }`}
              >
                <span className="block font-display text-2xl tracking-wide uppercase">{s.v}</span>
                <span className="font-mono text-[10px] font-semibold tracking-widest uppercase opacity-70">{s.dims}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-[11px] font-semibold tracking-wider text-ink-soft">Dono sizes same rate par.</p>
        </fieldset>

        <fieldset>
          <legend className="mb-2 font-mono text-[11px] font-bold tracking-[0.24em] uppercase">Copies</legend>
          <div className="flex items-stretch border-2 border-ink bg-panel shadow-press-sm">
            <button
              onClick={() => set({ copies: Math.max(1, options.copies - 1) })}
              disabled={options.copies <= 1}
              aria-label="Copies kam karo"
              className="btn-press flex w-14 items-center justify-center border-r-2 border-ink bg-yellow disabled:opacity-40"
            >
              <IconMinus size={18} />
            </button>
            <span className="flex flex-1 items-center justify-center gap-2 font-display text-3xl tabular-nums">
              <IconCopy size={20} className="text-ink-soft" /> {options.copies}
            </span>
            <button
              onClick={() => set({ copies: Math.min(99, options.copies + 1) })}
              aria-label="Copies badhao"
              className="btn-press flex w-14 items-center justify-center border-l-2 border-ink bg-yellow"
            >
              <IconPlus size={18} />
            </button>
          </div>
          <p className="mt-2 font-mono text-[11px] font-semibold tracking-wider text-ink-soft">Max 99 copies per order.</p>
        </fieldset>
      </div>

      {/* live price bar */}
      <div className="pop-in mt-8 flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-ink px-5 py-4 shadow-press" key={`${options.color}${options.duplex}${options.size}${options.copies}`}>
        <div className="font-mono text-[11px] leading-relaxed font-semibold tracking-wider text-paper/75 uppercase">
          {quote.totalPages} pages → {quote.totalSheets} sheets × {options.copies} cop{options.copies === 1 ? "y" : "ies"} · {options.size}
        </div>
        <div className="flex items-center gap-4">
          <span className="font-mono text-[11px] font-bold tracking-[0.2em] text-paper/60 uppercase">Total</span>
          <span className="font-display text-4xl text-yellow tabular-nums">{inr(quote.total)}</span>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="btn-press flex items-center gap-2 border-2 border-ink bg-panel px-5 py-3 font-mono text-sm font-bold tracking-widest uppercase shadow-press-sm"
        >
          <IconArrowL size={18} /> Files
        </button>
        <button
          onClick={onNext}
          className="btn-press flex items-center gap-3 border-2 border-ink bg-yellow px-8 py-3 font-display text-xl tracking-wide uppercase shadow-press"
        >
          Review Bill <IconArrowR size={20} />
        </button>
      </div>
    </section>
  );
}
