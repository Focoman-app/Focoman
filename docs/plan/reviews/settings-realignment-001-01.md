# Review: settings-realignment-001

## Findings

1. **P2 — blocking**
   - **Design location:** `docs/plan/analysis/settings-realignment.md`, Studio
     Settings order and General rules.
   - **Code location:**
     `apps/web/src/app/[studioSlug]/dashboard/settings/page.tsx:361`.
   - The page subtitle still says users can configure “operational
     capabilities,” although the approved design removes capability selection
     and replaces it with read-only plan information. This is misleading and
     contradicts the new settings boundary.

## Verification

- Studio layout uses flex ordering: Studio Profile, Services and Packages,
  Default Workspace, read-only Plan Information/Checkout, then Delete Studio.
- Account Profile precedes Default Workspace and the duplicate Account `Active
  Default` badge is gone.
- Settings-page All Workspaces action and editable capability checkbox/state
  are absent.
- Existing destructive controls remain.
- `git diff --check` passes.

## Conclusion

**blocked** — implementation matches the structural layout, but the stale
subtitle must be corrected before delivery because it promises a removed
capability-selection behavior.
