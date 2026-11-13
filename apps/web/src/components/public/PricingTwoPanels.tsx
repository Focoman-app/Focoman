"use client";

import Link from "next/link";
import { FREE_CORE_CAPABILITY } from "@focoman/config";

interface PricingTwoPanelsProps {
  hasMultiStudios?: boolean;
}

export function PricingTwoPanels({ hasMultiStudios = false }: PricingTwoPanelsProps) {
  return (
    <div className="space-y-12">

      {/* Multi-Studio Workspace Notice (Only shown if user has multiple studio profiles) */}
      {hasMultiStudios && (
        <div className="rounded-2xl border border-brand-blue-primary/40 bg-brand-blue-background p-4 text-center max-w-2xl mx-auto shadow-[0_2px_0_#C4BCAB]">
          <h4 className="font-mono text-xs font-extrabold text-brand-blue-primary uppercase tracking-wider">
            [ Studio-Scoped Workspace Pricing ]
          </h4>
          <p className="mt-1 text-xs text-[#57534E]">
            Capabilities belong to each individual studio workspace. Configure different capabilities per studio profile.
          </p>
        </div>
      )}

      {/* 3 Similarly Designed Side-by-Side Panels */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* PANEL 1: FREE (₹0) */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-[#D8D2C4] bg-[#FFFDF9] p-6 sm:p-8 shadow-[0_3px_0_#C4BCAB] hover:border-[#BFB8A7] transition-all duration-200 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header / Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-block rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-widest text-emerald-800 shadow-2xs">
                [ FREE ]
              </span>
            </div>

            <div>
              <h2 className="retro-serif-heading text-2xl sm:text-3xl font-black text-[#1C1917]">
                Basic Order Management
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                Essential Order Management System for photography and videography studios.
              </p>
            </div>

            {/* Price */}
            <div className="rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] p-4 flex items-baseline justify-between shadow-[0_1px_0_#D8D2C4]">
              <div>
                <span className="font-mono text-xs font-semibold text-[#8C857B] block">Free Plan</span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="retro-serif-heading text-3xl sm:text-4xl font-black tracking-tight text-[#1C1917]">₹0</span>
                  <span className="font-mono text-xs text-[#57534E] font-medium">/forever</span>
                </div>
              </div>
            </div>

            {/* Feature List */}
            <div className="space-y-3 pt-2">
              <span className="font-mono text-xs font-bold text-[#1C1917] uppercase tracking-wider block">
                Included Features:
              </span>
              <div className="space-y-2.5 text-xs text-[#57534E]">
                {FREE_CORE_CAPABILITY.features.map((feat, idx) => (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">
                      ✓
                    </span>
                    <span className="text-[#1C1917] font-medium leading-tight">{feat}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-8 pt-6 border-t border-[#D8D2C4]">
            <Link
              href="/sign-in"
              className="w-full rounded-xl bg-[#1C1917] px-6 py-3.5 text-xs font-bold text-white shadow-[0_3px_0_#0F172A] active:translate-y-[2px] active:shadow-none transition hover:bg-[#2C2825] flex items-center justify-center gap-2"
            >
              <span>Get Started Free</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* PANEL 2: ₹999/MONTH PLAN */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-brand-orange-soft bg-gradient-to-br from-[#FFFDF9] via-orange-50/30 to-[#FFFDF9] p-6 sm:p-8 shadow-[0_3px_0_#C4BCAB] hover:border-brand-orange-primary/60 transition-all duration-200 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header / Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-block rounded-full bg-brand-orange-background border border-brand-orange-soft px-3.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-widest text-brand-orange-primary shadow-2xs">
                [ STARTER ]
              </span>
            </div>

            <div>
              <h2 className="retro-serif-heading text-2xl sm:text-3xl font-black text-[#1C1917]">
                Advanced OMS, CRM and Studio Operations
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                Includes everything in the Free plan, plus Google Drive preview and selection, customer management, studio operations, and Basic Business Dashboard.
              </p>
            </div>

            {/* Price */}
            <div className="rounded-xl border border-brand-orange-soft bg-brand-orange-background/50 p-4 flex items-baseline justify-between shadow-[0_1px_0_#E8D7C8]">
              <div>
                <span className="font-mono text-xs font-semibold text-[#8C857B] block">Monthly Plan</span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="retro-serif-heading text-3xl sm:text-4xl font-black tracking-tight text-brand-orange-primary">₹999</span>
                  <span className="font-mono text-xs text-[#57534E] font-medium">/month</span>
                </div>
              </div>
            </div>

            {/* Feature Overview */}
            <div className="space-y-3 pt-2">
              <span className="font-mono text-xs font-bold text-[#1C1917] uppercase tracking-wider block">
                Everything in Free, plus:
              </span>
              <div className="space-y-2.5 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-extrabold text-brand-orange-primary mt-0.5 border border-orange-200">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Google Drive Photo In-App Preview and Selection
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-extrabold text-brand-orange-primary mt-0.5 border border-orange-200">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Customer Relations - CRM
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-extrabold text-brand-orange-primary mt-0.5 border border-orange-200">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Studio Operations - ERP
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-[11px] font-extrabold text-brand-orange-primary mt-0.5 border border-orange-200">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Basic Business Dashboard with order counts, revenue overview, and pending payment overview
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button to Checkout Page */}
          <div className="mt-8 pt-6 border-t border-[#D8D2C4]">
            <Link
              href="/checkout?plan=starter"
              className="w-full rounded-xl bg-brand-orange-primary px-6 py-3.5 text-xs font-bold text-white shadow-[0_3px_0_#B84600] active:translate-y-[2px] active:shadow-none transition hover:bg-orange-600 flex items-center justify-center gap-2"
            >
              <span>Review Starter Plan</span>
              <span>→</span>
            </Link>
          </div>
        </div>

        {/* PANEL 3: ₹1,999/MONTH PLAN */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-[#D8D2C4] bg-[#FFFDF9] p-6 sm:p-8 shadow-[0_3px_0_#C4BCAB] hover:border-[#BFB8A7] transition-all duration-200 flex flex-col justify-between">
          <div className="space-y-6">
            {/* Header / Badge */}
            <div className="flex items-center justify-between">
              <span className="inline-block rounded-full bg-brand-blue-background border border-brand-blue-soft px-3.5 py-1 font-mono text-[11px] font-extrabold uppercase tracking-widest text-brand-blue-primary shadow-2xs">
                [ PROFESSIONAL ]
              </span>
            </div>

            <div>
              <h2 className="retro-serif-heading text-2xl sm:text-3xl font-black text-[#1C1917]">
                WhatsApp Operations and Business Reports
              </h2>
              <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                Includes everything in the ₹999 plan, plus WhatsApp operations, interactive studio bot, and exportable business reports.
              </p>
            </div>

            {/* Price */}
            <div className="rounded-xl border border-[#D8D2C4] bg-[#FAF7F2] p-4 flex items-baseline justify-between shadow-[0_1px_0_#D8D2C4]">
              <div>
                <span className="font-mono text-xs font-semibold text-[#8C857B] block">Monthly Plan</span>
                <div className="mt-0.5 flex items-baseline gap-1">
                  <span className="retro-serif-heading text-3xl sm:text-4xl font-black tracking-tight text-[#1C1917]">₹1,999</span>
                  <span className="font-mono text-xs text-[#57534E] font-medium">/month</span>
                </div>
              </div>
            </div>

            {/* Feature Overview */}
            <div className="space-y-3 pt-2">
              <span className="font-mono text-xs font-bold text-[#1C1917] uppercase tracking-wider block">
                Everything in ₹999 Plan, plus:
              </span>
              <div className="space-y-2.5 text-xs text-[#57534E]">
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    WhatsApp Operations and Interactive Bot
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Advanced Business Reports and Analytics
                  </span>
                </div>

                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">
                    ✓
                  </span>
                  <span className="text-[#1C1917] font-medium leading-tight">
                    Excel Report Exports
                  </span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">✓</span>
                  <span className="text-[#1C1917] font-medium leading-tight">Invoices and Receipts</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-extrabold text-emerald-700 mt-0.5 border border-emerald-300">✓</span>
                  <span className="text-[#1C1917] font-medium leading-tight">Multi-Channel Leads</span>
                </div>
              </div>
            </div>
          </div>

          {/* CTA Button to Checkout Page */}
          <div className="mt-8 pt-6 border-t border-[#D8D2C4]">
            <Link
              href="/checkout?plan=professional"
              className="w-full rounded-xl bg-[#1C1917] px-6 py-3.5 text-xs font-bold text-white shadow-[0_3px_0_#0F172A] active:translate-y-[2px] active:shadow-none transition hover:bg-[#2C2825] flex items-center justify-center gap-2"
            >
              <span>Review Professional Plan</span>
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
