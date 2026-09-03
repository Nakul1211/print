/**
 * PDF.js is loaded lazily (dynamic import) so it never blocks or breaks the
 * initial render of the kiosk. It is fetched only when a PDF is uploaded.
 */

type PdfJsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfJsModule> | null = null;

async function loadPdfJs(): Promise<PdfJsModule> {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist");
  }
  const pdfjs = await pdfjsPromise;
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    const worker = await import("pdfjs-dist/build/pdf.worker.min.js?url");
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  }
  return pdfjs;
}

/** Returns the number of pages in a PDF file. Throws if unreadable. */
export async function getPdfPageCount(file: File): Promise<number> {
  const pdfjs = await loadPdfJs();
  const data = await file.arrayBuffer();
  const task = pdfjs.getDocument({ data });
  try {
    const doc = await task.promise;
    return doc.numPages;
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}

/** Renders every page of a PDF to a print-ready JPEG dataURL. */
export async function renderPdfPages(
  blob: Blob,
  targetWidth = 1240,
  onProgress?: (done: number, total: number) => void
): Promise<string[]> {
  const pdfjs = await loadPdfJs();
  const data = await blob.arrayBuffer();
  const task = pdfjs.getDocument({ data });
  const out: string[] = [];
  try {
    const doc = await task.promise;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const base = page.getViewport({ scale: 1 });
      const scale = Math.min(2.5, targetWidth / base.width);
      const vp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(vp.width);
      canvas.height = Math.ceil(vp.height);
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        out.push(canvas.toDataURL("image/jpeg", 0.88));
      }
      onProgress?.(i, doc.numPages);
    }
    return out;
  } finally {
    try {
      await task.destroy();
    } catch {
      /* noop */
    }
  }
}
