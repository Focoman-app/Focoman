import { Suspense } from "react";
import { Navbar } from "@/components/Navbar";
import { getOrderByPasskeyAction } from "@/actions/orderActions";
import { TrackOrderClient } from "./TrackOrderClient";
import Link from "next/link";
import { FocomanLoadingState } from "@/components/FocomanSpinner";

export const dynamic = "force-dynamic";

export default async function TrackOrderPage({ params }: { params: Promise<{ passkey: string }> }) {
  const { passkey } = await params;
  
  const res = await getOrderByPasskeyAction(passkey);

  if (!res.success || !res.view) {
    return (
      <div className="min-h-screen bg-surface-app text-text-primary flex flex-col">
        <Navbar />

        <main className="flex-1 flex flex-col items-center justify-center p-4 py-12">
          <div className="w-full max-w-xl space-y-6">
            <div className="rounded-3xl border border-border-default bg-white p-8 shadow-sm text-center space-y-6">
              <div>
                <h1 className="text-2xl font-extrabold text-text-primary sm:text-3xl">
                  Order Not Found
                </h1>
                <p className="mt-2 text-xs sm:text-sm text-text-secondary leading-relaxed">
                  No active booking found for identifier{" "}
                  <span className="font-mono font-bold text-text-primary px-2 py-0.5 rounded bg-slate-100">
                    {passkey}
                  </span>
                </p>
              </div>

              <div className="rounded-2xl bg-surface-app p-4 border border-border-default space-y-3 text-left">
                <span className="text-xs font-bold text-text-primary block">Search another order ID or passkey:</span>
                <form action="/track" method="GET" className="flex gap-2">
                  <input
                    type="text"
                    name="code"
                    placeholder="Enter Order ID or Passkey"
                    className="flex-1 rounded-xl border border-border-default px-3.5 py-2 text-xs font-mono font-bold uppercase text-text-primary outline-none focus:border-brand-blue-primary"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-brand-blue-primary px-4 py-2 text-xs font-bold text-white hover:bg-sky-600 transition"
                  >
                    Track
                  </button>
                </form>
              </div>

              <div className="pt-2">
                <Link
                  href="/track"
                  className="inline-flex items-center text-xs font-bold text-brand-blue-primary hover:underline"
                >
                  Return to Order Tracking Portal
                </Link>
              </div>
            </div>
          </div>
        </main>

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

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-app flex flex-col items-center justify-center p-4">
        <FocomanLoadingState
          status="Loading Order Tracking..."
          subtext="Fetching production milestones and proofing status"
          showCard={false}
          minHeight="min-h-[300px]"
        />
      </div>
    }>
      <TrackOrderClient view={res.view} rawIdentifier={passkey} />
    </Suspense>
  );
}
