import React, { useId } from "react";

export function FocomanLogo({
  className = "h-14 w-auto",
  showStudiosSuffix = true,
  variant = "light",
}: {
  className?: string;
  showStudiosSuffix?: boolean;
  variant?: "light" | "dark";
}) {
  const reactId = useId();
  const cleanId = reactId.replace(/[^a-zA-Z0-9_-]/g, "");
  const shieldBgId = `foco-shield-bg-${cleanId}`;
  const fCyanId = `foco-cyan-${cleanId}`;
  const purpleBorderId = `foco-purple-${cleanId}`;

  const focoTextColor = variant === "dark" ? "#FFFFFF" : "#111827";
  const studiosTextColor = variant === "dark" ? "#CBD5E1" : "#4B5563";

  return (
    <svg
      viewBox={showStudiosSuffix ? "0 0 310 52" : "0 0 230 52"}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        {/* Gradients */}
        <linearGradient id={shieldBgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id={fCyanId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id={purpleBorderId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="50%" stopColor="#8B5CF6" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* Superhero Shield Mark */}
      <g transform="translate(2, 2)">
        {/* Outer Purple Shield Border */}
        <path
          d="M6 10 L34 10 L40 22 L20 44 L0 22 Z"
          fill={`url(#${purpleBorderId})`}
          stroke="#4C1D95"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        {/* Inner Orange Shield Fill */}
        <path
          d="M8 12.5 L32 12.5 L37 22 L20 40.5 L3 22 Z"
          fill={`url(#${shieldBgId})`}
        />

        {/* Stylized 'F' Mark */}
        {/* F Shadow/Depth */}
        <path
          d="M10 16 H30 L26 22 H17 V25 H24 L21.5 30 H17 V35 L12 37 V16 Z"
          fill="#0369A1"
          opacity="0.4"
        />
        {/* F Main Face */}
        <path
          d="M9.5 15.5 H29.5 L26 21.5 H16.5 V24.5 H23.5 L21 29.5 H16.5 V35.5 L11.5 36.5 V15.5 Z"
          fill={`url(#${fCyanId})`}
          stroke="#0284C7"
          strokeWidth="0.75"
        />
        {/* F White Top Bevel Highlight */}
        <path
          d="M9.5 15.5 H29.5 L28 17.5 H11.5 V15.5 Z"
          fill="#FFFFFF"
          opacity="0.9"
        />
      </g>

      {/* Brand Text: FocoMan (38px) + Studios (17px) Aligned at Logo Bottom Horizon y=43 */}
      <text
        x="48"
        y="43"
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="-0.03em"
      >
        <tspan fill={focoTextColor} fontWeight="900" fontSize="38">Foco</tspan>
        <tspan fill="#F97316" fontWeight="900" fontSize="38">Man</tspan>
        {showStudiosSuffix && (
          <tspan fill={studiosTextColor} fontWeight="600" fontSize="17" letterSpacing="-0.01em">Studios</tspan>
        )}
      </text>
    </svg>
  );
}

export function FocomanShieldWatermark({ className = "w-96 h-96" }: { className?: string }) {
  return (
    <svg
      viewBox="-5 18 110 88"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="wm-shield-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FB923C" />
          <stop offset="100%" stopColor="#F97316" />
        </linearGradient>
        <linearGradient id="wm-f-cyan" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="wm-purple-border" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#6D28D9" />
        </linearGradient>
      </defs>

      {/* Outer Purple Shield Border */}
      <path
        d="M15 25 L85 25 L100 50 L50 98 L0 50 Z"
        fill="url(#wm-purple-border)"
        opacity="0.3"
      />
      {/* Inner Orange Shield Fill */}
      <path
        d="M20 30 L80 30 L93 50 L50 92 L7 50 Z"
        fill="url(#wm-shield-bg)"
        opacity="0.3"
      />

      {/* F Main Face */}
      <path
        d="M24 38 H74 L65 52 H42 V58 H60 L54 70 H42 V85 L30 87 V38 Z"
        fill="url(#wm-f-cyan)"
        opacity="0.4"
      />
      {/* F White Top Bevel Highlight */}
      <path
        d="M24 38 H74 L70 42 H30 V38 Z"
        fill="#FFFFFF"
        opacity="0.5"
      />
    </svg>
  );
}
