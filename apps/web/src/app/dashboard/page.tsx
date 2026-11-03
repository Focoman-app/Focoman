"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { subscribeToAuthState, syncServerSession } from "@/lib/firebaseAuth";
import { getUserWorkspacesAction } from "@/actions/studioActions";
import { resolveAndSyncDefaultWorkspace } from "@/lib/workspaceDefaults";
import { Navbar } from "@/components/Navbar";
import { BackButton } from "@/components/BackButton";
import { FocomanLoadingState } from "@/components/FocomanSpinner";

export default function GlobalDashboardRedirect() {
  const router = useRouter();
  const [status, setStatus] = useState("Checking authentication...");

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (user) => {
      if (user) {
        try {
          setStatus("Finding your default studio...");
          await syncServerSession();
          const idToken = await user.getIdToken();
          const workspaces = await getUserWorkspacesAction(idToken);
          
          const defaultStudio = await resolveAndSyncDefaultWorkspace(user.uid, workspaces, idToken);

          if (defaultStudio) {
            router.replace(`/${defaultStudio}/dashboard`);
          } else {
            router.replace("/workspaces");
          }
        } catch (error) {
          console.error("Failed to load workspaces", error);
          setStatus("Error loading workspaces. Redirecting...");
          setTimeout(() => router.replace("/workspaces"), 1500);
        }
      } else {
        router.replace("/sign-in");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-surface-app flex flex-col">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <FocomanLoadingState
          status={status}
          subtext="Preparing your workspace environment"
          showCard={true}
        />
      </main>
    </div>
  );
}
