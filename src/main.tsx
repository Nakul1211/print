import "./index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

declare global {
  interface Window {
    __BOOT__?: { stage: string; errors: string[]; t0: number };
    __JD_APP_MOUNTED__?: boolean;
  }
}

if (window.__BOOT__) window.__BOOT__.stage = "main-loaded";

const rootEl = document.getElementById("root");
if (rootEl) {
  try {
    ReactDOM.createRoot(rootEl).render(<App />);
    if (window.__BOOT__) window.__BOOT__.stage = "render-called";
  } catch (e) {
    if (window.__BOOT__) window.__BOOT__.errors.push("render: " + (e instanceof Error ? e.message : String(e)));
  }
}
