# Review: settings-boundary-simplification-001

## Findings

No blocking findings.

- **P3 — non-blocking:** the repository TypeScript check remains blocked by
  stale generated Marketplace route declarations and existing `lucide-react` /
  Firebase declaration errors. It reports no error in the settings files
  changed for this task.

## Verification

- `DashboardSidebar` labels the studio route `Studio Settings` and retains the
  `/{studioSlug}/dashboard/settings` destination.
- `DashboardTopNav` directs profile-menu `Account Settings` directly to the
  sole global `/account-settings` route; no stale `?tab=account` target
  remains.
- The studio settings page has no Account Settings tab, tab-routing state,
  account-profile controls, account-close action, or account-close modal.
- The global Account Settings page retains its contextual Back action and no
  longer renders a right-side `My Workspaces` duplicate link.
- Focused scans and `git diff --check` pass.

## Conclusion

**pass**
