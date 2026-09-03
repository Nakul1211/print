import { Component, Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import type { PaymentRecord, PrintFile, PrintOptions } from "./lib/pricing";
import { computeQuote, inr } from "./lib/pricing";
import { AmbientBackground, Footer, Header, Stepper, Ticker } from "./components/Chrome";
import { getOrder, patchOrder, saveOrder, toMeta } from "./lib/store";
import { startLiveSync } from "./lib/sync";
import IdleScreen from "./screens/IdleScreen";
import UploadScreen from "./screens/UploadScreen";
import OptionsScreen from "./screens/OptionsScreen";
import ReviewScreen from "./screens/ReviewScreen";
import PaymentScreen from "./screens/PaymentScreen";
import PrintingScreen from "./screens/PrintingScreen";
import ReceiptScreen from "./screens/ReceiptScreen";

/* Admin panel alag chunk mein — customer kiosk ka boot hamesha fast & safe */
const AdminScreen = lazy(() => import("./screens/AdminScreen"));

type Step = "idle" | "files" | "options" | "review" | "pay" | "printing" | "receipt";

const STEP_INDEX: Record<Step, number> = {
  idle: -1,
  files: 0,
  options: 1,
  review: 2,
  pay: 2,
  printing: 3,
  receipt: 4,
};

const DEFAULT_OPTIONS: PrintOptions = { color: "bw", duplex: false, size: "A4", copies: 1 };

/* Catches any render/runtime error so the kiosk never shows a blank screen */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex min-h-screen items-center justify-center bg-[#f1f1ea] p-6"
          style={{ fontFamily: "Archivo, sans-serif", color: "#15172b" }}
        >
          <div className="w-full max-w-lg border-2 border-[#15172b] bg-[#fbfbf6] p-8 shadow-[8px_8px_0_0_#15172b]">
            <p className="font-mono text-[11px] font-bold tracking-[0.3em] uppercase" style={{ color: "#e5097f" }}>
              ⚠ Press Jam — Kiosk Error
            </p>
            <h1 className="mt-3 text-4xl font-black uppercase">Machine atak gayi</h1>
            <p className="mt-3 text-sm leading-relaxed opacity-80">
              Kuch toot gaya hai. Error details neeche hain — page reload karke dobara try karo.
            </p>
            <pre className="mt-4 overflow-auto border-2 border-dashed border-[#15172b]/40 bg-[#f1f1ea] p-3 font-mono text-xs whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="mt-6 w-full border-2 border-[#15172b] bg-[#ffd21f] px-6 py-3 text-lg font-black tracking-wide uppercase shadow-[3px_3px_0_0_#15172b] transition-transform hover:translate-x-0.5 hover:translate-y-0.5"
            >
              Reload Kiosk
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ================= Kiosk wizard (customer side) ================= */
function Kiosk() {
  const [step, setStep] = useState<Step>("idle");
  const [files, setFiles] = useState<PrintFile[]>([]);
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);

  const orderRef = useRef<string | null>(null);
  const filesRef = useRef<PrintFile[]>([]);
  const optionsRef = useRef<PrintOptions>(options);
  filesRef.current = files;
  optionsRef.current = options;

  const quote = computeQuote(files, options);

  /* ---- realtime cloud sync: orders har admin device par live jaate hain ---- */
  useEffect(() => {
    try {
      startLiveSync("kiosk");
    } catch {
      /* sync fail ho toh bhi kiosk chalta rahe */
    }
  }, []);

  /* ---- live order sync → admin panel ---- */
  const syncFilesToOrder = useCallback((all: PrintFile[], eventLabel: string) => {
    if (!orderRef.current) {
      orderRef.current = `ORD-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.floor(Math.random() * 90 + 10)}`;
    }
    const id = orderRef.current;
    const meta = toMeta(all);
    const totalPages = all.reduce((s, f) => s + f.pages, 0);
    if (!getOrder(id)) {
      saveOrder({
        id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: "files",
        files: meta,
        totalPages,
        events: [{ at: Date.now(), label: eventLabel }],
      });
    } else {
      patchOrder(id, { files: meta, totalPages }, eventLabel);
    }
  }, []);

  const addFiles = useCallback(
    (newFiles: PrintFile[]) => {
      const all = [...filesRef.current, ...newFiles];
      setFiles(all);
      const pg = newFiles.reduce((s, f) => s + f.pages, 0);
      syncFilesToOrder(all, `${newFiles.length} file${newFiles.length > 1 ? "s" : ""} received (${pg} pages)`);
    },
    [syncFilesToOrder]
  );

  const removeFile = useCallback(
    (fid: string) => {
      const all = filesRef.current.filter((f) => f.id !== fid);
      setFiles(all);
      if (!orderRef.current) return;
      if (all.length) syncFilesToOrder(all, "1 file removed from job");
      else patchOrder(orderRef.current, { files: [], totalPages: 0 }, "All files removed");
    },
    [syncFilesToOrder]
  );

  const gotoReview = () => {
    setStep("review");
    if (orderRef.current) {
      patchOrder(
        orderRef.current,
        { options },
        `Options set — ${options.color === "bw" ? "B&W" : "Colour"}, ${options.size}, ${
          options.duplex ? "both sides" : "one side"
        }, ×${options.copies}`
      );
    }
  };

  const handlePaid = useCallback((p: PaymentRecord) => {
    setPayment(p);
    setStep("printing");
    const id = orderRef.current;
    if (id) {
      const q = computeQuote(filesRef.current, optionsRef.current);
      patchOrder(
        id,
        {
          status: "printing",
          options: optionsRef.current,
          total: q.total,
          payment: {
            orderId: p.orderId,
            amount: p.amount,
            method: p.method,
            upiRef: p.upiRef,
            paidAt: p.paidAt.getTime(),
          },
        },
        `Payment confirmed — ${inr(p.amount)} via ${p.method}`
      );
      patchOrder(id, {}, "Press started — printing job");
    }
  }, []);

  const handlePrinted = () => {
    setStep("receipt");
    if (orderRef.current) patchOrder(orderRef.current, { status: "done" }, "Print complete — job finished");
  };

  const resetOrder = useCallback(() => {
    setFiles([]);
    setOptions(DEFAULT_OPTIONS);
    setPayment(null);
    orderRef.current = null;
    setStep("idle");
  }, []);

  const showStepper = step !== "idle";

  return (
    <div className="flex min-h-screen flex-col">
      <AmbientBackground />
      <Header />
      <Ticker />
      {showStepper && <Stepper current={STEP_INDEX[step]} />}

      <main className="flex-1">
        {step === "idle" && <IdleScreen onStart={() => setStep("files")} />}

        {step === "files" && (
          <UploadScreen
            files={files}
            onAdd={addFiles}
            onRemove={removeFile}
            onNext={() => setStep("options")}
            onBack={() => setStep("idle")}
          />
        )}

        {step === "options" && (
          <OptionsScreen
            files={files}
            options={options}
            onChange={setOptions}
            onNext={gotoReview}
            onBack={() => setStep("files")}
          />
        )}

        {step === "review" && (
          <ReviewScreen
            files={files}
            options={options}
            onNext={() => setStep("pay")}
            onBack={() => setStep("options")}
          />
        )}

        {step === "pay" && (
          <PaymentScreen
            quote={quote}
            options={options}
            onSuccess={handlePaid}
            onBack={() => setStep("review")}
          />
        )}

        {step === "printing" && payment && (
          <PrintingScreen
            quote={quote}
            options={options}
            payment={payment}
            onComplete={handlePrinted}
          />
        )}

        {step === "receipt" && payment && (
          <ReceiptScreen files={files} options={options} payment={payment} onNewOrder={resetOrder} />
        )}
      </main>

      <Footer />
    </div>
  );
}

/* admin route ka loading state */
function AdminLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink">
      <div className="pop-in border-2 border-paper/30 bg-panel px-10 py-8 text-center shadow-press-lg">
        <p className="font-display text-2xl tracking-wide uppercase">
          Press Room <span className="text-magenta">khul raha hai…</span>
        </p>
        <div className="stripes-live mx-auto mt-3 h-2 w-44 border-2 border-ink" />
      </div>
    </div>
  );
}

/* ================= Root with routing ================= */
export default function App() {
  /* boot watchdog ke liye — app zinda hai */
  useEffect(() => {
    window.__JD_APP_MOUNTED__ = true;
  }, []);

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/" element={<Kiosk />} />
          <Route
            path="/admin"
            element={
              <Suspense fallback={<AdminLoader />}>
                <AdminScreen />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
