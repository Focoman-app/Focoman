"use client";

import React, { useEffect, useState } from "react";
import { Download, X, Smartphone, CheckCircle2 } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallFloatingWidget() {
  // Default state: collapsed ("minimized") showing the compact "Install App" button
  const [isExpanded, setIsExpanded] = useState(false);
  // Cross ("X") button hides the widget completely
  const [isDismissed, setIsDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

    if (standalone) {
      setIsStandalone(true);
      return;
    }

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalledSuccess(true);
      setDeferredPrompt(null);
      setTimeout(() => {
        setIsDismissed(true);
      }, 2200);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === "accepted") {
          setDeferredPrompt(null);
          setInstalledSuccess(true);
        } else {
          // If dismissed native prompt, collapse back to compact button
          setIsExpanded(false);
        }
      } catch {
        setShowManualHint(true);
      }
    } else {
      setShowManualHint(true);
    }
  };

  const handleLaterClick = () => {
    setShowManualHint(false);
    setIsExpanded(false);
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDismissed(true);
  };

  return (
    <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
      {!isExpanded ? (
        /* Collapsed Default State: Compact "Install App" Floating Button (Clean White Theme) */
        <div className="inline-flex items-center rounded-full border-2 border-[#D8D2C4] bg-white p-1 shadow-[0_4px_16px_rgba(28,25,23,0.12),0_2px_0_#C4BCAB] transition-all hover:-translate-y-0.5">
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#D8D2C4] bg-white px-3.5 py-2 text-xs sm:text-sm font-bold text-[#1C1917] hover:bg-[#FAF7F2] active:translate-y-[1px] transition cursor-pointer shadow-[0_2px_0_#C4BCAB]"
            aria-label="Expand Install App Options"
          >
            <img
              src="/icon.svg"
              alt=""
              className="h-5 w-5 rounded object-contain shrink-0"
            />
            <span className="whitespace-nowrap">Install App</span>
            <Download className="h-3.5 w-3.5 shrink-0 text-[#1C1917]" />
          </button>
          <button
            type="button"
            onClick={handleCloseClick}
            className="ml-1 mr-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[#78716C] hover:bg-[#FAF7F2] hover:text-[#1C1917] transition cursor-pointer"
            aria-label="Dismiss Install App Button"
            title="Dismiss"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        /* Expanded State: Floating Card with Install, Later, and Close (X) (Clean White Theme) */
        <div
          role="dialog"
          aria-label="Install Focoman App"
          className="w-[290px] sm:w-[330px] rounded-2xl border-2 border-[#D8D2C4] bg-white p-4 shadow-[0_4px_20px_rgba(28,25,23,0.14),0_3px_0_#C4BCAB] transition-all"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] p-1 shadow-2xs">
                <img
                  src="/icon.svg"
                  alt="Focoman"
                  className="h-full w-full object-contain"
                />
              </div>
              <div>
                <h3 className="text-sm font-black tracking-tight text-[#1C1917]">
                  Install Focoman App
                </h3>
                <p className="text-[11px] font-medium text-[#57534E] leading-snug mt-0.5">
                  Quick one-tap access from your home screen or desktop.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCloseClick}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#78716C] hover:border-[#D8D2C4] hover:bg-[#FAF7F2] hover:text-[#1C1917] transition cursor-pointer"
              aria-label="Close Install Prompt"
              title="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {installedSuccess ? (
            <div className="mt-3.5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-bold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>Focoman installed! Open it anytime from your device.</span>
            </div>
          ) : (
            <>
              {showManualHint && (
                <div className="mt-3 rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] p-2.5 text-[11px] font-medium text-[#44403C] leading-relaxed">
                  <div className="flex items-center gap-1.5 font-bold text-[#1C1917] mb-1">
                    <Smartphone className="h-3.5 w-3.5 shrink-0" />
                    <span>How to install on this browser:</span>
                  </div>
                  {isIOS ? (
                    <p>
                      Tap the browser <strong>Share (↑)</strong> button, then select{" "}
                      <strong>&ldquo;Add to Home Screen&rdquo;</strong>.
                    </p>
                  ) : (
                    <p>
                      Open your browser menu <strong>(⋮)</strong> or address bar icon and select{" "}
                      <strong>&ldquo;Install app&rdquo;</strong> or{" "}
                      <strong>&ldquo;Add to Home screen&rdquo;</strong>.
                    </p>
                  )}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-[#1C1917] bg-white px-4 py-2.5 text-xs font-bold text-[#1C1917] shadow-[0_2px_0_#1C1917] hover:bg-[#FAF7F2] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Install</span>
                </button>
                <button
                  type="button"
                  onClick={handleLaterClick}
                  className="inline-flex items-center justify-center rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] px-4 py-2.5 text-xs font-bold text-[#57534E] shadow-[0_2px_0_#C4BCAB] hover:bg-white hover:text-[#1C1917] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                >
                  Later
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
