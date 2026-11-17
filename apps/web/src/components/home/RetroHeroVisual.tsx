"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";

export function RetroHeroVisual() {
  const [isMounted, setIsMounted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const isPlayingRef = useRef(false);
  const animationRef = useRef<ReturnType<typeof animate> | null>(null);
  const isScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const progress = useMotionValue(0);

  // ── PHASE 1: CHAOS SECTIONS (EXCEL, DIARY, CHAT) ──
  // Starts crisp, then soft blurs at borders while remaining partially visible behind the text spotlight
  const chaosOpacity = useTransform(progress, [0, 0.22, 0.40, 0.70, 0.82], [1, 1, 0.65, 0.45, 0]);
  const chaosScale = useTransform(progress, [0.22, 0.75], [1, 0.95]);
  const chaosFilter = useTransform(progress, (v) => {
    if (v < 0.20) return "blur(0px)";
    if (v < 0.72) return "blur(4.5px)";
    return "blur(12px)";
  });

  // ── PHASE 2A: THE PROBLEM QUESTION ("Tired of...") ──
  // Arrives line by line between 0.18 and 0.36, dwells until 0.46, then smoothly fades out between 0.46 and 0.52
  const qContainerOpacity = useTransform(progress, [0.17, 0.20, 0.46, 0.52], [0, 1, 1, 0]);

  // Sequential question lines (3 balanced lines)
  const qLine1Opacity = useTransform(progress, [0.18, 0.23, 0.46, 0.52], [0, 1, 1, 0]);
  const qLine1Y = useTransform(progress, [0.18, 0.23, 0.46, 0.52], [14, 0, 0, -10]);

  const qLine2Opacity = useTransform(progress, [0.24, 0.29, 0.46, 0.52], [0, 1, 1, 0]);
  const qLine2Y = useTransform(progress, [0.24, 0.29, 0.46, 0.52], [14, 0, 0, -10]);

  const qLine3Opacity = useTransform(progress, [0.30, 0.36, 0.46, 0.52], [0, 1, 1, 0]);
  const qLine3Y = useTransform(progress, [0.30, 0.36, 0.46, 0.52], [14, 0, 0, -10]);

  // ── PHASE 2B: THE RESOLUTION ("Focoman brings everything inside a single tool.") ──
  // Arrives sequentially between 0.52 and 0.68, dwells until 0.72, then smoothly fades out while dashboard emerges
  const sContainerOpacity = useTransform(progress, [0.51, 0.54, 0.72, 0.78], [0, 1, 1, 0]);

  const sLine1Opacity = useTransform(progress, [0.52, 0.57, 0.72, 0.78], [0, 1, 1, 0]);
  const sLine1Y = useTransform(progress, [0.52, 0.57, 0.72, 0.78], [14, 0, 0, -10]);

  const sLine2Opacity = useTransform(progress, [0.58, 0.63, 0.72, 0.78], [0, 1, 1, 0]);
  const sLine2Y = useTransform(progress, [0.58, 0.63, 0.72, 0.78], [14, 0, 0, -10]);

  const sLine3Opacity = useTransform(progress, [0.64, 0.69, 0.72, 0.78], [0, 1, 1, 0]);
  const sLine3Y = useTransform(progress, [0.64, 0.69, 0.72, 0.78], [14, 0, 0, -10]);

  // ── PHASE 3: DASHBOARD TRANSITION ──
  // Dashboard starts emerging right as FOCOMAN BRINGS finishes, smoothly morphing into view
  const whiteWashOpacity = useTransform(progress, [0.70, 0.76, 0.86], [0, 0.40, 0]);

  const dashboardContainerOpacity = useTransform(progress, [0.66, 0.84], [0, 1]);
  const dashboardContainerScale = useTransform(progress, [0.66, 0.86], [0.95, 1.0]);
  const dashboardFilter = useTransform(progress, (v) => {
    if (v < 0.66) return "blur(12px)";
    if (v < 0.86) {
      const b = ((0.86 - v) / 0.20) * 12;
      return `blur(${Math.max(0, b).toFixed(1)}px)`;
    }
    return "blur(0px)";
  });

  // Dashboard Sub-elements Stagger
  const headerOpacity = useTransform(progress, [0.72, 0.84], [0, 1]);
  const headerY = useTransform(progress, [0.72, 0.84], [4, 0]);

  const kpiOpacity = useTransform(progress, [0.76, 0.88], [0, 1]);
  const kpiY = useTransform(progress, [0.76, 0.88], [16, 0]);

  const filtersOpacity = useTransform(progress, [0.80, 0.92], [0, 1]);
  const filtersX = useTransform(progress, [0.80, 0.92], [-14, 0]);

  const tableOpacity = useTransform(progress, [0.84, 0.98], [0, 1]);
  const tableY = useTransform(progress, [0.84, 0.98], [16, 0]);

  // ── AUTOMATED TIMELINE FUNCTION (16.5s DURATION FOR GENEROUS READING TIME) ──
  const startAutoplay = useCallback((duration = 16.5) => {
    if (animationRef.current) {
      animationRef.current.stop();
    }
    progress.set(0);
    setIsFinished(false);
    isPlayingRef.current = true;

    animationRef.current = animate(progress, 1, {
      duration,
      ease: [0.2, 0, 0.2, 1],
      onComplete: () => {
        setIsFinished(true);
        isPlayingRef.current = false;
      },
    });
  }, [progress]);

  // ── HYBRID AUTO-PLAY + SCROLL CONTROLLER ──
  useEffect(() => {
    setIsMounted(true);

    // Check prefers-reduced-motion
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      progress.set(1);
      setIsFinished(true);
      return;
    }

    // Auto-play starts initially if at top
    if (window.scrollY < 30) {
      startAutoplay(16.5);
    } else {
      progress.set(1);
      setIsFinished(true);
    }

    const heroSection = document.getElementById("home");
    let scrollFrame: number | null = null;
    const updateScroll = () => {
      scrollFrame = null;
      if (!heroSection) return;

      const rect = heroSection.getBoundingClientRect();
      const heroTop = window.scrollY + rect.top;
      const heroScrollDistance = heroSection.offsetHeight - window.innerHeight;

      if (heroScrollDistance <= 0) return;

      const currentScrollWithinHero = window.scrollY - heroTop;
      const fraction = Math.min(1, Math.max(0, currentScrollWithinHero / heroScrollDistance));

      // User initiated a scroll
      isScrollingRef.current = true;
      if (animationRef.current) {
        animationRef.current.stop();
        isPlayingRef.current = false;
      }

      // Sync progress directly to scroll
      progress.set(fraction);

      if (fraction >= 0.98) {
        setIsFinished(true);
      } else {
        setIsFinished(false);
      }

      // If user scrolled all the way back to top (scrollY <= 15), return to chaos
      if (window.scrollY <= 15) {
        progress.set(0);
        setIsFinished(false);

        // Reset scroll timeout to allow autoplay if idle at top
        if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
        scrollTimeoutRef.current = setTimeout(() => {
          if (window.scrollY <= 15 && !isPlayingRef.current) {
            startAutoplay(16.5);
          }
        }, 1200);
      }
    };

    // At most one layout read/update per animation frame, even on trackpads.
    const handleScroll = () => {
      if (scrollFrame === null) scrollFrame = requestAnimationFrame(updateScroll);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      if (animationRef.current) animationRef.current.stop();
      if (scrollTimeoutRef.current) clearTimeout(scrollTimeoutRef.current);
    };
  }, [progress, startAutoplay]);

  if (!isMounted) {
    return (
      <div
        className="relative mx-auto w-full max-w-[760px] h-[290px] min-[390px]:h-[315px] xs:h-[345px] sm:h-[400px] md:h-[455px] lg:h-[495px] xl:h-[520px] select-none rounded-2xl bg-[#FAF7F2] border border-[#D8D2C4]"
      />
    );
  }

  return (
    <div
      className="relative mx-auto w-full max-w-[760px] h-[290px] min-[390px]:h-[315px] xs:h-[345px] sm:h-[400px] md:h-[455px] lg:h-[495px] xl:h-[520px] select-none perspective-1000 overflow-hidden rounded-2xl"
    >
      
      {/* ───────────────────────────────────────────────────────────── */}
      {/* 1. CHAOS SECTION: SPREADSHEET, DIARY & MESSAGING APP          */}
      {/* ───────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          opacity: chaosOpacity,
          scale: chaosScale,
          filter: chaosFilter,
        }}
        className="absolute inset-0 flex flex-col pointer-events-none gap-2 sm:gap-2.5"
      >
        
        {/* ── SEGMENT 1: SPREADSHEET (TRADITIONAL EXCEL BOOKING SHEET) ── */}
        <div className="w-full flex-[1.08] min-h-0 rounded-xl sm:rounded-2xl border border-emerald-600/30 sm:border-2 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col">
          {/* Excel Title Bar */}
          <div className="bg-[#107C41] px-2 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between text-white text-[9.5px] sm:text-[11px] font-sans shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="font-bold bg-white text-[#107C41] px-1 rounded text-[9px] sm:text-[10px] leading-tight shrink-0">X</span>
              <span className="font-mono text-[9px] sm:text-[10.5px] truncate">Studio_Bookings_2026_MASTER.xlsx</span>
              <span className="text-[8.5px] sm:text-[9.5px] text-emerald-200 font-mono hidden md:inline shrink-0">(Local Autosave: Off)</span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 text-[8.5px] sm:text-[9.5px] text-emerald-100 font-mono shrink-0">
              <span className="bg-white/20 px-1.5 py-0.2 rounded">Sheet1</span>
              <span className="text-red-200 font-bold hidden sm:inline">⚠️ Unsaved</span>
            </div>
          </div>

          {/* Formula Bar */}
          <div className="bg-[#F3F2F1] px-2 sm:px-2.5 py-0.5 sm:py-1 border-b border-[#D4D4D4] flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] font-mono text-gray-700 shrink-0">
            <span className="font-bold text-gray-500 text-[10px] sm:text-[11px]">fx</span>
            <span className="bg-white border border-[#C8C8C8] px-2 py-0.5 rounded-2xs flex-1 truncate text-gray-800 text-[8.5px] sm:text-[9.5px]">
              =SUM(F2:F7)
            </span>
          </div>

          {/* Full Traditional Excel Table with ALL Columns - Scaled/Zoomed out on mobile so all columns fit without cutoff */}
          <div className="flex-1 overflow-x-auto sm:overflow-x-visible overflow-y-hidden bg-white font-sans">
            <div className="w-[140%] xs:w-[122%] sm:w-full origin-top-left scale-[0.714] xs:scale-[0.82] sm:scale-100 text-[8px] xs:text-[8.5px] sm:text-[10px]">
              <table className="w-full text-left border-collapse border border-[#D4D4D4]">
                <thead>
                  <tr className="bg-[#E1DFDD] text-gray-700 text-[8px] sm:text-[9px] border-b border-[#D4D4D4]">
                    <th className="p-0.5 sm:p-1 px-1 sm:px-1.5 border-r border-[#D4D4D4] w-5 sm:w-6 text-center font-normal bg-[#D0CECB]"> </th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] font-semibold">Order</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] font-semibold">Customer</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] font-semibold">Event / Shoot</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] font-semibold">Date</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] font-semibold">Status</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] text-right font-semibold">Amount</th>
                    <th className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-semibold">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E5E5] text-[8.5px] sm:text-[9.5px] text-gray-800">
                  <tr className="hover:bg-gray-50">
                    <td className="p-0.5 sm:p-1 px-1 sm:px-1.5 bg-[#F3F2F1] text-gray-500 text-center border-r border-[#D4D4D4] font-mono text-[8px] sm:text-[9px]">1</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-blue-700 underline border-r border-[#D4D4D4]">ORD-TES-261008-010906</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-medium border-r border-[#D4D4D4]">Priya and Arjun</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4]">Wedding</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-gray-600 border-r border-[#D4D4D4]">2026-10-07</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] text-gray-700">Post-Event In Progress</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono border-r border-[#D4D4D4]">₹1,50,000</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono text-red-600 font-medium">₹50,000</td>
                  </tr>
                  <tr className="hover:bg-gray-50 bg-[#FBFBFA]">
                    <td className="p-0.5 sm:p-1 px-1 sm:px-1.5 bg-[#F3F2F1] text-gray-500 text-center border-r border-[#D4D4D4] font-mono text-[8px] sm:text-[9px]">2</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-blue-700 underline border-r border-[#D4D4D4]">ORD-TES-261008-004803</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-medium border-r border-[#D4D4D4]">Vikram Sharma</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4]">Reception</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-gray-600 border-r border-[#D4D4D4]">2026-10-06</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] text-red-700 font-semibold bg-red-50/60">Pending Payment</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono border-r border-[#D4D4D4]">₹80,000</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono text-red-600 font-bold">₹30,000</td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="p-0.5 sm:p-1 px-1 sm:px-1.5 bg-[#F3F2F1] text-gray-500 text-center border-r border-[#D4D4D4] font-mono text-[8px] sm:text-[9px]">3</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-blue-700 underline border-r border-[#D4D4D4]">ORD-TES-261008-004647</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-medium border-r border-[#D4D4D4]">Divya Ramesh</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4]">Pre-Wedding</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-gray-600 border-r border-[#D4D4D4]">2026-10-07</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] text-gray-700">Post-Event In Progress</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono border-r border-[#D4D4D4]">₹45,000</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono text-red-600 font-medium">₹15,000</td>
                  </tr>
                  <tr className="hover:bg-gray-50 bg-[#FBFBFA]">
                    <td className="p-0.5 sm:p-1 px-1 sm:px-1.5 bg-[#F3F2F1] text-gray-500 text-center border-r border-[#D4D4D4] font-mono text-[8px] sm:text-[9px]">4</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-mono text-blue-700 underline border-r border-[#D4D4D4]">ORD-TES-261008-003234</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 font-medium border-r border-[#D4D4D4]">Siva Krishna</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4]">Wedding</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 border-r border-[#D4D4D4] text-gray-700">Post-Event In Progress</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono border-r border-[#D4D4D4]">₹3,20,000</td>
                    <td className="p-0.5 sm:p-1 px-1.5 sm:px-2 text-right font-mono text-red-700 font-bold bg-amber-50">₹1,00,000</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Traditional Excel Sheet Tabs & Status Bar */}
          <div className="bg-[#F3F2F1] px-2 sm:px-3 py-0.5 sm:py-1 border-t border-[#D4D4D4] flex items-center justify-between text-[8px] sm:text-[9px] text-gray-600 font-sans shrink-0">
            <div className="flex items-center gap-1 font-mono">
              <span className="bg-white border-t border-x border-[#A6A6A6] px-1.5 sm:px-2 py-0.2 sm:py-0.5 font-bold text-gray-900">
                Oct_Orders
              </span>
              <span className="px-1 text-gray-500 hidden sm:inline">Nov_Shoots</span>
            </div>
            <span className="text-red-600 font-mono font-bold text-[8px] sm:text-[9px]">Unreconciled Due: ₹1,95,000</span>
          </div>
        </div>

        {/* ── BOTTOM ROW: DIARY & MESSAGING APP ── */}
        <div className="w-full flex-1 min-h-0 flex items-stretch justify-between gap-1.5 sm:gap-2.5">
          
          {/* ── SEGMENT 2: 62% HANDWRITTEN DIARY ── */}
          <div className="w-[62%] sm:w-[65%] h-full rounded-xl sm:rounded-2xl border border-amber-800/25 sm:border-2 bg-[#FAF5E8] shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col justify-between">
            {/* Diary Printed Top Header */}
            <div className="bg-[#F3EBD8] border-b border-[#D8D0BE] px-2 sm:px-3 py-1 sm:py-1.5 flex items-center justify-between text-[#8C5D35] font-mono text-[8.5px] sm:text-[9.5px] font-bold shrink-0">
              <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                <span>DAILY PLANNER 2026</span>
                <span className="text-gray-400 font-normal hidden sm:inline">|</span>
                <span className="text-[#8C2D19] hidden sm:inline">WEDNESDAY 07 OCT</span>
              </div>
              <span className="text-gray-500 text-[8px] sm:text-[8.5px] shrink-0">PAGE 104</span>
            </div>

            {/* Ruled Paper with Real Handwritten Notes */}
            <div
              className="flex-1 p-1.5 sm:p-2.5 space-y-0.5 sm:space-y-1.5 text-[#1E3A8A] leading-[15px] sm:leading-[18px] md:leading-[20px] overflow-hidden"
              style={{
                fontFamily: "'Caveat', 'Kalam', 'Segoe Print', cursive",
                backgroundImage: "linear-gradient(transparent 18px, #E5DEC9 19px)",
                backgroundSize: "100% 19px",
              }}
            >
              <div className="text-[12px] sm:text-[14px] md:text-[16px] font-bold text-[#8C2D19] tracking-wide truncate">
                Today&apos;s Studio Shoot and Crew Schedule:
              </div>

              <div className="text-[10.5px] sm:text-[13px] md:text-[15px] leading-[14px] sm:leading-[18px] text-[#1E3A8A] font-semibold">
                <span className="text-[#8C2D19] font-bold">14th Dec Royal Wedding Lineup:</span><br />
                • Lead: Vijay (Sony A7IV) | Candid: Manoj | Drone: Karthik
              </div>

              <div className="text-[10px] sm:text-[12.5px] md:text-[14.5px] leading-[14px] sm:leading-[18px] text-gray-900 font-bold">
                Pending Collections Urgent:<br />
                • Sneha: Collect ₹25k | Siva: ₹1,00,000 (Invoice)
              </div>

              <div className="text-[9.5px] sm:text-[12px] md:text-[13.5px] line-through text-gray-500 hidden xs:block">
                • Format 4x 128GB Sony Tough cards (Done)
              </div>
            </div>

            {/* Diary Footer */}
            <div className="bg-[#F3EBD8] px-2 sm:px-3 py-0.5 sm:py-1 border-t border-[#D8D0BE] flex items-center justify-between text-[7px] sm:text-[8px] font-mono text-[#8C5D35] shrink-0">
              <span>Studio Crew Logbook</span>
              <span className="text-gray-600 font-semibold">3 Shoots Pending</span>
            </div>
          </div>

          {/* ── SEGMENT 3: 35% MESSAGING APP ── */}
          <div className="w-[35%] sm:w-[32%] h-full rounded-xl sm:rounded-2xl border border-blue-500/30 sm:border-2 bg-white shadow-[0_6px_20px_rgba(0,0,0,0.06)] overflow-hidden flex flex-col justify-between">
            {/* Header */}
            <div className="bg-[#F8FAFC] border-b border-gray-200 px-1.5 sm:px-2.5 py-1 sm:py-1.5 text-gray-800 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-1 sm:gap-1.5 truncate">
                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-[9px] sm:text-[10px] shrink-0">
                  P
                </div>
                <div className="truncate">
                  <div className="text-[8.5px] sm:text-[10px] font-bold text-gray-900 leading-tight truncate">Priya</div>
                  <div className="text-[6.5px] sm:text-[7.5px] text-gray-500 truncate">SMS</div>
                </div>
              </div>
              <span className="text-blue-600 font-semibold text-[7.5px] sm:text-[8.5px] shrink-0 hidden xs:inline">Details</span>
            </div>

            {/* Notification */}
            <div className="bg-gray-50 border-b border-gray-200 px-1.5 sm:px-2 py-0.5 text-[6.5px] sm:text-[7.5px] flex items-center justify-between text-gray-700 shrink-0">
              <span className="truncate">💬 <strong>Vikram:</strong> Paid</span>
              <span className="bg-blue-600 text-white rounded-full px-1 text-[6px] sm:text-[6.5px] font-bold">1</span>
            </div>

            {/* Message Stream */}
            <div className="flex-1 p-1 sm:p-2 space-y-0.5 sm:space-y-1 text-[7px] sm:text-[8.5px] leading-tight flex flex-col justify-end bg-[#F8FAFC] overflow-hidden">
              <div className="bg-[#E2E8F0] rounded-lg sm:rounded-xl rounded-bl-xs p-1 sm:p-1.5 max-w-[95%] sm:max-w-[90%] text-gray-900 shadow-2xs">
                Available Dec 14?
                <div className="text-[5.5px] sm:text-[6.5px] text-gray-500 text-right mt-0.5">10:14 AM</div>
              </div>
              <div className="bg-[#007AFF] text-white ml-auto rounded-lg sm:rounded-xl rounded-br-xs p-1 sm:p-1.5 max-w-[95%] sm:max-w-[90%] shadow-2xs">
                Yes! ₹1,60,000.
                <div className="text-[5.5px] sm:text-[6.5px] text-blue-100 text-right mt-0.5">Delivered</div>
              </div>
              <div className="bg-[#E2E8F0] rounded-lg sm:rounded-xl rounded-bl-xs p-1 sm:p-1.5 max-w-[95%] sm:max-w-[90%] text-gray-900 shadow-2xs">
                Advance ₹50k sent!
                <div className="text-[5.5px] sm:text-[6.5px] text-gray-500 text-right mt-0.5">10:25 AM</div>
              </div>
              <div className="bg-[#007AFF] text-white ml-auto rounded-lg sm:rounded-xl rounded-br-xs p-1 sm:p-1.5 max-w-[95%] sm:max-w-[90%] shadow-2xs">
                Received! Blocked.
                <div className="text-[5.5px] sm:text-[6.5px] text-blue-100 text-right mt-0.5">Delivered</div>
              </div>
            </div>

            {/* Input Bar */}
            <div className="bg-white px-1.5 sm:px-2 py-0.5 sm:py-1 border-t border-gray-200 flex items-center gap-1 text-[7px] sm:text-[8px] text-gray-500 shrink-0">
              <div className="bg-gray-100 rounded-full px-2 py-0.5 flex-1 text-gray-600 border border-gray-200 truncate text-[6.5px] sm:text-[7.5px]">
                Text Message
              </div>
              <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-[#007AFF] text-white flex items-center justify-center text-[7px] sm:text-[8px] font-bold">
                ↑
              </div>
            </div>
          </div>

        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2A. PROBLEM QUESTION: "Tired of handling business across..."  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          opacity: qContainerOpacity,
          pointerEvents: "none",
        }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3 sm:p-5 md:p-6 text-center select-none w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(250,247,242,0.97)_35%,rgba(250,247,242,0.85)_70%,rgba(250,247,242,0.45)_100%)] backdrop-blur-xs rounded-2xl overflow-hidden"
      >
        <div className="w-full max-w-xl mx-auto my-auto flex flex-col items-center justify-center gap-1 xs:gap-1.5 sm:gap-2.5 md:gap-3 leading-snug px-3 sm:px-6">
          <motion.div style={{ opacity: qLine1Opacity, y: qLine1Y }} className="w-full">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight block text-center leading-[1.15]">
              Tired of handling business
            </span>
          </motion.div>

          <motion.div style={{ opacity: qLine2Opacity, y: qLine2Y }} className="w-full">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight block text-center leading-[1.15]">
              across sheets, notes,
            </span>
          </motion.div>

          <motion.div style={{ opacity: qLine3Opacity, y: qLine3Y }} className="w-full">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight block text-center leading-[1.15]">
              and endless chats?
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 2B. RESOLUTION: "FOCOMAN brings everything together..."       */}
      {/* ───────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          opacity: sContainerOpacity,
          pointerEvents: "none",
        }}
        className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3 sm:p-5 md:p-6 text-center select-none w-full h-full bg-[radial-gradient(ellipse_at_center,rgba(250,247,242,0.97)_35%,rgba(250,247,242,0.85)_70%,rgba(250,247,242,0.45)_100%)] backdrop-blur-xs rounded-2xl overflow-hidden"
      >
        <div className="w-full max-w-xl mx-auto my-auto flex flex-col items-center justify-center gap-1 xs:gap-1.5 sm:gap-2.5 md:gap-3 leading-snug px-3 sm:px-6">
          <motion.div style={{ opacity: sLine1Opacity, y: sLine1Y }} className="w-full flex items-center justify-center gap-2 sm:gap-3.5 flex-wrap">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-brand-orange-primary uppercase tracking-tight inline-block leading-[1.15]">
              FOCOMAN
            </span>
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight inline-block leading-[1.15]">
              brings
            </span>
          </motion.div>

          <motion.div style={{ opacity: sLine2Opacity, y: sLine2Y }} className="w-full">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight block text-center leading-[1.15]">
              everything together
            </span>
          </motion.div>

          <motion.div style={{ opacity: sLine3Opacity, y: sLine3Y }} className="w-full">
            <span className="retro-serif-heading text-xl min-[360px]:text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-[44px] xl:text-[50px] font-black text-[#1C1917] tracking-tight block text-center leading-[1.15]">
              inside a single tool
            </span>
          </motion.div>

          {/* Down Arrow Pointing to Dashboard Preview */}
          <motion.div
            style={{ opacity: sLine3Opacity, y: sLine3Y }}
            className="mt-1 sm:mt-2 text-brand-orange-primary flex items-center justify-center"
          >
            <svg
              className="w-6 h-6 sm:w-8 sm:h-8 md:w-9 md:h-9 stroke-current animate-bounce"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <polyline points="19 12 12 19 5 12" />
            </svg>
          </motion.div>
        </div>
      </motion.div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* Soft White Screen Fade Transition                            */}
      {/* ───────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          opacity: whiteWashOpacity,
          pointerEvents: "none",
        }}
        className="absolute inset-0 z-25 bg-[#FAF7F2]/90 backdrop-blur-md"
      />

      {/* ───────────────────────────────────────────────────────────── */}
      {/* 3. DASHBOARD SECTION: EMERGES BLURRED AND CLARIFIES TO FULL  */}
      {/* ───────────────────────────────────────────────────────────── */}
      <motion.div
        style={{
          opacity: dashboardContainerOpacity,
          scale: dashboardContainerScale,
          filter: dashboardFilter,
        }}
        className="absolute inset-0 p-1 xs:p-1.5 sm:p-2.5 md:p-3 flex flex-col justify-center z-30 overflow-hidden"
      >
        <div className="w-full rounded-xl sm:rounded-2xl border border-[#D8D2C4] sm:border-2 bg-white shadow-[0_12px_40px_rgba(28,25,23,0.10)] overflow-hidden flex flex-col">
          
          {/* ── STAGE 1: DASHBOARD HEADER ── */}
          <motion.div
            style={{
              opacity: headerOpacity,
              y: headerY,
            }}
            className="flex items-center justify-between px-2.5 py-1.5 sm:px-3 sm:py-2 border-b border-border-default bg-[#FAF7F2] shrink-0"
          >
            <div>
              <h2 className="text-xs sm:text-sm lg:text-base font-extrabold text-text-primary tracking-tight">
                Studio Business Dashboard
              </h2>
            </div>
            
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => startAutoplay(16.5)}
                className="inline-flex items-center gap-1 rounded-md border border-[#D8D2C4] bg-white px-2 sm:px-2.5 py-1 text-[9px] sm:text-[11px] font-bold text-[#57534E] shadow-[0_1.5px_0_#C4BCAB] hover:bg-[#FAF7F2] active:translate-y-[1px] active:shadow-none transition cursor-pointer"
                title="Replay transformation animation"
              >
                <span>↺</span>
                <span className="hidden xs:inline">Replay</span>
              </button>
              <span className="hidden sm:inline-flex rounded-xl bg-brand-blue-primary text-white text-xs font-bold py-1.5 px-3 shadow-xs">
                Open OMS →
              </span>
            </div>
          </motion.div>

          {/* Dashboard Body Container */}
          <div className="p-1.5 sm:p-2.5 lg:p-3 bg-white space-y-1 sm:space-y-2">
            
            {/* ── STAGE 2: TOP 3 KPI CARDS ── */}
            <motion.div
              style={{
                opacity: kpiOpacity,
                y: kpiY,
              }}
              className="grid grid-cols-3 gap-1.5 sm:gap-2.5"
            >
              {/* Metric 1: Revenue with trend timeline */}
              <div className="rounded-lg sm:rounded-xl border border-border-default bg-[#FAF7F2]/60 p-1.5 sm:p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Revenue</span>
                  <span className="text-[7px] sm:text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1 sm:px-1.5 py-0.2 rounded border border-emerald-200">
                    +14%
                  </span>
                </div>
                <div className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-lg lg:text-xl font-black text-brand-blue-primary tracking-tight truncate">
                  ₹5,80,000
                </div>
                
                {/* Sparkline curve with timeline dates */}
                <div className="mt-0.5 sm:mt-1 pt-0.5 sm:pt-1 border-t border-border-default/60">
                  <div className="hidden sm:flex items-center justify-between text-[7.5px] font-mono text-text-tertiary">
                    <span>13/9</span>
                    <span>20/9</span>
                    <span>27/9</span>
                    <span className="font-bold text-brand-blue-primary">4/10</span>
                  </div>
                  <div className="h-2 sm:h-3.5 w-full mt-0.5">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 120 20" preserveAspectRatio="none">
                      <path
                        d="M 0 16 Q 30 14, 40 10 T 80 11 T 120 3"
                        fill="none"
                        stroke="#0D9488"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="120" cy="3" r="3" fill="#0D9488" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Metric 2: Orders Count with trend timeline */}
              <div className="rounded-lg sm:rounded-xl border border-border-default bg-[#FAF7F2]/60 p-1.5 sm:p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[7.5px] sm:text-[9px] font-bold uppercase tracking-wider text-text-tertiary">Orders</span>
                  <span className="text-[7px] sm:text-[8.5px] font-bold text-emerald-600 bg-emerald-50 px-1 sm:px-1.5 py-0.2 rounded border border-emerald-200">
                    +20%
                  </span>
                </div>
                <div className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-lg lg:text-xl font-black text-text-primary tracking-tight truncate">
                  6 Orders
                </div>

                {/* Timeline dates */}
                <div className="mt-0.5 sm:mt-1 pt-0.5 sm:pt-1 border-t border-border-default/60">
                  <div className="hidden sm:flex items-center justify-between text-[7.5px] font-mono text-text-tertiary">
                    <span>13/9</span>
                    <span>20/9</span>
                    <span>27/9</span>
                    <span className="font-bold text-text-primary">4/10</span>
                  </div>
                  <div className="h-2 sm:h-3.5 w-full mt-0.5">
                    <svg className="w-full h-full overflow-visible" viewBox="0 0 120 20" preserveAspectRatio="none">
                      <path
                        d="M 0 15 Q 30 16, 40 12 T 80 9 T 120 4"
                        fill="none"
                        stroke="#E85D04"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />
                      <circle cx="120" cy="4" r="3" fill="#E85D04" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Metric 3: Pending Collections */}
              <div className="rounded-lg sm:rounded-xl border border-amber-200 bg-amber-50/50 p-1.5 sm:p-2.5">
                <span className="text-[7px] xs:text-[7.5px] sm:text-[9px] font-bold uppercase tracking-tight sm:tracking-wider text-brand-orange-primary block leading-tight">
                  Pending Collections
                </span>
                <div className="mt-0.5 sm:mt-1 text-xs sm:text-base md:text-lg lg:text-xl font-black text-brand-orange-primary tracking-tight truncate">
                  ₹1,80,000
                </div>
                <p className="mt-0.5 text-[7px] sm:text-[8.5px] text-amber-900/80 font-medium leading-tight truncate hidden xs:block">
                  Outstanding balance
                </p>
              </div>
            </motion.div>

            {/* ── STAGE 3: ORDER STATUS ACTION CHIPS ── */}
            <motion.div
              style={{
                opacity: filtersOpacity,
                x: filtersX,
              }}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[8px] sm:text-[9.5px] font-bold uppercase tracking-wider text-text-secondary">
                  Order Status Filters
                </span>
                <span className="text-[7px] sm:text-[8.5px] text-text-tertiary hidden xs:inline">
                  Click status to filter
                </span>
              </div>
              <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto pb-0.5 sm:pb-0">
                <span className="whitespace-nowrap rounded-lg border border-brand-blue-primary bg-brand-blue-background/40 px-1.5 sm:px-2 py-0.5 text-[7.5px] sm:text-[8.5px] font-bold text-brand-blue-primary shadow-2xs">
                  All (6)
                </span>
                <span className="whitespace-nowrap rounded-lg border border-brand-blue-soft bg-white px-1.5 sm:px-2 py-0.5 text-[7.5px] sm:text-[8.5px] font-semibold text-text-secondary">
                  Awaiting (1)
                </span>
                <span className="whitespace-nowrap rounded-lg border border-brand-orange-soft bg-brand-orange-background/30 px-1.5 sm:px-2 py-0.5 text-[7.5px] sm:text-[8.5px] font-bold text-brand-orange-primary">
                  In Progress (4)
                </span>
                <span className="whitespace-nowrap rounded-lg border border-emerald-200 bg-emerald-50 px-1.5 sm:px-2 py-0.5 text-[7.5px] sm:text-[8.5px] font-bold text-emerald-700">
                  Completed (1)
                </span>
              </div>
            </motion.div>

            {/* ── STAGE 4: AUTHENTIC ORDERS TABLE ── */}
            <motion.div
              style={{
                opacity: tableOpacity,
                y: tableY,
              }}
              className="rounded-lg sm:rounded-xl border border-border-default bg-white overflow-hidden shadow-2xs"
            >
              <div className="w-full overflow-hidden">
                <table className="w-full table-fixed text-left border-collapse text-[6.5px] xs:text-[7px] sm:text-[8.5px]">
                  <thead>
                    <tr className="bg-[#FAF7F2] text-text-secondary font-bold border-b border-border-default uppercase tracking-wider text-[5.5px] xs:text-[6.5px] sm:text-[8px] leading-tight">
                      <th className="w-[22%] sm:w-[24%] py-1 sm:py-1.5 px-0.5 sm:px-1.5 whitespace-normal break-words">Order</th>
                      <th className="w-[19%] sm:w-[20%] py-1 sm:py-1.5 px-0.5 sm:px-1.5 whitespace-normal break-words">Customer</th>
                      <th className="w-[11%] sm:w-[12%] py-1 sm:py-1.5 px-0.5 sm:px-1.5 whitespace-normal break-words">Event</th>
                      <th className="w-[12%] sm:w-[12%] py-1 sm:py-1.5 px-0.5 sm:px-1.5 whitespace-normal break-words">Date</th>
                      <th className="w-[18%] sm:w-[17%] py-1 sm:py-1.5 px-0.5 sm:px-1.5 whitespace-normal break-words">Status</th>
                      <th className="w-[9%] sm:w-[8%] py-1 sm:py-1.5 px-0.5 sm:px-1 text-right whitespace-normal break-words">Amount</th>
                      <th className="w-[9%] sm:w-[7%] py-1 sm:py-1.5 px-0.5 sm:px-1 text-right whitespace-normal break-words">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-default/60 font-mono text-[6.5px] xs:text-[7px] sm:text-[8.5px]">
                    <tr className="hover:bg-[#FAF7F2] transition">
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-bold text-brand-blue-primary truncate">ORD-TES-261008-010906</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans font-semibold text-text-primary truncate">Priya and Arjun</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans text-text-secondary truncate">Wedding</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 text-text-tertiary truncate">2026-10-07</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 truncate">
                        <span className="badge-brand-orange text-[5.5px] xs:text-[6.5px] sm:text-[7.5px] py-0.2 px-0.5 sm:px-1 inline-block truncate max-w-full">Post-Event In Progress</span>
                      </td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-text-primary truncate">₹1,50,000</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-brand-orange-primary truncate">₹50,000</td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2] transition">
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-bold text-brand-blue-primary truncate">ORD-TES-261008-004803</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans font-semibold text-text-primary truncate">Vikram Sharma</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans text-text-secondary truncate">Reception</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 text-text-tertiary truncate">2026-10-06</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 truncate">
                        <span className="badge-brand-orange text-[5.5px] xs:text-[6.5px] sm:text-[7.5px] py-0.2 px-0.5 sm:px-1 inline-block truncate max-w-full">Post-Event In Progress</span>
                      </td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-text-primary truncate">₹80,000</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-brand-orange-primary truncate">₹30,000</td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2] transition bg-amber-50/20">
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-bold text-brand-blue-primary truncate">ORD-TES-261008-003234</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans font-bold text-text-primary truncate">Siva Krishna</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans text-text-secondary truncate">Wedding</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 text-text-tertiary truncate">2026-10-07</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 truncate">
                        <span className="badge-brand-orange text-[5.5px] xs:text-[6.5px] sm:text-[7.5px] py-0.2 px-0.5 sm:px-1 inline-block truncate max-w-full">Post-Event In Progress</span>
                      </td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-text-primary truncate">₹3,20,000</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-black text-brand-orange-primary truncate">₹1,00,000</td>
                    </tr>
                    <tr className="hover:bg-[#FAF7F2] transition">
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-bold text-brand-blue-primary truncate">ORD-TES-261007-235733</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans font-semibold text-text-primary truncate">Ananya and Rohit</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 font-sans text-text-secondary truncate">Wedding</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 text-text-tertiary truncate">2026-10-14</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1.5 truncate">
                        <span className="badge-brand-blue text-[5.5px] xs:text-[6.5px] sm:text-[7.5px] py-0.2 px-0.5 sm:px-1 inline-block truncate max-w-full">Awaiting Event</span>
                      </td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-text-primary truncate">₹2,50,000</td>
                      <td className="py-0.5 sm:py-1.5 px-0.5 sm:px-1 text-right font-bold text-emerald-700 bg-emerald-50/60 truncate">Paid</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </motion.div>

          </div>

        </div>
      </motion.div>

    </div>
  );
}
