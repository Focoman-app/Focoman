"use client";

import { useState } from "react";

interface FaqItem {
  category: string;
  q: string;
  a: string;
}

const FAQS: FaqItem[] = [
  {
    category: "Order Management - OMS",
    q: "Is Basic Order Management truly free forever?",
    a: "Yes. Basic Order Management is ₹0 forever with no order limits or time limits. You can create confirmed shoots, track production workflow from shoot to final delivery, assign basic customer details, and record advance payments and balance due without any subscription fee.",
  },
  {
    category: "Google Drive and Review",
    q: "Does Focoman store my raw photos and videos?",
    a: "No. Your files remain safely stored in your own Google Drive. With Advanced OMS in the ₹999/month plan, Focoman connects to your Google Drive folders so your clients can view in-app previews, mark photos as selected or rejected, and leave review comments directly inside their private tracking link.",
  },
  {
    category: "Team and Scheduling",
    q: "How does crew assignment and availability work?",
    a: "You can check crew availability before assigning photographers, videographers, and editors to active shoots or production tasks. This keeps your team organized and ensures assignments are made based on who is available.",
  },
  {
    category: "WhatsApp and Operations",
    q: "Who can use the WhatsApp Operations Bot?",
    a: "Only the verified studio owner's phone number can chat with the WhatsApp Bot to query active orders, upcoming shoots, and pending tasks. Automated event reminders and gallery links are delivered to clients and crew.",
  },
  {
    category: "Business Growth",
    q: "How do Business Reports help my studio earn more?",
    a: "Business Reports give you clear monthly and yearly revenue charts, list all pending client balances so you never hand over albums without full payment, and show your most profitable photoshoot packages.",
  },
];

export function FaqAccordion() {
  const [openIndices, setOpenIndices] = useState<number[]>([]);

  const toggleFaq = (idx: number) => {
    setOpenIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  return (
    <div className="space-y-3">
      {FAQS.map((faq, idx) => {
        const isOpen = openIndices.includes(idx);
        const panelId = `faq-panel-${idx}`;
        const buttonId = `faq-button-${idx}`;

        return (
          <div
            key={idx}
            className={`rounded-xl border transition bg-[#FFFDF9] ${
              isOpen
                ? "border-[#D8D2C4] shadow-[0_2px_0_#C4BCAB]"
                : "border-[#D8D2C4] shadow-[0_1px_0_#D8D2C4] hover:border-[#BFB8A7]"
            }`}
          >
            <button
              id={buttonId}
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleFaq(idx)}
              className="w-full text-left p-5 flex items-start sm:items-center justify-between gap-4 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange-primary rounded-xl"
            >
              <span className="block text-sm sm:text-base font-bold text-[#1C1917]">
                {faq.q}
              </span>
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FAF5E8] border border-[#D8D2C4] text-xs font-bold text-[#8C857B] transition-transform duration-200 mt-1 sm:mt-0">
                <svg
                  className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-brand-orange-primary" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>

            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`px-5 pb-5 text-xs sm:text-sm text-[#57534E] leading-relaxed border-t border-[#D8D2C4] pt-3.5 ${
                isOpen ? "block" : "hidden"
              }`}
            >
              {faq.a}
            </div>
          </div>
        );
      })}
    </div>
  );
}
