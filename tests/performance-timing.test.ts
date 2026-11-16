import { test } from "node:test";
import assert from "node:assert/strict";
import { measurePerformance } from "../apps/web/src/lib/performance.ts";

test("timing preserves the operation result and executes it once", async () => {
  let executions = 0;
  const result = await measurePerformance("workspace.resolve", async () => {
    executions += 1;
    return executions;
  });
  assert.equal(result, 1);
  assert.equal(executions, 1);
});

test("timing preserves rejection instead of reporting unavailable work as success", async () => {
  const error = new Error("Operation unavailable");
  await assert.rejects(measurePerformance("auth.session.sync", async () => {
    throw error;
  }), (caught) => caught === error);
});
