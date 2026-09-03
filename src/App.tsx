import { useCallback, useState } from "react";
import type { PaymentRecord, PrintFile, PrintOptions } from "./lib/pricing";
import { computeQuote } from "./lib/pricing";
import { AmbientBackground, Footer, Header, Stepper, Ticker } from "./components/Chrome";
import IdleScreen from "./screens/IdleScreen";
import UploadScreen from "./screens/UploadScreen";
import OptionsScreen from "./screens/OptionsScreen";
import ReviewScreen from "./screens/ReviewScreen";
import PaymentScreen from "./screens/PaymentScreen";
import PrintingScreen from "./screens/PrintingScreen";
import ReceiptScreen from "./screens/ReceiptScreen";

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

export default function App() {
  const [step, setStep] = useState<Step>("idle");
  const [files, setFiles] = useState<PrintFile[]>([]);
  const [options, setOptions] = useState<PrintOptions>(DEFAULT_OPTIONS);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);

  const quote = computeQuote(files, options);

  const addFiles = useCallback((newFiles: PrintFile[]) => {
    setFiles((prev) => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const handlePaid = useCallback((p: PaymentRecord) => {
    setPayment(p);
    setStep("printing");
  }, []);

  const resetOrder = useCallback(() => {
    setFiles([]);
    setOptions(DEFAULT_OPTIONS);
    setPayment(null);
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
            onNext={() => setStep("review")}
            onBack={() => setStep("files")}
          />
        )}

        {step === "review" && (
          <ReviewScreen files={files} options={options} onNext={() => setStep("pay")} onBack={() => setStep("options")} />
        )}

        {step === "pay" && (
          <PaymentScreen quote={quote} options={options} onSuccess={handlePaid} onBack={() => setStep("review")} />
        )}

        {step === "printing" && payment && (
          <PrintingScreen quote={quote} options={options} payment={payment} onComplete={() => setStep("receipt")} />
        )}

        {step === "receipt" && payment && (
          <ReceiptScreen files={files} options={options} payment={payment} onNewOrder={resetOrder} />
        )}
      </main>

      <Footer />
    </div>
  );
}
