"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
    const canRegister = "serviceWorker" in navigator && (window.isSecureContext || isLocalhost);

    if (!canRegister) return;

    if (process.env.NODE_ENV === "development") {
      void Promise.all([
        navigator.serviceWorker.getRegistrations().then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister())),
        ),
        "caches" in window
          ? window.caches.keys().then((keys) =>
              Promise.all(
                keys
                  .filter((key) => key.startsWith("opponent-video-analysis-"))
                  .map((key) => window.caches.delete(key)),
              ),
            )
          : Promise.resolve([]),
      ]).catch(() => {
        // Cache cleanup should never block local development.
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").then((registration) => registration.update()).catch(() => {
      // PWA should never block the analysis workspace.
    });
  }, []);

  return null;
}
