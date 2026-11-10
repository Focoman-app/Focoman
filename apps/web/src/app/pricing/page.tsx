import { Navbar } from "@/components/Navbar";
import { PricingTwoPanels } from "@/components/public/PricingTwoPanels";
import { FaqAccordion } from "@/components/public/FaqAccordion";
import Link from "next/link";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      {/* Page Hero */}
      <section className="border-b border-border-divider bg-gradient-to-b from-white to-surface-app px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-brand-orange-soft bg-brand-orange-background px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-orange-primary">
            Studio plans
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
              Studio Pricing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-secondary">
            Choose Free, Starter, or Professional based on the tools your studio needs. Review plan scope and billing terms before selecting a paid plan.
          </p>
        </div>
      </section>

      {/* Pricing Cards & Guarantees */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 space-y-16">
        <PricingTwoPanels />

        {/* FAQ Section */}
        <div id="faq" className="space-y-6 pt-8 border-t border-border-divider">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
              FREQUENTLY ASKED QUESTIONS
            </span>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-text-primary">
              Everything You Need to Know
            </h2>
            <p className="text-sm text-text-secondary">
              Have questions about plans, included features or billing? Find quick answers below.
            </p>
          </div>
          <FaqAccordion />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-divider bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-tertiary">
            <p>© {new Date().getFullYear()} Focoman. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2"><Link href="/terms" className="hover:underline">Terms</Link><Link href="/privacy" className="hover:underline">Privacy</Link><Link href="/billing-and-refunds" className="hover:underline">Billing and refunds</Link></div>
          </div>
        </div>
      </footer>
    </div>
  );
}
