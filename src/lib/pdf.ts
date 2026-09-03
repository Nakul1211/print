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
