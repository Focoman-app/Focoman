import type { Metadata } from "next";
import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { FocomanShieldWatermark } from "@/components/FocomanLogo";
import { ModuleAccordion } from "@/components/public/ModuleAccordion";
import { PricingTwoPanels } from "@/components/public/PricingTwoPanels";
import { ValueAddedServices } from "@/components/public/ValueAddedServices";
import { FaqAccordion } from "@/components/public/FaqAccordion";
import { StructuredData } from "@/components/public/StructuredData";
import { PwaInstallFloatingWidget } from "@/components/public/PwaInstallFloatingWidget";
import { RetroHeroVisual } from "@/components/home/RetroHeroVisual";
import { getPlatformPublicStats } from "@focoman/db";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://focoman.web.app";

export const metadata: Metadata = {
  title: "Focoman",
  description:
    "Eliminate scattered WhatsApp chats, spreadsheets, and paper notebooks. Focoman brings orders, shoot schedules, dynamic service workflows, crew planning, offline payments, and client deliveries into one unified system.",
  alternates: {
    canonical: baseUrl,
  },
  openGraph: {
    title: "Focoman — Complete Business Operating System for Photography Studios",
    description:
      "Eliminate scattered WhatsApp chats, spreadsheets, and paper notebooks. Focus beyond the frames with Focoman.",
    url: baseUrl,
    siteName: "Focoman",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Focoman — Business Operating System for Photography Studios",
    description:
      "Bring your studio's work, people, and orders together in one place and spend less time managing the work, more time creating.",
  },
};

export default async function HomePage() {
  const stats = await getPlatformPublicStats();

  return (
    <div className="min-h-screen bg-[#FAF7F2] text-[#1C1917] selection:bg-brand-orange-soft">
      {/* JSON-LD Structured Data */}
      <StructuredData />

      {/* 1. Header Navigation */}
      <Navbar />

      <main id="main-content">
        {/* 2. Hero Section */}
        <section
          id="home"
          className="relative min-h-[135vh] sm:min-h-[160vh] lg:min-h-[190vh] border-b border-[#D8D2C4] bg-[#FAF7F2]"
        >
          <div className="sticky top-0 min-h-[calc(100dvh-3.5rem)] lg:min-h-screen flex flex-col justify-center items-center overflow-hidden bg-gradient-to-b from-[#FAF7F2] via-white to-[#FAF7F2] px-3 xs:px-4 sm:px-6 lg:px-8 py-2.5 xs:py-3.5 sm:py-6 lg:py-0">
            <div className="relative z-10 mx-auto max-w-7xl w-full my-auto">
              <div className="grid gap-3.5 xs:gap-5 sm:gap-8 lg:gap-10 xl:gap-12 lg:grid-cols-12 lg:items-center">
                {/* Left Column: Hero Copy & Actions */}
                <div className="lg:col-span-5 xl:col-span-5 text-center lg:text-left relative z-30">
                  {/* Brand themed badge */}
                  <div className="inline-flex items-center gap-1.5 sm:gap-2 mb-1.5 xs:mb-2 sm:mb-4 px-2.5 py-0.5 sm:py-1 rounded-full bg-brand-orange-background border border-brand-orange-soft">
                    <span className="font-mono text-[9.5px] xs:text-[10px] sm:text-xs font-bold uppercase tracking-[0.16em] sm:tracking-[0.2em] text-brand-orange-primary">
                      [ Focus beyond the frames ]
                    </span>
                  </div>

                  <h1 className="retro-serif-heading text-2xl sm:text-4xl md:text-5xl lg:text-[46px] xl:text-[54px] font-black leading-[1.12] lg:leading-[1.08] tracking-tight text-[#1C1917]">
                    Run your studio,{" "}
                    <span className="text-brand-orange-primary underline decoration-brand-orange-soft decoration-[4px] sm:decoration-[6px] underline-offset-[6px] sm:underline-offset-[10px]">
                      effortlessly.
                    </span>
                  </h1>

                  <p className="mx-auto lg:mx-0 mt-1.5 xs:mt-2.5 sm:mt-4 max-w-lg text-xs sm:text-sm md:text-base lg:text-lg text-[#57534E] leading-relaxed font-normal">
                    Bring your studio’s work, people, and orders together in one place and spend less time managing the work, more time creating.
                  </p>

                  {/* Hero CTA Buttons - Isolated & elevated to prevent any visual overlap */}
                  <div className="mt-3 xs:mt-4 sm:mt-6 relative z-30 flex flex-col xs:flex-row items-stretch sm:items-center justify-center lg:justify-start gap-2 sm:gap-3.5">
                    <Link
                      href="/sign-in"
                      className="text-center rounded-xl bg-[#E85D04] px-4 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm md:text-base font-bold text-white shadow-[0_3px_0_#B84600] active:translate-y-[2px] active:shadow-none transition hover:bg-[#D95304] flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>Start 30-Day Free Trial</span>
                      <span>→</span>
                    </Link>
                    <Link
                      href="/#how-it-works"
                      className="text-center rounded-xl border border-[#D8D2C4] bg-white px-4 py-2.5 sm:px-6 sm:py-3.5 text-xs sm:text-sm md:text-base font-bold text-[#1C1917] shadow-[0_2px_0_#C4BCAB] active:translate-y-[2px] active:shadow-none transition hover:bg-[#FAF7F2] flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0"
                    >
                      <span>▶ How It Works</span>
                      <span className="text-[#8C857B]">↓</span>
                    </Link>
                  </div>
                </div>

                {/* Right Column: Symmetrical Unified Studio Visual */}
                <div className="lg:col-span-7 xl:col-span-7 flex items-center justify-center w-full relative z-10 overflow-hidden">
                  <RetroHeroVisual />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Challenge & Solution Section (Why Focoman / Modules) */}
        <section id="modules" className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 pt-6 pb-12 sm:pt-10 sm:pb-16 scroll-mt-14 sm:scroll-mt-16">
          <span id="challenge" className="sr-only" />
          <div className="mx-auto max-w-3xl text-center mb-6 sm:mb-10">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-orange-primary px-3 py-1 rounded-full bg-brand-orange-background border border-brand-orange-soft">
              [ Why Focoman? ]
            </span>
            <h2 className="retro-serif-heading mt-3 text-2xl font-black tracking-tight text-[#1C1917] sm:text-3xl lg:text-4xl">
              Eliminate Scattered WhatsApp Chats, Spreadsheets and Paper Notebooks
            </h2>
            <p className="mx-auto mt-4 text-xs sm:text-base leading-relaxed text-[#57534E]">
              Photography studio owners lose countless hours tracking shoots, chasing deliverables, and managing payments across fragmented tools. Focoman unifies your entire operation into a single, modular system.
            </p>
          </div>

          <div className="mt-8 sm:mt-12">
            <ModuleAccordion />
          </div>
        </section>

        {/* 4. How Focoman Works */}
        <section id="how-it-works" className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-[#D8D2C4] bg-[#FAF7F2]">
          <div className="mx-auto max-w-3xl text-center mb-10 sm:mb-14">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-purple-primary px-3 py-1 rounded-full bg-brand-purple-background border border-brand-purple-soft">
              [ HOW FOCOMAN WORKS ]
            </span>
            <h2 className="retro-serif-heading mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1C1917]">
              A Clear Workflow for Every Stage of Your Studio
            </h2>
            <p className="mx-auto mt-3 text-xs sm:text-base text-[#57534E]">
              All your studio operations stay connected through a structured workflow pipeline, keeping every stage organized, clear, and easy to manage.
            </p>
          </div>

          <div className="mx-auto max-w-3xl">
            <div className="flex flex-col gap-4 relative">
              {/* Connecting Line */}
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-[#D8D2C4] hidden sm:block" aria-hidden="true" />

              {/* Stage 1 */}
              <div className="relative rounded-xl border border-[#D8D2C4] bg-[#FFFDF9] p-4 sm:p-6 shadow-[0_2px_0_#C4BCAB] flex flex-col sm:flex-row items-start gap-4">
                <span className="relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-pink-50 font-mono text-sm font-bold text-pink-700 border border-pink-200">
                  01
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#1C1917]">
                      Studio Discovery and Booking Request
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-pink-700 bg-pink-50 px-2 py-0.5 rounded border border-pink-200 hidden sm:inline-block">
                      Discovery
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                    Client discovers an independent studio profile, explores its packages and pricing, and submits a booking inquiry.
                  </p>
                </div>
              </div>

              {/* Stage 2 */}
              <div className="relative rounded-xl border border-[#D8D2C4] bg-[#FFFDF9] p-4 sm:p-6 shadow-[0_2px_0_#C4BCAB] flex flex-col sm:flex-row items-start gap-4">
                <span className="relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-brand-blue-background font-mono text-sm font-bold text-brand-blue-primary border border-brand-blue-soft">
                  02
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#1C1917]">
                      Review and Booking Confirmation
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue-primary bg-brand-blue-background px-2 py-0.5 rounded border border-brand-blue-soft hidden sm:inline-block">
                      Booking
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                    Studio reviews the booking request, checks the event date and required availability, and confirms the booking after advance payment verification.
                  </p>
                </div>
              </div>

              {/* Stage 3 */}
              <div className="relative rounded-xl border border-[#D8D2C4] bg-[#FFFDF9] p-4 sm:p-6 shadow-[0_2px_0_#C4BCAB] flex flex-col sm:flex-row items-start gap-4">
                <span className="relative z-10 flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 font-mono text-sm font-bold text-emerald-700 border border-emerald-200">
                  03
                </span>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-[#1C1917]">
                      Shoot, Production and Delivery
                    </h3>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 hidden sm:inline-block">
                      Production
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                    After the shoot, Focoman guides the order through photo selection, editing, customer review, and final album delivery until the order is completed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Studio Marketplace Showcase Section */}
        <section id="studios" className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-[#D8D2C4]">
          <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-[#FDBA74] bg-gradient-to-br from-[#FFF5EA] via-[#FED7AA]/50 to-[#FFEDD5] p-6 sm:p-10 lg:p-14 text-center shadow-[0_4px_0_#E0A96D]">
            <div className="relative z-10 mx-auto max-w-3xl">
              <span className="inline-flex items-center rounded-full bg-[#FFFDF9] border border-[#FDBA74] px-3.5 py-1 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-[#C2410C] shadow-2xs mb-3 sm:mb-4">
                [ STUDIO MARKETPLACE ]
              </span>
              <h2 className="retro-serif-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#431407]">
                Showcase Your Studio. Get Discovered.
              </h2>
              <p className="mt-3 text-xs sm:text-base text-[#7C2D12] leading-relaxed max-w-2xl mx-auto font-medium">
                Showcase packages, pricing, and live date availability for booking inquiries, while your client records, orders, and studio financials remain completely private.
              </p>

              {/* Metric Counts Panels */}
              <div className="mt-6 mb-6 sm:mt-8 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-6 max-w-md sm:max-w-lg mx-auto">
                <div className="rounded-xl border-2 border-[#FDBA74] bg-[#FFFDF9] p-4 sm:p-6 text-center shadow-[0_2px_0_#E0A96D] flex flex-col justify-center items-center">
                  <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#9A3412]">
                    Total Studios Listed
                  </span>
                  <span className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-black text-[#EA580C] tracking-tight">
                    {stats.marketplaceStudiosCount}
                  </span>
                </div>
                <div className="rounded-xl border-2 border-[#FDBA74] bg-[#FFFDF9] p-4 sm:p-6 text-center shadow-[0_2px_0_#E0A96D] flex flex-col justify-center items-center">
                  <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#9A3412]">
                    Total Collective Leads
                  </span>
                  <span className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-black text-[#C2410C] tracking-tight">
                    {stats.marketplaceLeadsCount}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/studios"
                  className="w-full sm:w-auto rounded-xl bg-[#EA580C] px-6 py-3 text-center text-xs sm:text-sm font-bold text-white shadow-[0_3px_0_#9A3412] active:translate-y-[2px] active:shadow-none transition hover:bg-[#C2410C]"
                >
                  Explore Studio Marketplace
                </Link>
                <Link
                  href="/sign-in"
                  className="w-full sm:w-auto rounded-xl border-2 border-[#E0A96D] bg-[#FFFDF9] px-6 py-3 text-center text-xs sm:text-sm font-bold text-[#431407] shadow-[0_2px_0_#D49B60] active:translate-y-[2px] active:shadow-none transition hover:bg-white"
                >
                  Publish Your Studio
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 7. Pricing Section */}
        <section id="pricing" className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-[#D8D2C4]">
          <div className="mx-auto max-w-3xl text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-blue-primary px-3 py-1 rounded-full bg-brand-blue-background border border-brand-blue-soft">
              [ SIMPLE, TRANSPARENT PRICING ]
            </span>
            <h2 className="retro-serif-heading mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1C1917]">
              Choose the Plan That Fits Your Studio
            </h2>
            <p className="mx-auto mt-3 text-xs sm:text-base text-[#57534E]">
              Start with the essentials and move to more advanced studio operations as your needs grow.
            </p>
          </div>

          <PricingTwoPanels />
        </section>

        {/* 8. Value-Added Services Section */}
        <ValueAddedServices />

        {/* 9. FAQ Section */}
        <section id="faq" className="mx-auto max-w-4xl px-3.5 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-[#D8D2C4]">
          <div className="text-center mb-8 sm:mb-12">
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-brand-blue-primary px-3 py-1 rounded-full bg-brand-blue-background border border-brand-blue-soft">
              [ COMMON QUESTIONS ]
            </span>
            <h2 className="retro-serif-heading mt-3 text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-[#1C1917]">
              Frequently Asked Questions
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-[#57534E]">
              Honest, transparent answers about how Focoman operates.
            </p>
          </div>

          <FaqAccordion />
        </section>

        {/* 10. Final CTA Section */}
        <section id="cta" className="mx-auto max-w-7xl px-3.5 sm:px-6 lg:px-8 py-12 sm:py-20 border-t border-[#D8D2C4]">
          <div className="rounded-2xl sm:rounded-3xl border border-brand-blue-primary/30 bg-gradient-to-br from-brand-blue-primary via-sky-600 to-indigo-700 p-6 sm:p-10 lg:p-14 text-center text-white shadow-md relative overflow-hidden">
            <FocomanShieldWatermark className="pointer-events-none absolute right-0 top-0 h-96 w-96 translate-x-20 -translate-y-20 opacity-10" />

            <div className="relative z-10 mx-auto max-w-2xl">
              <span className="inline-block rounded-full bg-white/20 px-3.5 py-1 font-mono text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-white backdrop-blur-xs mb-3 sm:mb-4">
                [ Ready to Focus Beyond the Frames? ]
              </span>
              <h2 className="retro-serif-heading text-2xl sm:text-3xl lg:text-4xl font-black tracking-tight text-white">
                Transform Your Studio Operations Today
              </h2>
              <p className="mt-3 text-xs sm:text-base text-white/90 leading-relaxed">
                Join photography studios running their orders, crew workflows, and deliveries with peace of mind. Start your 30-day full trial with zero risk.
              </p>

              {/* Metric Counts Panels */}
              <div className="mt-6 mb-6 sm:mt-8 sm:mb-8 grid grid-cols-2 gap-3 sm:gap-6 max-w-md sm:max-w-lg mx-auto">
                <div className="rounded-xl border border-white/25 bg-white/15 backdrop-blur-md p-4 sm:p-6 text-center shadow-xs flex flex-col justify-center items-center">
                  <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/90">
                    Total Studios Active
                  </span>
                  <span className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-black text-white tracking-tight">
                    {stats.activeStudiosCount}
                  </span>
                </div>
                <div className="rounded-xl border border-white/25 bg-white/15 backdrop-blur-md p-4 sm:p-6 text-center shadow-xs flex flex-col justify-center items-center">
                  <span className="font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white/90">
                    Total Orders Registered
                  </span>
                  <span className="mt-1 sm:mt-2 text-3xl sm:text-5xl font-black text-emerald-300 tracking-tight">
                    {stats.registeredOrdersCount}
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
                <Link
                  href="/sign-in"
                  className="w-full sm:w-auto rounded-xl bg-white px-8 py-3.5 text-xs sm:text-sm font-bold text-brand-blue-primary shadow-sm active:translate-y-[2px] transition hover:bg-slate-50"
                >
                  Start 30-Day Free Trial →
                </Link>
              </div>

              <p className="mt-3 text-[10px] sm:text-[11px] text-white/80">
                No credit card required
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D8D2C4] bg-[#FAF7F2] py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#78716C]">
            <p>© 2026 Focoman. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2"><Link href="/terms" className="hover:underline">Terms</Link><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/billing-and-refunds" className="hover:underline">Billing and refunds</Link></div>
          </div>
        </div>
      </footer>

      {/* Floating Bottom-Right Collapsible PWA Install Button */}
      <PwaInstallFloatingWidget />
    </div>
  );
}
