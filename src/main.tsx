import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

declare global {
  interface Window {
    __JD_APP_MOUNTED__?: boolean;
  }
}

const rootEl = document.getElementById("root")!;
const fallbackHtml = rootEl.innerHTML;

function showFallback(msg?: string) {
  rootEl.innerHTML = fallbackHtml;
  const card = rootEl.querySelector<HTMLElement>("div > div");
  if (msg && card) {
    const p = document.createElement("p");
    p.style.cssText =
      "margin: 14px 0 0; padding-top: 10px; border-top: 2px dashed rgba(21,23,43,0.3); font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.08em; color: #e5097f; word-break: break-word;";
    p.textContent = "Error: " + msg;
    card.appendChild(p);
    const hint = document.createElement("p");
    hint.style.cssText =
      "margin: 8px 0 0; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #3a3d56;";
    hint.textContent = "Ctrl+Shift+R (hard reload) try karo — ya preview refresh karo.";
    card.appendChild(hint);
  }
}

try {
  ReactDOM.createRoot(rootEl).render(<App />);
} catch (e) {
  showFallback(e instanceof Error ? e.message : "boot error");
}

/* hard errors → agar app mount hi nahi hui toh visible fallback */
window.addEventListener("error", (e) => {
  if (!window.__JD_APP_MOUNTED__ && rootEl.childElementCount <= 1) {
    showFallback(e?.message ?? "unknown error");
  }
});
window.addEventListener("unhandledrejection", (e) => {
  if (!window.__JD_APP_MOUNTED__ && rootEl.childElementCount <= 1) {
    showFallback(e?.reason instanceof Error ? e.reason.message : "async error — reload karo");
  }
});

/* watchdog: 8s baad bhi app na bani ho toh diagnostic dikhao */
window.setTimeout(() => {
  if (!window.__JD_APP_MOUNTED__) {
    showFallback("App 8 second mein start nahi hui — network/preview issue ho sakta hai");
  }
}, 8000);
