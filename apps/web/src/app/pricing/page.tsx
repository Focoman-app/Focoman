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
            Flexible Capability Pricing
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            Simple &amp; Flexible Studio Pricing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-text-secondary">
            Basic Order Management &amp; Studio Marketplace are 100% Free for everyone. Upgrade to the ₹999/month or ₹1,999/month plan as your studio operations grow.
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
              Have questions about our free tier, modular capabilities, or billing? Find quick answers below.
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
            <p>Built for professional photography studios.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
