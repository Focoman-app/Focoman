"use client";

import { useEffect } from "react";

/**
 * PwaRegister component
 * Registers the Service Worker (/sw.js) upon initial client mount.
 * Keeps dynamic server actions and Firestore untouched while caching static shell.
 */
export function PwaRegister() {
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log(
              "[PWA] Service Worker registered with scope:",
              registration.scope
            );

            // Check for updates
            registration.addEventListener("updatefound", () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.addEventListener("statechange", () => {
                  if (
                    installingWorker.state === "installed" &&
                    navigator.serviceWorker.controller
                  ) {
                    console.log(
                      "[PWA] New version available. Refresh to activate."
                    );
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.error("[PWA] Service Worker registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}

