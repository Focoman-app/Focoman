"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToAuthState, syncServerSession } from "@/lib/firebaseAuth";
import { getUserWorkspacesAction } from "@/actions/studioActions";
import { resolveAndSyncDefaultWorkspace } from "@/lib/workspaceDefaults";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanLoadingState } from "@/components/FocomanSpinner";
import { measurePerformance } from "@/lib/performance";

export default function GlobalDashboardRedirect() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking authentication...");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    let generation = 0;
    const unsubscribe = subscribeToAuthState(async (user) => {
      const current = ++generation;
      const isCurrent = () => active && current === generation;
      if (user) {
        try {
          setStatus("Finding your default studio...");
          setFailed(false);
          const defaultStudio = await measurePerformance("workspace.resolve", async () => {
            const idToken = await user.getIdToken();
            // Workspace discovery authenticates with this token and does not
            // depend on the cookie POST. Navigation waits for both to succeed.
            const [sessionReady, workspaces] = await Promise.all([
              syncServerSession(),
              getUserWorkspacesAction(idToken),
            ]);
            if (!sessionReady) throw new Error("Unable to establish your secure session. Please retry.");
            return resolveAndSyncDefaultWorkspace(user.uid, workspaces, idToken);
          });
          if (!isCurrent()) return;

          if (defaultStudio) {
            router.replace(`/${defaultStudio}/dashboard`);
          } else {
            router.replace("/workspaces");
          }
        } catch (error) {
          if (!isCurrent()) return;
          console.error("Failed to load workspaces", error);
          setStatus("Unable to load your workspace. Please retry.");
          setFailed(true);
        }
      } else {
        router.replace("/sign-in");
      }
    });

    return () => { active = false; unsubscribe(); };
  }, [router, attempt]);

  return (
    <div className="min-h-screen bg-surface-app flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {failed ? (
          <div role="alert" className="text-center space-y-4">
            <p>{status}</p>
            <button className="rounded-lg bg-brand-blue-primary px-4 py-2 text-white" onClick={() => setAttempt((value) => value + 1)}>
              Retry
            </button>
          </div>
        ) : <FocomanLoadingState
          status={status}
          subtext="Preparing your workspace environment"
          showCard={true}
        />}
      </main>
    </div>
  );
}
