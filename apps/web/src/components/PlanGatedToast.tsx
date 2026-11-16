"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertCircle, X } from "lucide-react";

export function usePlanGatedToast(durationMs = 5000) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage(null);
  }, []);

  const show = useCallback(
    (nextMessage: string) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setMessage(nextMessage);
      timerRef.current = setTimeout(() => {
        setMessage(null);
        timerRef.current = null;
      }, durationMs);
    },
    [durationMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { message, show, dismiss };
}

interface PlanGatedToastProps {
  message: string | null;
  onDismiss: () => void;
  upgradeHref?: string;
}

export function PlanGatedToast({
  message,
  onDismiss,
  upgradeHref,
}: PlanGatedToastProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-16 right-4 left-4 sm:left-auto z-[70] max-w-xl rounded-xl border border-red-300 bg-red-50 px-3.5 py-2.5 text-xs font-semibold text-red-800 shadow-lg flex items-start sm:items-center justify-between gap-2.5"
    >
      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600 mt-0.5 sm:mt-0" />
        <span className="whitespace-normal break-words leading-relaxed">{message}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {upgradeHref && (
          <Link
            href={upgradeHref}
            className="rounded-lg bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-red-700 transition"
          >
            Upgrade
          </Link>
        )}
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss warning"
          className="rounded p-0.5 text-red-700 hover:bg-red-100 hover:text-red-950 transition cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
