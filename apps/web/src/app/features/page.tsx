import { Navbar } from "@/components/Navbar";
import Link from "next/link";

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-surface-app text-text-primary">
      <Navbar />

      {/* Page Hero */}
      <section className="border-b border-border-divider bg-gradient-to-b from-white to-surface-app px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-block rounded-full border border-brand-blue-light bg-brand-blue-background px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-brand-blue-primary">
            Platform Capabilities
          </span>
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-text-primary sm:text-5xl">
            Built for Every Stage of Your Confirmed Orders
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-text-secondary sm:text-lg">
            A comprehensive look at Focoman operations, from confirmed shoot booking through post-event production and client delivery.
          </p>
        </div>
      </section>

      {/* Module 1: OMS */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-brand-blue-background px-3 py-1 text-xs font-bold tracking-widest text-brand-blue-primary uppercase">
              Module 01: Core Engine
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Order Management System - OMS
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Track and manage orders and their status across every milestone, from lead and inquiry through booking, event, production, and final delivery.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Order Creation & Management",
                desc: "Register and manage confirmed orders from both direct studio bookings and Studio Marketplace bookings in one centralized system.",
              },
              {
                title: "End-to-End Production Workflow",
                desc: "Manage the complete order production lifecycle, including pre-event preparation, crew and task assignments, event execution, post-event editing, customer reviews, rework, and final delivery.",
              },
              {
                title: "Studio-Wide Order Overview",
                desc: "Get a centralized overview of all orders, track their current statuses, monitor pending payments and SLA status, and stay informed about ongoing, pending, and completed orders to keep every order on schedule.",
              },
              {
                title: "Google Drive Integration & Client Review",
                desc: "Integrate Google Drive to preview and select photos, add customer comments, review deliverables, and manage approvals directly within FocoMan.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-orange-light", bg: "bg-brand-orange-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
                { border: "hover:border-green-300", bg: "bg-green-500" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-surface-app p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* Module 2: CRM */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-brand-orange-background px-3 py-1 text-xs font-bold tracking-widest text-brand-orange-primary uppercase">
              Module 02: Support Module
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Customer Relations - CRM
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Maintain structured customer directories, past booking history, and anniversary reminders to drive repeat bookings.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Centralized Customer Management",
                desc: "Create and manage customer profiles with contact details, addresses, and booking information in one centralized directory, with quick search and easy access to customer records.",
              },
              {
                title: "Customer Booking & Payment History",
                desc: "View each customer’s past and active orders, booking values, payment history, and outstanding balances to maintain a complete record of their relationship with the studio.",
              },
              {
                title: "Studio-Wide Customer Overview",
                desc: "Get a centralized overview of all customers within your studio, including their booking activity, payment history, lifetime value (LTV), and repeat bookings. Identify your most valuable customers and understand overall customer relationships and booking trends.",
              },
              {
                title: "Automated Follow-ups & Anniversary Reminders",
                desc: "Track customer anniversaries and important event milestones, send automated reminders to studios and customers, and support personalized follow-ups through email and WhatsApp when available to encourage repeat bookings and generate new leads.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-orange-light", bg: "bg-brand-orange-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
                { border: "hover:border-green-300", bg: "bg-green-500" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-surface-app p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* Module 3: Studio Operations - ERP */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-brand-purple-background px-3 py-1 text-xs font-bold tracking-widest text-brand-purple-primary uppercase">
              Module 03: Operations &amp; ERP
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Studio Operations - ERP
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Manage your studio team, assign shoots and production tasks, check crew availability, and keep track of crew expenses and payments.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Team Directory & Roles",
                desc: "Manage studio crew members, their roles, skills, contact details, and invitations in one centralized directory. Maintain an organized team database with easy access to member profiles and responsibilities.",
              },
              {
                title: "Crew Workload & Availability Overview",
                desc: "Get a studio-wide overview of crew workloads, assigned shoots, pending tasks, and availability. Monitor workload distribution, identify overloaded members, and find available crew for upcoming projects.",
              },
              {
                title: "Automated Workflow & Task Assignment",
                desc: "Configure studio workflows to automatically assign crew members and initiate production tasks when a new order is confirmed, including Marketplace bookings. Assignments follow predefined workflow rules, with manual assignment available when automation is not configured.",
              },
              {
                title: "Invoices & Receipts Management",
                desc: "Generate and manage studio invoices and customer payment receipts linked to confirmed orders. Keep transaction documents organized for easy access, sharing, and reference.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-orange-light", bg: "bg-brand-orange-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
                { border: "hover:border-green-300", bg: "bg-green-500" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-surface-app p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* Module 4: WhatsApp Operations & Bot */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-gradient-to-br from-white via-white to-green-50/30 p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-green-50 px-3 py-1 text-xs font-bold tracking-widest text-status-success uppercase">
              Module 04: Communication & Bot
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              WhatsApp Operations & Interactive Bot
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Automated WhatsApp alerts and mobile operations send booking confirmations and gallery links to clients, shoot reminders and call-times to crew, and receive real-time order milestone updates.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Automated WhatsApp Notifications",
                desc: "Send booking confirmations, event reminders, production updates, gallery links, and delivery notifications to customers through configurable WhatsApp triggers.",
              },
              {
                title: "Interactive Studio Operations Bot",
                desc: "Access upcoming shoots, active orders, crew information, and production statuses directly through WhatsApp using simple commands, without opening the studio dashboard.",
              },
              {
                title: "WhatsApp-Based Workflow Actions",
                desc: "Allow authorized studio members to update supported task and order statuses through WhatsApp, with permission checks and automatic synchronization to FocoMan workflows.",
              },
              {
                title: "Crew Reminders & Call Times",
                desc: "Send scheduled reminders to assigned crew members with event date, call time, venue location, and required shoot information.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-green-300", bg: "bg-green-500" },
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-orange-light", bg: "bg-brand-orange-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-white p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* Module 5: Marketplace */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-pink-50 px-3 py-1 text-xs font-bold tracking-widest text-pink-600 uppercase">
              Module 05: Studio Marketplace
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Studio Marketplace
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Discover verified photography and videography studios near you with authentic performance metrics, on-time delivery track records, and client reviews, while studio owners retain complete control over visibility and profile settings.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Public Studio Profile & Direct Inquiries",
                desc: "Showcase your studio profile with business information, location, services, and approved public details through a unique profile URL. Allow prospective customers to discover your studio and submit booking inquiries with their event requirements.",
              },
              {
                title: "Configurable Service Packages",
                desc: "Create and publish customized photography and videography packages with pricing, service details, and deliverables. Configure optional price negotiation for individual packages based on studio preferences.",
              },
              {
                title: "Booking Requests & Confirmation",
                desc: "Allow customers to submit booking requests with event details and selected packages. Review inquiries, confirm the agreed booking amount, request advance payments, and convert verified bookings into studio orders.",
              },
              {
                title: "Privacy Protected Operations",
                desc: "Public visitors can view only the studio’s approved profile information, services, and packages, while internal customer records, financial details, orders, and crew operations remain private and protected.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-orange-light", bg: "bg-brand-orange-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
                { border: "hover:border-green-300", bg: "bg-green-500" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-surface-app p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* Module 6: Business Reports & Analytics */}
      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-8">
        <div className="rounded-3xl border border-border-default bg-gradient-to-br from-white via-white to-amber-50/30 p-8 shadow-sm sm:p-12">
          <div className="flex flex-col gap-2">
            <span className="inline-block w-fit rounded-full bg-amber-50 px-3 py-1 text-xs font-bold tracking-widest text-amber-800 uppercase">
              Module 06: Business Growth
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-text-primary sm:text-3xl">
              Business Reports &amp; Analytics
            </h2>
            <p className="max-w-3xl text-sm text-text-secondary sm:text-base">
              Clear monthly and yearly revenue charts, pending client balance tracking, and profit insights by photoshoot package to help your studio grow and earn more.
            </p>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {[
              {
                title: "Monthly & Yearly Revenue Reports",
                desc: "Track monthly and yearly studio revenue, monitor booking trends, compare business performance across different time periods, and understand how your studio is growing over time.",
              },
              {
                title: "Exportable Business Reports",
                desc: "Generate and export detailed business reports, including order summaries, revenue trends, payment records, and shoot category performance, in Excel format for accounting, financial reviews, and business planning.",
              },
              {
                title: "Shoot Category Performance",
                desc: "Analyze booking volume and revenue across different shoot categories, identify your highest-performing services, and understand which types of photography projects contribute most to studio revenue.",
              },
              {
                title: "On-Time Delivery & Production Performance",
                desc: "Monitor production progress, completed and delayed orders, delivery turnaround times, and on-time completion performance to identify bottlenecks and improve studio efficiency.",
              },
            ].map((f, i) => {
              const colors = [
                { border: "hover:border-amber-300", bg: "bg-amber-500" },
                { border: "hover:border-brand-blue-light", bg: "bg-brand-blue-primary" },
                { border: "hover:border-brand-purple-light", bg: "bg-brand-purple-primary" },
                { border: "hover:border-green-300", bg: "bg-green-500" },
              ][i % 4];
              return (
              <div key={f.title} className={`rounded-2xl border border-border-default bg-white p-5 transition ${colors.border} hover:shadow-sm`}>
                <div className={`h-1.5 w-8 rounded-full mb-4 ${colors.bg}`} />
                <h3 className="text-sm font-bold text-text-primary">{f.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-text-secondary">{f.desc}</p>
              </div>
            )})}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border-divider bg-white py-14">
        <div className="mx-auto max-w-2xl px-4 text-center sm:px-6">
          <h2 className="text-2xl font-extrabold text-text-primary sm:text-3xl">Ready to streamline your studio?</h2>
          <p className="mt-3 text-text-secondary">Register your studio workspace and experience focused order operations.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/onboarding/register-studio"
              className="rounded-xl bg-brand-blue-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-600"
            >
              Register Your Studio
            </Link>
            <Link
              href="/workspaces"
              className="rounded-xl border border-border-default bg-white px-6 py-3 text-sm font-semibold text-text-primary transition hover:border-brand-blue-light hover:shadow-sm"
            >
              Access Workspaces
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
