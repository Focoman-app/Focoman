/** Fixed labels only: never include a UID, studio slug, token or customer data. */
export type PerformanceOperation =
  | "auth.session.sync"
  | "auth.recovery.check"
  | "workspace.resolve"
  | "studio.register"
  | "dashboard.access"
  | "dashboard.load"
  | "oms.load"
  | "crm.load"
  | "erp.load"
  | "order.save"
  | "customer.save"
  | "table.page";

export async function measurePerformance<T>(
  operation: PerformanceOperation,
  work: () => Promise<T>,
): Promise<T> {
  const enabled = process.env.NEXT_PUBLIC_PERFORMANCE_LOGS === "true"
    || (typeof window === "undefined" && process.env.PERFORMANCE_LOGS === "true");
  if (!enabled) return work();
  const started = performance.now();
  let succeeded = false;
  try {
    const result = await work();
    succeeded = true;
    return result;
  } finally {
    console.info("[Focoman performance]", {
      operation,
      durationMs: Math.round((performance.now() - started) * 100) / 100,
      succeeded,
    });
  }
}
