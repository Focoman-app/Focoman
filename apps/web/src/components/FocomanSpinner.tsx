import React, { useId } from "react";

export interface FocomanSpinnerProps {
  /** Size preset or pixel dimensions */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Optional custom CSS classes */
  className?: string;
}

const SIZE_MAP = {
  xs: "h-4 w-4",      // 16px - inside buttons
  sm: "h-5 w-5",      // 20px - slightly larger button
  md: "h-8 w-8",      // 32px - cards & modal
  lg: "h-12 w-12",    // 48px - section loaders
  xl: "h-16 w-16",    // 64px - full page splash
};

/**
 * Focoman Brand Shield / Icon Mark
 */
export function FocomanIconMark({ className = "h-6 w-6" }: { className?: string }) {
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9-_]/g, "");
  const shieldBgId = `foco-spin-shield-${cleanId}`;
  const fCyanId = `foco-spin-cyan-${cleanId}`;
  const purpleBorderId = `foco-spin-purple-${cleanId}`;

  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id={shieldBgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#EA580C" />
        </linearGradient>
        <linearGradient id={fCyanId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id={purpleBorderId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#5B21B6" />
        </linearGradient>
      </defs>

      {/* Outer Purple Shield Border */}
      <path
        d="M7 6 L41 6 L47 18 L24 45 L1 18 Z"
        fill={`url(#${purpleBorderId})`}
        stroke="#4C1D95"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {/* Inner Orange Shield Fill */}
      <path
        d="M9.5 8.5 L38.5 8.5 L43.5 18 L24 41.5 L4.5 18 Z"
        fill={`url(#${shieldBgId})`}
      />

      {/* Stylized F Mark Shadow */}
      <path
        d="M12 12.5 H35.5 L31 19.5 H20.5 V23.5 H28.5 L25.5 29.5 H20.5 V36 L15 37.5 V12.5 Z"
        fill="#0369A1"
        opacity="0.5"
      />
      {/* Stylized F Main Face */}
      <path
        d="M11 12 H35 L31 19 H19.5 V23 H27.5 L25 29 H19.5 V36 L14 37 V12 Z"
        fill={`url(#${fCyanId})`}
        stroke="#0284C7"
        strokeWidth="0.75"
      />
      {/* White Top Bevel Highlight */}
      <path
        d="M11 12 H35 L33 14.5 H13.5 V12 Z"
        fill="#FFFFFF"
        opacity="0.9"
      />
    </svg>
  );
}

/**
 * Focoman Branded Spinner:
 * Pure FocoMan brand icon smoothly rotating 360 degrees.
 * No outer boxes, no dashed borders, no extra background shapes.
 */
export function FocomanSpinner({
  size = "md",
  className = "",
}: FocomanSpinnerProps) {
  const sizeClasses = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div
      className={`inline-flex items-center justify-center animate-spin origin-center ${sizeClasses} ${className}`}
      role="status"
      aria-label="Loading"
    >
      <FocomanIconMark className="h-full w-full" />
    </div>
  );
}

/**
 * Focoman Full Page or Card Loading State:
 * Displays ONLY the clean spinning FocoMan logo and the dynamic status message.
 */
export function FocomanLoadingState({
  status = "Loading...",
  subtext,
  minHeight = "min-h-[280px]",
  showCard = true,
}: {
  status?: string;
  subtext?: string;
  minHeight?: string;
  showCard?: boolean;
}) {
  const content = (
    <div className="flex flex-col items-center justify-center text-center p-6 sm:p-8">
      {/* Pure spinning FocoMan brand logo without any background boxes or rings */}
      <div className="mb-4 flex items-center justify-center">
        <FocomanSpinner size="lg" />
      </div>

      {/* Status label */}
      <p className="text-sm font-bold text-text-primary tracking-tight">
        {status}
      </p>

      {/* Subtext if provided */}
      {subtext && (
        <p className="mt-1 text-xs text-text-tertiary max-w-xs">
          {subtext}
        </p>
      )}
    </div>
  );

  if (!showCard) {
    return (
      <div className={`flex flex-col items-center justify-center ${minHeight}`}>
        {content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center ${minHeight} p-4`}>
      <div className="w-full max-w-md rounded-2xl bg-white border border-border-default p-4 shadow-xs">
        {content}
      </div>
    </div>
  );
}
