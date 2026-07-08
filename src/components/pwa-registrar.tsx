"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const canRegister = "serviceWorker" in navigator && (window.isSecureContext || isLocalhost);

    if (canRegister) {
      navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => {
        // PWA should never block the analysis workspace.
      });
    }
  }, []);

  return null;
}
