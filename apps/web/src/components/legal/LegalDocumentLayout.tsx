import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import Link from "next/link";
import type { ReactNode } from "react";

type LegalDocumentLayoutProps = { eyebrow: string; title: string; summary: string; children: ReactNode };

export function LegalDocumentLayout({ eyebrow, title, summary, children }: LegalDocumentLayoutProps) {
  return <div className="min-h-screen bg-surface-app text-text-primary"><Navbar /><main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"><BackButton fallbackHref="/" /><article className="mt-6 rounded-3xl border border-border-default bg-white p-6 shadow-sm sm:p-10"><header className="border-b border-border-divider pb-7"><p className="text-xs font-bold uppercase tracking-widest text-brand-blue-primary">{eyebrow}</p><h1 className="mt-3 text-3xl font-extrabold tracking-tight text-text-primary sm:text-4xl">{title}</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-text-secondary">{summary}</p><p className="mt-4 text-xs text-text-tertiary">Last updated: 10 November 2026</p></header><div className="mt-8 space-y-8 text-sm leading-7 text-text-secondary [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-text-primary [&_p]:mt-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">{children}</div><footer className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border-divider pt-6 text-xs text-text-tertiary"><Link href="/terms" className="hover:text-text-primary hover:underline">Terms of Service</Link><Link href="/privacy" className="hover:text-text-primary hover:underline">Privacy Policy</Link><Link href="/billing-and-refunds" className="hover:text-text-primary hover:underline">Billing and Refunds</Link><a href="mailto:support@focoman.com" className="hover:text-text-primary hover:underline">support@focoman.com</a></footer></article></main></div>;
}
