# Settings boundary simplification

Status: approved

## Objective

Separate personal account settings from studio-scoped settings and remove
duplicate navigation.

## Navigation contract

```text
Dashboard sidebar
  Studio Settings → /{studio}/dashboard/settings

Dashboard profile menu
  Account Settings → /account-settings

Account Settings page
  Back to current workspace/dashboard
  (no duplicate My Workspaces link)
```

`/{studio}/dashboard/settings` is studio-only. Its Account Settings tab and
all account-level controls are removed because the global `/account-settings`
page is the sole personal-account destination.

## State behavior

- Account Settings back action returns to the configured default studio
  dashboard when available, otherwise `/workspaces`.
- The right-side `My Workspaces` action is removed rather than duplicating the
  back action.
- A dashboard profile menu always links directly to `/account-settings`, not a
  studio query/tab URL.
