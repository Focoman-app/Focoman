"use client";

import { useState } from "react";

interface ModuleData {
  number: string;
  name: string;
  shortDesc: string;
  tag: string;
  tagColor: string;
  cards: { title: string; desc: string }[];
}

const MODULES: ModuleData[] = [
  {
    number: "01",
    name: "Order Management System - OMS",
    shortDesc: "Track and manage orders and their status across every milestone, from lead and inquiry through booking, event, production, and final delivery.",
    tag: "Core Engine",
    tagColor: "bg-brand-blue-background text-brand-blue-primary border-brand-blue-light/50",
    cards: [
      {
        title: "Order Creation & Management",
        desc: "Register and manage confirmed orders from direct studio bookings in one centralized system.",
      },
      {
        title: "End-to-End Production Workflow",
        desc: "Manage the complete order production lifecycle, including pre-event preparation, crew and task assignments, event execution, post-event editing, customer reviews, rework, and final delivery.",
      },
      {
        title: "Multi-Channel Leads & Order Conversion",
        desc: "Capture leads from Instagram, WhatsApp Business, and your website through webhooks, and convert qualified leads into confirmed orders.",
      },
      {
        title: "Google Drive Integration & Client Review",
        desc: "Integrate Google Drive to preview and select photos, add customer comments, review deliverables, and manage approvals directly within FocoMan.",
      },
    ],
  },
  {
    number: "02",
    name: "Customer Relations - CRM",
    shortDesc: "Maintain structured customer directories, past booking history, and anniversary reminders to drive repeat bookings.",
    tag: "Support Module",
    tagColor: "bg-brand-orange-background text-brand-orange-primary border-brand-orange-soft",
    cards: [
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
    ],
  },
  {
    number: "03",
    name: "Studio Operations - ERP",
    shortDesc: "Manage your studio team, assign shoots and production tasks, check crew availability, and keep track of crew expenses and payments.",
    tag: "Operations and Team",
    tagColor: "bg-brand-purple-background text-brand-purple-primary border-brand-purple-light/50",
    cards: [
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
        desc: "Configure studio workflows, assign crew members, and initiate production tasks when a new order is confirmed.",
      },
      {
        title: "Invoices & Receipts Management",
        desc: "Generate and manage studio invoices and customer payment receipts linked to confirmed orders. Keep transaction documents organized for easy access, sharing, and reference.",
      },
    ],
  },
  {
    number: "04",
    name: "WhatsApp Operations and Bot",
    shortDesc: "Send automated booking confirmations and gallery links to clients, dispatch call times to crew, and manage studio operations on the go with an interactive WhatsApp bot.",
    tag: "WhatsApp and Bot",
    tagColor: "bg-green-50 text-status-success border-green-200",
    cards: [
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
    ],
  },
  {
    number: "06",
    name: "Business Reports and Analytics",
    shortDesc: "Track your studio income with monthly and yearly revenue charts, monitor pending client balances, see your most profitable shoot categories, and review on-time delivery track records.",
    tag: "Business and Growth",
    tagColor: "bg-amber-50 text-amber-800 border-amber-200",
    cards: [
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
    ],
  },
];

export function ModuleAccordion() {
  const [expandedIndices, setExpandedIndices] = useState<number[]>([]);

  const toggleModule = (index: number) => {
    setExpandedIndices((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
    );
  };

  return (
    <div className="space-y-3.5 sm:space-y-4">
      {MODULES.map((mod, idx) => {
        const isExpanded = expandedIndices.includes(idx);

        return (
          <div
            key={idx}
            className="rounded-xl border border-[#D8D2C4] bg-[#FFFDF9] shadow-[0_2px_0_#C4BCAB] transition hover:border-[#BFB8A7] overflow-hidden"
          >
            {/* Header row (Clickable) */}
            <button
              type="button"
              onClick={() => toggleModule(idx)}
              className="w-full p-4 sm:p-5 flex items-center justify-between gap-4 text-left group transition-colors hover:bg-[#FAF7F2]"
              aria-expanded={isExpanded}
            >
              <div className="min-w-0 flex-1">
                <h3 className="retro-serif-heading text-base sm:text-lg font-bold text-[#1C1917] group-hover:text-brand-orange-primary transition-colors">
                  {mod.name}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-[#57534E] leading-relaxed">
                  {mod.shortDesc}
                </p>
              </div>

              {/* Just arrow mark */}
              <div className="shrink-0 flex items-center justify-center pl-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#FAF5E8] border border-[#D8D2C4] group-hover:border-brand-orange-soft transition-colors">
                  <svg
                    className={`h-4 w-4 text-[#57534E] transition-transform duration-200 ${
                      isExpanded ? "rotate-180 text-brand-orange-primary" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                    aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </span>
              </div>
            </button>

            {/* Expanded 4 child feature panels */}
            {isExpanded && (
              <div className="border-t border-[#E8E0D0] bg-[#FAF7F2] p-4 sm:p-5 animate-in fade-in slide-in-from-top-1 duration-200">
                <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {mod.cards.map((card, cIdx) => (
                    <div
                      key={cIdx}
                      className="rounded-lg border border-[#D8D2C4] bg-[#FFFDF9] p-3.5 shadow-xs transition hover:border-[#BFB8A7] flex flex-col justify-between"
                    >
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold text-[#1C1917]">
                          {card.title}
                        </h4>
                        <p className="mt-1.5 text-xs text-[#57534E] leading-relaxed">
                          {card.desc}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
