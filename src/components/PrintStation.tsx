import { useEffect, useMemo, useState } from "react";
import type { OrderRecord } from "../lib/store";
import { getFile } from "../lib/filestore";
import { renderPdfPages } from "../lib/pdf";
import { inr } from "../lib/pricing";
import { requestFile } from "../lib/sync";
import { IconCheck, IconPrinter } from "./icons";

/** Image dataURL ke dimensions */
function imgDims(src: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => reject(new Error("image load failed"));
    img.src = src;
  });
}

/* Paper sizes @ ~150 DPI (white canvas, image drawn contain-fit) */
const PAPER = {
  A4: { w: 1240, h: 1754, css: "A4" },
  Legal: { w: 1275, h: 2100, css: "8.5in 14in" },
} as const;

type Phase = "loading" | "ready" | "printed";

interface Props {
  order: OrderRecord;
  onClose: () => void;
  onDone: () => void;
}

async function photoToPage(blob: Blob, pw: number, ph: number): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("image load failed"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = pw;
    canvas.height = ph;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas nahi bana");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, pw, ph);
    const margin = 52;
    const aw = pw - margin * 2;
    const ah = ph - margin * 2;
    const s = Math.min(aw / img.naturalWidth, ah / img.naturalHeight);
    const dw = img.naturalWidth * s;
    const dh = img.naturalHeight * s;
    ctx.drawImage(img, (pw - dw) / 2, (ph - dh) / 2, dw, dh);
    return canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function PrintStation({ order, onClose, onDone }: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [pages, setPages] = useState<string[]>([]);
  const [progress, setProgress] = useState("Files load ho rahi hain…");
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);
  const [dling, setDling] = useState(false);

  const size = order.options?.size === "Legal" ? "Legal" : "A4";
  const paper = PAPER[size];
  const copies = Math.max(1, order.options?.copies ?? 1);

  /* ---------- render sab pages print-ready ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: string[] = [];
      try {
        for (const f of order.files) {
          if (cancelled) return;
          setProgress(`${f.name} load ho rahi hai…`);
          let blob = await getFile(f.id);
          if (!blob) {
            /* file isi device par nahi — kiosk se relay ke zariye mangwao */
            setProgress(`${f.name} — kiosk device se mangwayi ja rahi hai…`);
            blob =
              (await requestFile(
                f.id,
                f.name,
                f.kind === "pdf" ? "application/pdf" : "image/jpeg"
              )) ?? undefined;
          }
          if (!blob)
            throw new Error(
              `"${f.name}" nahi mili. Kiosk device online hona chahiye (file wahin upload hui thi) — ya customer se dobara upload karwao.`
            );
          if (f.kind === "pdf") {
            const rendered = await renderPdfPages(blob, paper.w, (done, total) => {
              if (!cancelled) setProgress(`${f.name} — page ${done}/${total} render ho raha hai…`);
            });
            out.push(...rendered);
          } else {
            out.push(await photoToPage(blob, paper.w, paper.h));
          }
          if (!cancelled) setProgress(`${out.length} pages ready`);
        }
        if (!cancelled) {
          setPages(out);
          setPhase("ready");
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Kuch toot gaya");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  /* copies ke saath final print pages (memory cap 150) */
  const printPages = useMemo(() => {
    const all: string[] = [];
    for (let c = 0; c < copies && all.length < 150; c++) {
      for (const p of pages) {
        all.push(p);
        if (all.length >= 150) break;
      }
    }
    return all;
  }, [pages, copies]);

  /* ---------- PDF download (mobile: share/print via Android) ---------- */
  const downloadPdf = async () => {
    if (dling || printPages.length === 0) return;
    setDling(true);
    try {
      const { jsPDF } = await import("jspdf");
      const fmt: [number, number] = size === "Legal" ? [216, 356] : [210, 297];
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: fmt, compress: true });
      const [pw, ph] = fmt;
      let first = true;
      for (const src of printPages) {
        if (!first) doc.addPage(fmt, "portrait");
        first = false;
        const d = await imgDims(src);
        const s = Math.min(pw / d.w, ph / d.h);
        const w = d.w * s;
        const h = d.h * s;
        doc.addImage(src, "JPEG", (pw - w) / 2, (ph - h) / 2, w, h, undefined, "FAST");
      }
      doc.save(`${order.id}-jay-dwarkadhish.pdf`);
    } catch {
      /* download fail — ignore */
    } finally {
      setDling(false);
    }
  };

  /* ---------- print trigger + afterprint ---------- */
  useEffect(() => {
    if (!printing) return;
    const t = window.setTimeout(() => window.print(), 150);
    const after = () => {
      setPrinting(false);
      setPhase("printed");
    };
    window.addEventListener("afterprint", after);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("afterprint", after);
    };
  }, [printing]);

  const totalSheets = pages.length * copies;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/92 p-3 sm:p-6">
      {/* dynamic page-size rules for the browser print dialog */}
      <style>{`
        @page { size: ${paper.css}; margin: 0; }
        @media print {
          #print-area { position: static !important; }
          #print-area img { display: block !important; width: 100% !important; height: auto !important; page-break-after: always; break-after: page; }
        }
      `}</style>

      {/* hidden sheet that the print dialog actually prints */}
      <div id="print-area" className="hidden print:block">
        {printing && printPages.map((p, i) => <img key={i} src={p} alt="" />)}
      </div>

      <div className="pop-in relative w-full max-w-4xl border-2 border-paper/30 bg-panel shadow-[10px_10px_0_0_rgba(241,241,234,0.18)]">
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-ink px-5 py-3">
          <div className="flex items-center gap-3">
            <IconPrinter size={22} className="text-yellow" />
            <div className="leading-tight">
              <p className="font-display text-xl tracking-wide text-paper uppercase">
                Print Station — <span className="text-yellow">{order.id}</span>
              </p>
              <p className="font-mono text-[10px] tracking-[0.25em] text-paper/55 uppercase">
                {size} · {order.options?.color === "color" ? "Colour" : "B&W"} ·{" "}
                {order.options?.duplex ? "Both sides" : "One side"} · ×{copies}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-press border-2 border-paper/40 px-3 py-1 font-mono text-xs font-bold tracking-widest text-paper uppercase hover:bg-magenta"
          >
            ✕ Band
          </button>
        </div>

        <div className="stripes-live h-2.5" />

        {/* body */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          {error ? (
            <div className="border-2 border-magenta bg-magenta/10 p-5">
              <p className="font-display text-2xl tracking-wide text-magenta uppercase">File nahi mili</p>
              <p className="mt-2 text-sm leading-relaxed font-medium text-ink-soft">{error}</p>
              <button
                onClick={onClose}
                className="btn-press mt-4 border-2 border-ink bg-ink px-5 py-2 font-mono text-xs font-bold tracking-widest text-paper uppercase shadow-press-sm"
              >
                ← Wapas
              </button>
            </div>
          ) : phase === "loading" ? (
            <div className="py-14 text-center">
              <div className="relative mx-auto h-24 w-40 overflow-hidden border-2 border-ink bg-paper shadow-press-sm">
                <div className="paper-feed absolute inset-x-4 top-0 h-20 border-2 border-ink/30 bg-panel">
                  <div className="mx-3 mt-3 h-1.5 w-3/4 bg-ink/25" />
                  <div className="mx-3 mt-2 h-1.5 w-1/2 bg-ink/25" />
                  <div className="mx-3 mt-2 h-1.5 w-2/3 bg-ink/25" />
                </div>
                <div className="absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 bg-ink" />
              </div>
              <p className="mt-5 font-mono text-xs font-bold tracking-[0.2em] text-ink-soft uppercase">{progress}</p>
              <p className="mt-1 font-mono text-[10px] tracking-wider text-ink/50 uppercase">
                PDF pages print-ready ban rahe hain…
              </p>
            </div>
          ) : (
            <>
              {/* preview grid */}
              <p className="mb-2 flex items-center justify-between font-mono text-[10px] font-bold tracking-[0.25em] text-ink-soft uppercase">
                <span>Page Preview ({pages.length} page{pages.length > 1 ? "s" : ""})</span>
                <span>{totalSheets} sheet{totalSheets > 1 ? "s" : ""} print hongi</span>
              </p>
              <div className="grid max-h-64 grid-cols-3 gap-2 overflow-y-auto border-2 border-dashed border-ink/35 bg-paper/70 p-2 sm:grid-cols-5">
                {pages.map((p, i) => (
                  <figure key={i} className="group relative border border-ink bg-panel shadow-press-sm transition-transform hover:-translate-y-0.5">
                    <img src={p} alt={`Page ${i + 1}`} className="w-full" />
                    <figcaption className="absolute right-0 bottom-0 bg-ink px-1.5 py-0.5 font-mono text-[9px] font-bold text-paper">
                      {i + 1}
                    </figcaption>
                  </figure>
                ))}
              </div>

              {/* job ticket */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 border-2 border-ink bg-paper px-4 py-2 font-mono text-[11px] font-semibold tracking-wider">
                <span>{order.files.length} FILE{order.files.length > 1 ? "S" : ""}</span>
                <span>{order.totalPages} PAGES</span>
                <span className="text-leaf">
                  {order.payment ? `${inr(order.payment.amount)} · ${order.payment.method}` : "PAYMENT PENDING"}
                </span>
                {order.payment && <span className="text-ink-soft">REF {order.payment.upiRef}</span>}
              </div>

              {/* actions */}
              {phase === "ready" ? (
                <div className="mt-4">
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() => setPrinting(true)}
                      className="btn-press group flex flex-1 items-center justify-center gap-3 border-2 border-ink bg-yellow px-6 py-4 font-display text-2xl tracking-wide uppercase shadow-press-sm"
                    >
                      <IconPrinter size={24} className="transition-transform group-hover:-translate-y-0.5" />
                      {printing ? "Print dialog khul raha hai…" : `Print Karo (${totalSheets} sheet)`}
                    </button>
                    <button
                      onClick={() => void downloadPdf()}
                      disabled={dling}
                      className="btn-press flex items-center justify-center gap-2 border-2 border-ink bg-cyan px-5 py-3 font-display text-lg tracking-wide text-ink uppercase shadow-press-sm"
                    >
                      {dling ? "PDF ban rahi hai…" : "⤓ PDF Download"}
                    </button>
                    <button
                      onClick={onClose}
                      className="btn-press border-2 border-ink bg-panel px-5 py-3 font-mono text-xs font-bold tracking-widest uppercase shadow-press-sm"
                    >
                      Baad mein
                    </button>
                  </div>
                  <p className="mt-2.5 border-2 border-dashed border-ink/35 bg-paper/70 px-3 py-2 font-mono text-[10px] leading-relaxed tracking-wider text-ink-soft uppercase">
                    Mobile/Android: PRINT dabate hi system print sheet khulegi — printer chuno ya "Save as PDF" karo.
                    Ya PDF download karke share/print karo.
                  </p>
                </div>
              ) : (
                <div className="pop-in mt-4 border-2 border-ink bg-leaf p-4 text-paper shadow-press-sm">
                  <p className="flex items-center gap-2 font-display text-2xl tracking-wide uppercase">
                    <IconCheck size={22} /> Print command bhej di!
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wider text-paper/85 uppercase">
                    Printer se sheets nikal gayi hain? Neeche dabao — order DONE mark ho jayega.
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <button
                      onClick={onDone}
                      className="btn-press flex flex-1 items-center justify-center gap-2 border-2 border-ink bg-ink px-5 py-3 font-display text-xl tracking-wide text-paper uppercase shadow-[3px_3px_0_0_rgba(241,241,234,0.5)]"
                    >
                      <IconCheck size={20} /> Print Ho Gaya — Order Done
                    </button>
                    <button
                      onClick={() => setPhase("ready")}
                      className="btn-press border-2 border-ink bg-paper px-4 py-3 font-mono text-[11px] font-bold tracking-widest text-ink uppercase shadow-[3px_3px_0_0_rgba(21,23,43,0.4)]"
                    >
                      ↺ Phir se print
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
