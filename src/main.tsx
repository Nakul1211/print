import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const rootEl = document.getElementById("root")!;
const fallbackHtml = rootEl.innerHTML;

/** Kabhi bhi blank screen nahi — mount fail ho toh fallback dikhao */
function showFallback(msg?: string) {
  rootEl.innerHTML = fallbackHtml;
  if (msg) {
    const p = document.createElement("p");
    p.style.cssText =
      "margin: 12px 0 0; font-family: 'IBM Plex Mono', monospace; font-size: 10px; letter-spacing: 0.1em; color: #e5097f; text-transform: uppercase; word-break: break-word;";
    p.textContent = msg;
    rootEl.querySelector("div > div")?.appendChild(p);
  }
}

try {
  ReactDOM.createRoot(rootEl).render(<App />);
} catch (e) {
  showFallback(e instanceof Error ? e.message : "boot error");
}

window.addEventListener("error", (e) => {
  /* React tree mar gaya / kabhi mount hi nahi hua → visible fallback */
  if (rootEl.childElementCount === 0) {
    showFallback(e?.message);
  }
});
window.addEventListener("unhandledrejection", () => {
  if (rootEl.childElementCount === 0) showFallback("async boot error — reload karo");
});
