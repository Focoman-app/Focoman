import { Navbar } from "@/components/Navbar";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      {/* Page Hero */}
      <section className="border-b border-border-divider bg-gradient-to-b from-white to-surface-app px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-block rounded-full border border-brand-purple-light bg-brand-purple-background px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-purple-primary">
            About Us
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            We Build Software for People Who Create
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-text-secondary sm:text-lg">
            Focoman is a software product organization operating out of India.
            We build focused, purposeful tools for creative professionals.
          </p>
        </div>
      </section>

      {/* About Focoman */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <span className="inline-block rounded-full bg-brand-blue-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
                About Focoman
              </span>
              <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
                Focoman
              </h2>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary sm:text-base">
                Focoman is registered in India and specializes in building
                domain-specific software systems for photography and creative businesses that have been
                historically underserved by generic enterprise tools.
              </p>
              <p className="mt-4 text-sm leading-relaxed text-text-secondary sm:text-base">
                We believe the best software is built by people who understand the daily reality
                of the business they&apos;re solving for, not from a spreadsheet, but from
                conversations with the people doing the actual work.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <div className="rounded-xl border border-border-default bg-surface-app px-5 py-3">
                  <p className="text-xs font-bold text-text-primary">Country</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-blue-primary">India</p>
                </div>
                <div className="rounded-xl border border-border-default bg-surface-app px-5 py-3">
                  <p className="text-xs font-bold text-text-primary">Type</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-blue-primary">Product Software Organization</p>
                </div>
                <div className="rounded-xl border border-border-default bg-surface-app px-5 py-3">
                  <p className="text-xs font-bold text-text-primary">Focus</p>
                  <p className="mt-0.5 text-sm font-semibold text-brand-blue-primary">Creative Studio BOS</p>
                </div>
              </div>
            </div>

            {/* Visual accent block */}
            <div className="rounded-2xl border border-border-default bg-gradient-to-br from-brand-blue-background via-white to-brand-purple-background p-8 text-center">
              <p className="text-4xl font-extrabold text-text-primary">Focoman</p>
              <p className="mt-2 text-sm font-medium text-text-secondary">Software built to power photography studios.</p>
              <div className="mt-6 h-px bg-border-divider" />
              <p className="mt-6 text-xs italic text-text-tertiary">
                &quot;Focus beyond the frames — helping studios coordinate crews, manage orders, and deliver unforgettable memories on time.&quot;
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product: Focoman */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <span className="inline-block rounded-full bg-brand-orange-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-orange-primary">
            The Product
          </span>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
            Focoman: Focus beyond the frames
          </h2>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-text-secondary sm:text-base">
            Focoman is a complete Business Operating System built
            exclusively for photography studios. It replaces the chaos of scattered WhatsApp messages,
            hand-written notebooks, and Excel sheets that most studio owners rely on today.
          </p>

          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Why Photography Studios?",
                body: "Photography studios are one of the most under-digitized creative businesses in India. Most owners manage lakhs of rupees in orders through WhatsApp forwards and paper registers. We saw a real problem worth solving.",
                color: "bg-brand-blue-primary",
              },
              {
                title: "What Focoman Replaces",
                body: "WhatsApp order tracking. Excel sheets for payments. Paper logs for team tasks. Verbal shoot date reminders. Focoman brings all of this into one system, designed specifically for how studios operate.",
                color: "bg-brand-orange-primary",
              },
              {
                title: "Who It's Built For",
                body: "Solo photographers who want to look professional. Studio owners managing 3–15 crew members. Multi-branch studio chains. Anyone in the photography business who wants to stop losing money to poor tracking.",
                color: "bg-brand-purple-primary",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-2xl border border-border-default bg-surface-app p-6">
                <div className={`h-1.5 w-8 rounded-full ${item.color} mb-4`} />
                <h3 className="text-sm font-bold text-text-primary">{item.title}</h3>
                <p className="mt-3 text-xs leading-relaxed text-text-secondary">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Goal / Mission */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-gradient-to-br from-white via-white to-brand-purple-background/20 p-8 shadow-sm sm:p-12">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-brand-purple-background px-3 py-1 text-xs font-bold uppercase tracking-widest text-brand-purple-primary">
              Our Goal
            </span>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Give every studio owner the power to run a professional operation at any scale.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-text-secondary sm:text-base">
              We want every photographer in India who runs a studio, whether in a metro city or a tier-2 town,
              to have access to the same quality of business tooling that large enterprises use.
              Focoman is the first step towards that goal.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-text-secondary sm:text-base">
              We&apos;re starting with photography studios because we know them well. But the framework we&apos;re
              building is the foundation for a broader platform serving creative professionals across event
              management, wedding planning, and beyond.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border-divider bg-white py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-extrabold text-text-primary">Start your studio&apos;s transformation today.</h2>
          <p className="mt-3 text-sm text-text-secondary">
            See how Focoman works, or pick a plan to get started.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/features"
              className="rounded-xl bg-brand-blue-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              Explore Module Breakdown
            </Link>
            <Link
              href="/pricing"
              className="rounded-xl border border-border-default bg-white px-6 py-3 text-sm font-semibold text-text-primary transition hover:border-brand-blue-light hover:shadow-sm"
            >
              View Pricing
            </Link>
          </div>
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
