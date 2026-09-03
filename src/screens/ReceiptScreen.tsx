import type { PaymentRecord, PrintFile, PrintOptions, Quote } from "../lib/pricing";
import { SHOP, computeQuote, inr, inr2 } from "../lib/pricing";
import { IconCheck, IconPrinter, IconQr } from "../components/icons";
import QRCode from "react-qr-code";

interface Props {
  files: PrintFile[];
  options: PrintOptions;
  payment: PaymentRecord;
  onNewOrder: () => void;
}

export default function ReceiptScreen({ files, options, payment, onNewOrder }: Props) {
  const quote: Quote = computeQuote(files, options);

  return (
    <section className="screen-in mx-auto w-full max-w-3xl px-4 pt-8">
      <div className="no-print mb-6 text-center">
        <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-leaf uppercase">Step 05 / Receipt</p>
        <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
          Pakka <span className="text-cyan">ho gaya!</span>
        </h2>
        <p className="mt-2 font-mono text-xs font-semibold tracking-widest text-ink-soft uppercase">
          Print nikal gaya · receipt save ya print kar lo
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-[1fr_auto] md:items-start">
        {/* receipt paper */}
        <div id="print-area" className="relative mx-auto w-full max-w-md border-2 border-ink bg-panel px-6 py-7 font-mono shadow-press-lg">
          <span className="stamp-in absolute top-16 right-5 border-[3px] border-leaf px-3 py-1 font-display text-2xl tracking-[0.2em] text-leaf uppercase" style={{ mixBlendMode: "multiply" }}>
            Paid
          </span>

          {/* header */}
          <div className="text-center">
            <p className="font-display text-3xl tracking-wide">QUICKPRINT XPRESS</p>
            <p className="mt-1 text-[10px] font-semibold tracking-[0.18em] text-ink-soft uppercase">
              {SHOP.address} · GSTIN {SHOP.gstin}
            </p>
            <p className="mt-0.5 text-[10px] font-semibold tracking-[0.18em] text-ink-soft uppercase">Self-service kiosk receipt</p>
          </div>

          <div className="tear-line my-4" />

          {/* meta */}
          <dl className="space-y-1 text-xs font-semibold">
            {[
              ["Order No.", payment.orderId],
              ["Date", payment.paidAt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })],
              ["Time", payment.paidAt.toLocaleTimeString("en-IN", { hour12: true })],
              ["Paid via", payment.method],
              ["UPI Ref", payment.upiRef],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4">
                <dt className="text-ink-soft">{k}</dt>
                <dd className="text-right">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="tear-line my-4" />

          {/* job config */}
          <p className="text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase">Job Configuration</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[
              options.color === "bw" ? "BLACK & WHITE" : "FULL COLOUR",
              options.duplex ? "BOTH SIDES" : "SINGLE SIDE",
              options.size.toUpperCase(),
              `×${options.copies} COPY`,
            ].map((t) => (
              <span key={t} className="border border-ink px-2 py-0.5 text-[10px] font-bold tracking-wider">
                {t}
              </span>
            ))}
          </div>

          <div className="tear-line my-4" />

          {/* items */}
          <p className="text-[10px] font-bold tracking-[0.2em] text-ink-soft uppercase">Items</p>
          <ul className="mt-2 space-y-2.5">
            {quote.lines.map((l) => (
              <li key={l.file.id} className="text-xs font-semibold">
                <p className="flex items-start justify-between gap-3">
                  <span className="min-w-0 flex-1 break-words">{l.file.name}</span>
                  <span className="font-bold whitespace-nowrap">{inr2(l.subtotal)}</span>
                </p>
                <p className="mt-0.5 text-[10px] tracking-wider text-ink-soft uppercase">
                  {l.file.pages} pg → {l.units} {l.unitLabel} × {inr2(l.perUnit)}
                  {l.file.kind === "pdf" ? " · pdf rate" : l.file.kind === "photo" ? " · photo rate" : ""}
                </p>
              </li>
            ))}
          </ul>

          <div className="tear-line my-4" />

          {/* totals */}
          <div className="space-y-1 text-xs font-semibold">
            <div className="flex justify-between">
              <span className="text-ink-soft">Subtotal (1 copy)</span>
              <span>{inr2(quote.perCopy)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-ink-soft">Copies × {options.copies}</span>
              <span>{inr2(quote.total)}</span>
            </div>
            <div className="mt-2 flex items-center justify-between border-2 border-ink bg-yellow px-3 py-2">
              <span className="font-display text-lg tracking-widest uppercase">Total Paid</span>
              <span className="font-display text-2xl tabular-nums">{inr2(quote.total)}</span>
            </div>
            <p className="pt-1 text-[10px] tracking-widest text-ink-soft uppercase">Incl. GST · Sheets: {quote.totalSheets} · Pages: {quote.totalPages}</p>
          </div>

          <div className="tear-line my-4" />

          {/* footer */}
          <div className="flex items-center justify-center gap-4">
            <QRCode value={`upi://pay?pa=${SHOP.vpa}&pn=${encodeURIComponent(SHOP.name)}&cu=INR`} size={64} bgColor="#FBFBF6" fgColor="#15172B" />
            <div className="text-[10px] leading-relaxed font-semibold tracking-wider text-ink-soft uppercase">
              <p>{SHOP.vpa}</p>
              <p>Scan for repeat order</p>
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] font-bold tracking-[0.3em] uppercase">*** Thank you! ***</p>
          <svg viewBox="0 0 200 12" className="mt-3 h-3 w-full text-ink" preserveAspectRatio="none" aria-hidden="true">
            {Array.from({ length: 40 }).map((_, i) => (
              <rect key={i} x={i * 5} y="0" width={i % 3 === 0 ? 3 : i % 4 === 0 ? 1.5 : 2.2} height="12" fill="currentColor" />
            ))}
          </svg>
        </div>

        {/* actions */}
        <div className="no-print flex w-full flex-col gap-3 md:w-56">
          <div className="pop-in flex items-center gap-3 border-2 border-ink bg-leaf px-4 py-3 text-paper shadow-press-sm">
            <IconCheck size={22} />
            <div className="leading-tight">
              <p className="font-display text-lg tracking-wide uppercase">Print Ready</p>
              <p className="font-mono text-[10px] font-semibold tracking-widest uppercase opacity-80">Tray se nikaal lo</p>
            </div>
          </div>

          <button
            onClick={() => window.print()}
            className="btn-press flex items-center justify-center gap-2 border-2 border-ink bg-ink px-5 py-3.5 font-display text-lg tracking-wide text-paper uppercase shadow-press-sm"
          >
            <IconPrinter size={20} className="text-yellow" /> Print Receipt
          </button>

          <button
            onClick={onNewOrder}
            className="btn-press flex items-center justify-center gap-2 border-2 border-ink bg-yellow px-5 py-3.5 font-display text-lg tracking-wide uppercase shadow-press-sm"
          >
            <IconQr size={20} /> Naya Order
          </button>

          <div className="border-2 border-dashed border-ink/40 p-3 font-mono text-[10px] leading-relaxed font-semibold tracking-wider text-ink-soft uppercase">
            Payment: {payment.method}
            <br />
            Ref: {payment.upiRef}
            <br />
            {inr(payment.amount)} · {payment.orderId}
          </div>
        </div>
      </div>
    </section>
  );
}
