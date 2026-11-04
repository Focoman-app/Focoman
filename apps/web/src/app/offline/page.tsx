"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#09090B] text-[#FAFAFA] flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-[#18181B] border border-white/10 rounded-3xl p-8 shadow-2xl flex flex-col items-center">
        {/* App Icon */}
        <div className="w-20 h-20 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center p-2 mb-6 shadow-inner">
          <Image
            src="/icons/icon-192.png"
            alt="Focoman Studios"
            width={64}
            height={64}
            className="rounded-xl"
            priority
          />
        </div>

        {/* Offline Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-medium tracking-wide mb-4">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          {isOnline ? "Connection Restored" : "You Are Currently Offline"}
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-2">
          Focoman Studios
        </h1>
        <p className="text-zinc-400 text-sm leading-relaxed mb-8">
          {isOnline
            ? "Your internet connection is back. You can now resume managing your photography studio and orders."
            : "No active internet connection was detected. Connect to Wi-Fi or cellular data to access your studio OS."}
        </p>

        {/* Action Button */}
        <div className="w-full flex flex-col gap-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-sm transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry Connection
          </button>

          <Link
            href="/"
            className="w-full py-2.5 px-4 rounded-xl bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 font-medium text-xs transition-colors"
          >
            Go to Home Screen
          </Link>
        </div>
      </div>

      <p className="mt-8 text-xs text-zinc-500">
        Focoman Studios &bull; Offline Shield Architecture
      </p>
    </div>
  );
}
