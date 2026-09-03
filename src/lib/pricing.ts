export type ColorMode = "bw" | "color";
export type PaperSize = "A4" | "Legal";

export interface PrintFile {
  id: string;
  name: string;
  kind: "pdf" | "photo";
  pages: number;
  sizeLabel: string;
  /** small preview thumbnail dataURL (photos only) — shown in admin panel */
  thumb?: string;
}

export interface PrintOptions {
  color: ColorMode;
  duplex: boolean;
  size: PaperSize;
  copies: number;
}

export interface PaymentRecord {
  orderId: string;
  amount: number;
  method: string;
  upiRef: string;
  paidAt: Date;
}

/** Rate card — prices fixed by the shop */
export const RATES = {
  bw: { single: 5, duplex: 10 },
  color: { single: 10, duplex: 20 },
  pdf: { single: 5, duplex: 10 },
} as const;

export const SHOP = {
  name: "Jay Dwarkadhish Shop",
  vpa: "jaydwarkadwhishshop.36698672@hdfcbank",
  address: "Jay Dwarkadhish Shop · Print & Copy",
  gstin: "07ABCDE1234F1Z5",
};

export const inr = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 0 });

export const inr2 = (n: number) =>
  "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export interface FileLine {
  file: PrintFile;
  units: number;
  unitLabel: string;
  perUnit: number;
  subtotal: number;
}

export interface Quote {
  lines: FileLine[];
  perCopy: number;
  total: number;
  totalPages: number;
  totalSheets: number;
}

/** Per-file pricing: PDF pages @ ₹5/page, photos @ colour-mode rate. Duplex = both sides on one sheet. */
export function fileQuote(file: PrintFile, opts: PrintOptions): FileLine {
  const rate = file.kind === "pdf" ? RATES.pdf : RATES[opts.color];
  const perUnit = opts.duplex ? rate.duplex : rate.single;
  const units = opts.duplex ? Math.ceil(file.pages / 2) : file.pages;
  return {
    file,
    units,
    unitLabel: opts.duplex ? "sheet (both sides)" : "page",
    perUnit,
    subtotal: units * perUnit,
  };
}

export function computeQuote(files: PrintFile[], opts: PrintOptions): Quote {
  const lines = files.map((f) => fileQuote(f, opts));
  const perCopy = lines.reduce((s, l) => s + l.subtotal, 0);
  const totalPages = files.reduce((s, f) => s + f.pages, 0);
  const totalSheets = lines.reduce((s, l) => s + l.units, 0) * opts.copies;
  return {
    lines,
    perCopy,
    total: perCopy * opts.copies,
    totalPages,
    totalSheets,
  };
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function makeOrderId(): string {
  const t = Date.now().toString(36).toUpperCase().slice(-4);
  const r = Math.floor(Math.random() * 90 + 10);
  return `JD-${t}${r}`;
}

export function makeUpiRef(): string {
  let ref = "4";
  for (let i = 0; i < 11; i++) ref += Math.floor(Math.random() * 10);
  return ref;
}

export function upiLink(
  amount: number,
  note: string,
  scheme = "upi",
  vpa = SHOP.vpa,
  payee = SHOP.name
): string {
  const p = new URLSearchParams({
    pa: vpa,
    pn: payee,
    am: amount.toFixed(2),
    tn: note,
    cu: "INR",
  });
  return `${scheme}://pay?${p.toString()}`;
}
