import { useCallback, useRef, useState } from "react";
import type { PrintFile } from "../lib/pricing";
import { formatSize } from "../lib/pricing";
import { getPdfPageCount } from "../lib/pdf";
import { IconArrowL, IconArrowR, IconDoc, IconPhoto, IconTrash, IconUpload } from "../components/icons";

interface Props {
  files: PrintFile[];
  onAdd: (files: PrintFile[]) => void;
  onRemove: (id: string) => void;
  onNext: () => void;
  onBack: () => void;
}

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp)$/i;

/** Downscale image to a tiny JPEG thumbnail (shown in admin order feed). */
async function makeThumb(file: File): Promise<string | undefined> {
  try {
    if (!file.type.startsWith("image/") || file.size > 6 * 1024 * 1024) return undefined;
    const url = URL.createObjectURL(file);
    const img = new Image();
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error("image load failed"));
      img.src = url;
    });
    const scale = Math.min(1, 220 / img.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    return undefined;
  }
}

export default function UploadScreen({ files, onAdd, onRemove, onNext, onBack }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [busyName, setBusyName] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      setError("");
      setBusy(true);
      const added: PrintFile[] = [];
      const rejected: string[] = [];

      for (const file of Array.from(list)) {
        const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
        const isImg = file.type.startsWith("image/") || IMAGE_EXT.test(file.name);
        if (!isPdf && !isImg) {
          rejected.push(file.name);
          continue;
        }
        const id = `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        if (isPdf) {
          try {
            setBusyName(file.name);
            const pages = await getPdfPageCount(file);
            added.push({ id, name: file.name, kind: "pdf", pages, sizeLabel: formatSize(file.size) });
          } catch {
            rejected.push(`${file.name} (PDF read nahi ho payi)`);
          }
        } else {
          const thumb = await makeThumb(file);
          added.push({ id, name: file.name, kind: "photo", pages: 1, sizeLabel: formatSize(file.size), thumb });
        }
      }

      if (rejected.length) setError(`Skip ki gayi: ${rejected.join(", ")}`);
      if (added.length) onAdd(added);
      setBusy(false);
      setBusyName("");
    },
    [onAdd]
  );

  const totalPages = files.reduce((s, f) => s + f.pages, 0);

  return (
    <section className="screen-in mx-auto w-full max-w-4xl px-4 pt-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[11px] font-bold tracking-[0.28em] text-cyan uppercase">Step 01 / Files</p>
          <h2 className="font-display text-4xl tracking-wide uppercase sm:text-5xl">
            Apni files <span className="text-magenta">daalo</span>
          </h2>
        </div>
        <p className="border-2 border-ink bg-panel px-3 py-1.5 font-mono text-xs font-bold shadow-press-sm">
          {files.length} file{files.length === 1 ? "" : "s"} · {totalPages} page{totalPages === 1 ? "" : "s"}
        </p>
      </div>

      {/* drop zone */}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        className={`btn-press block w-full border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragOver ? "border-ink bg-cyan/25 shadow-press" : "border-ink/50 bg-panel shadow-press-sm hover:bg-yellow/20"
        }`}
      >
        {busy ? (
          <span className="flex flex-col items-center gap-3">
            <span className="flex gap-1.5">
              <span className="h-3 w-3 animate-bounce bg-cyan" style={{ animationDelay: "0ms" }} />
              <span className="h-3 w-3 animate-bounce bg-magenta" style={{ animationDelay: "120ms" }} />
              <span className="h-3 w-3 animate-bounce bg-yellow" style={{ animationDelay: "240ms" }} />
            </span>
            <span className="font-mono text-sm font-semibold tracking-wider">
              PDF padhi ja rahi hai — {busyName.slice(0, 32)}
            </span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center border-2 border-ink bg-yellow shadow-press-sm">
              <IconUpload size={26} />
            </span>
            <span className="font-display text-2xl tracking-wide uppercase">
              Yahan drop karo <span className="text-cyan">ya click karo</span>
            </span>
            <span className="font-mono text-[11px] font-semibold tracking-[0.2em] text-ink-soft uppercase">
              PDF · JPG · PNG · WEBP — ek saath kai files
            </span>
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="application/pdf,image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && (
        <p className="pop-in mt-3 border-2 border-ink bg-magenta/15 px-3 py-2 font-mono text-xs font-semibold text-ink">
          ⚠ {error}
        </p>
      )}

      {/* file list */}
      {files.length > 0 && (
        <ul className="mt-6 space-y-3">
          {files.map((f, i) => (
            <li
              key={f.id}
              className="pop-in card-lift flex items-center gap-4 border-2 border-ink bg-panel px-4 py-3 shadow-press-sm"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center border-2 border-ink ${
                  f.kind === "pdf" ? "bg-magenta text-paper" : "bg-cyan text-ink"
                }`}
              >
                {f.kind === "pdf" ? <IconDoc size={20} /> : <IconPhoto size={20} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{f.name}</span>
                <span className="font-mono text-[10px] font-semibold tracking-widest text-ink-soft uppercase">
                  {f.kind === "pdf" ? "PDF document" : "Photo"} · {f.sizeLabel}
                </span>
              </span>
              <span className="shrink-0 border-2 border-ink bg-yellow px-2.5 py-1 font-mono text-xs font-bold whitespace-nowrap">
                {f.pages} page{f.pages === 1 ? "" : "s"}
              </span>
              <button
                onClick={() => onRemove(f.id)}
                aria-label={`Remove ${f.name}`}
                className="btn-press flex h-9 w-9 shrink-0 items-center justify-center border-2 border-ink bg-panel shadow-press-sm hover:bg-magenta hover:text-paper"
              >
                <IconTrash size={16} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* hint + nav */}
      <div className="mt-6 grid gap-3 border-2 border-ink bg-ink px-4 py-3 sm:grid-cols-2">
        <p className="font-mono text-[11px] leading-relaxed font-semibold tracking-wider text-paper/80">
          <span className="text-cyan">PDF →</span> har page ₹5 (both sides ₹10/sheet)
        </p>
        <p className="font-mono text-[11px] leading-relaxed font-semibold tracking-wider text-paper/80">
          <span className="text-magenta">PHOTO →</span> B&W ₹2 / Colour ₹10 per page
        </p>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="btn-press flex items-center gap-2 border-2 border-ink bg-panel px-5 py-3 font-mono text-sm font-bold tracking-widest uppercase shadow-press-sm"
        >
          <IconArrowL size={18} /> Back
        </button>
        <button
          onClick={onNext}
          disabled={files.length === 0 || busy}
          className="btn-press flex items-center gap-3 border-2 border-ink bg-yellow px-8 py-3 font-display text-xl tracking-wide uppercase shadow-press"
        >
          Choose Options <IconArrowR size={20} />
        </button>
      </div>
    </section>
  );
}
