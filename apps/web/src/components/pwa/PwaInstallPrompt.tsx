"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isDismissed, setIsDismissed] = useState(true);

  useEffect(() => {
    // 1. Detect if running inside installed standalone PWA
    const isStandaloneMode =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;

    if (isStandaloneMode) {
      setIsStandalone(true);
      return;
    }

    // 2. Check if previously dismissed in this browser session
    const dismissed = sessionStorage.getItem("focoman-pwa-dismissed");
    if (!dismissed) {
      setIsDismissed(false);
    }

    // 3. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    const isSafari =
      /safari/.test(userAgent) && !/chrome|crios|fxios/.test(userAgent);

    if (isAppleDevice && isSafari) {
      setIsIos(true);
    }

    // 4. Capture Chromium beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setIsDismissed(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Chromium prompt
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsDismissed(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      // Show iOS step-by-step guidance
      setShowIosGuide(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    sessionStorage.setItem("focoman-pwa-dismissed", "true");
  };

  // If already standalone, or dismissed, or neither Chromium prompt nor iOS is available
  if (isStandalone || isDismissed || (!deferredPrompt && !isIos)) {
    return null;
  }

  return (
    <>
      {/* Floating PWA Install Banner */}
      <aside
        aria-label="Install Focoman Studios App"
        className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-5 duration-300"
      >
        <div className="bg-[#18181B] text-white border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center justify-between gap-3 backdrop-blur-md bg-opacity-95">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex-shrink-0 flex items-center justify-center p-1 overflow-hidden shadow-inner">
              <Image
                src="/icons/icon-192.png"
                alt="Focoman Studios"
                width={40}
                height={40}
                className="rounded-lg"
              />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate text-white">
                Focoman Studios
              </p>
              <p className="text-zinc-400 text-xs truncate">
                Install app for faster access
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-all active:scale-95 shadow-sm"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              aria-label="Dismiss installation prompt"
              className="w-7 h-7 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors text-sm"
            >
              &times;
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Safari Instruction Modal */}
      {showIosGuide && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="ios-modal-title"
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
        >
          <div className="bg-[#18181B] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-white shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <Image
                  src="/icons/icon-192.png"
                  alt="Focoman Studios"
                  width={36}
                  height={36}
                  className="rounded-lg"
                />
                <h3 id="ios-modal-title" className="font-bold text-base">Install on iOS</h3>
              </div>
              <button
                onClick={() => setShowIosGuide(false)}
                aria-label="Close instructions"
                className="text-zinc-400 hover:text-white text-lg px-2"
              >
                &times;
              </button>
            </div>

            <p className="text-zinc-300 text-xs leading-relaxed mb-4">
              To install <strong>Focoman Studios</strong> on your iPhone or iPad:
            </p>

            <ol className="space-y-3 text-xs text-zinc-300">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white font-semibold flex-shrink-0 text-[10px]">
                  1
                </span>
                <span>
                  Tap the <strong>Share</strong> button{" "}
                  <span className="inline-block px-1 py-0.5 rounded bg-zinc-800 text-[11px]">
                    ⎋
                  </span>{" "}
                  in the Safari toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white font-semibold flex-shrink-0 text-[10px]">
                  2
                </span>
                <span>
                  Scroll down and tap{" "}
                  <strong>&quot;Add to Home Screen&quot;</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center text-white font-semibold flex-shrink-0 text-[10px]">
                  3
                </span>
                <span>
                  Tap <strong>Add</strong> in the top right to launch from your
                  home screen.
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIosGuide(false)}
              className="mt-6 w-full py-2.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-zinc-200 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
