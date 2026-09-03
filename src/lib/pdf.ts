import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

/** Returns the number of pages in a PDF file. Throws if unreadable. */
export async function getPdfPageCount(file: File): Promise<number> {
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
