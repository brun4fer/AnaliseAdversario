"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // PWA should never block the analysis workspace.
      });
    }
  }, []);

  return null;
}
