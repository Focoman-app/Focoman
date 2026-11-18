import { Navbar } from "@/components/Navbar";
import Link from "next/link";

export const metadata = {
  title: "Contact Us | Focoman",
  description: "Get in touch with the Focoman support team. Support email, operating hours, and office address.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      {/* Hero */}
      <section className="border-b border-border-divider bg-gradient-to-b from-white to-surface-app px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-brand-orange-soft bg-brand-orange-background px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-orange-primary">
            Customer Support
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            Contact Us
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base text-text-secondary sm:text-lg">
            Have questions about Focoman studio plans, billing, or integrations? We&apos;re here to help.
          </p>
        </div>
      </section>

      {/* Contact Cards */}
      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          {/* Email Support */}
          <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-blue-background text-brand-blue-primary text-xl">
              ✉
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-text-primary">Email Support</h2>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              For support, billing enquiries, cancellations, or account questions:
            </p>
            <a
              href="mailto:support@focoman.com"
              className="mt-4 inline-block font-mono text-sm font-bold text-brand-blue-primary hover:underline"
            >
              support@focoman.com
            </a>
            <p className="mt-2 text-[11px] text-text-tertiary">
              Typical response time: within 24 business hours.
            </p>
          </div>

          {/* Operating Hours */}
          <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-brand-orange-primary text-xl">
              🕒
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-text-primary">Operating Hours</h2>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              Our support team is available during Indian Standard Time (IST):
            </p>
            <div className="mt-4 space-y-1 text-xs font-semibold text-text-primary">
              <p>Monday – Saturday</p>
              <p className="text-text-secondary font-normal">9:00 AM – 6:00 PM IST</p>
            </div>
            <p className="mt-3 text-[11px] text-text-tertiary">
              Closed on national holidays.
            </p>
          </div>

          {/* Office Address */}
          <div className="rounded-3xl border border-border-default bg-white p-6 sm:p-8 shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 text-xl">
              📍
            </div>
            <h2 className="mt-5 text-lg font-extrabold text-text-primary">Office Address</h2>
            <p className="mt-2 text-xs text-text-secondary leading-relaxed">
              Focoman (MSME / Udyam Registered)
            </p>
            <address className="mt-4 not-italic text-xs text-text-secondary leading-relaxed">
              Manapparai, Tiruchirappalli District,<br />
              Tamil Nadu – 621306,<br />
              India.
            </address>
          </div>
        </div>

        {/* Legal Policy Links */}
        <div className="mt-12 rounded-3xl border border-border-default bg-white p-6 sm:p-8 text-center shadow-xs">
          <h3 className="text-sm font-extrabold text-text-primary">Help &amp; Legal Policies</h3>
          <p className="mt-1 text-xs text-text-secondary">
            Read our operating policies, service agreements, and payment terms:
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-4 text-xs font-bold text-brand-blue-primary">
            <Link href="/terms" className="rounded-xl border border-border-default bg-surface-app px-4 py-2 hover:bg-slate-50">
              Terms of Service
            </Link>
            <Link href="/privacy" className="rounded-xl border border-border-default bg-surface-app px-4 py-2 hover:bg-slate-50">
              Privacy Policy
            </Link>
            <Link href="/billing-and-refunds" className="rounded-xl border border-border-default bg-surface-app px-4 py-2 hover:bg-slate-50">
              Billing, Cancellation &amp; Refunds
            </Link>
            <Link href="/pricing" className="rounded-xl border border-border-default bg-surface-app px-4 py-2 hover:bg-slate-50">
              Plan Pricing &amp; Features
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border-divider bg-white py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-tertiary">
            <p>© {new Date().getFullYear()} Focoman. All rights reserved.</p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
              <Link href="/contact" className="hover:underline font-bold text-text-primary">Contact Us</Link>
              <Link href="/terms" className="hover:underline">Terms</Link>
              <Link href="/privacy" className="hover:underline">Privacy</Link>
              <Link href="/billing-and-refunds" className="hover:underline">Billing and refunds</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

