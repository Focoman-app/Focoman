# Authenticated application shell

Status: approved

## Objective

Treat Focoman as a workspace application after authentication while retaining
the public landing page for intentional visits, acquisition, legal discovery,
and unauthenticated users.

## Routing contract

| Entry | Signed-out result | Signed-in result |
|---|---|---|
| PWA launch | Sign in | `/dashboard`, then the default workspace dashboard |
| Dashboard logo or home action | n/a | `/dashboard`, then the default workspace dashboard |
| Explicit sidebar `Landing Page` link | `/` | `/` |
| Checkout | Sign in | Owner-scoped plan checkout |
| Customer tracking sign-in redirect | Sign in | Return to the supplied customer tracking route |

`/dashboard` remains the workspace resolver. A user with active memberships
opens their configured default workspace regardless of how many workspaces they
belong to. Users with no membership go to `/workspaces`, where they can register
or join a studio; users with memberships but no default workspace go to
`/workspaces`.

## Dashboard sidebar layout

```text
┌──────────────────────────────┐
│ Focoman logo  → /dashboard   │
├──────────────────────────────┤
│ Workspace switcher            │
│ Dashboard and enabled modules │
├──────────────────────────────┤
│ Landing Page → /              │
│ Sign out                      │
└──────────────────────────────┘
```

The `Landing Page` item is the only dashboard-shell route to the public site.
It appears immediately above `Sign out` on desktop and in the mobile drawer.
It is an intentional navigation action, not an app home control.

## Module decomposition

| Module | Input | Output | Dependency |
|---|---|---|---|
| PWA manifest | App launch | `/dashboard` entry | dashboard resolver |
| Dashboard resolver | Auth and memberships | default dashboard, onboarding, or workspace selector | workspace default helper |
| Dashboard sidebar | current studio | default-dashboard brand link and explicit landing link | Next routing |
| Identity architecture | routing rules | source-of-truth documentation | product navigation behavior |

## Integration enumeration

1. PWA `start_url` opens `/dashboard`.
2. `/dashboard` resolves the saved default workspace and routes to its
   dashboard; missing memberships/defaults follow the documented fallbacks.
3. Desktop and mobile dashboard logos both point to `/dashboard`.
4. Desktop and mobile sidebar render the explicit `Landing Page` action above
   `Sign out` and preserve the landing route at `/`.
5. Customer tracking redirect parameters retain their existing priority over
   dashboard routing.

## State variants

| State | Required behavior |
|---|---|
| Loading default workspace | Existing workspace preparation state is shown. |
| No membership | Route to `/workspaces`, which provides registration and join choices. |
| Memberships but no default | Route to workspace selector. |
| Default workspace unavailable | Route to workspace selector; do not invent a workspace. |
| Mobile | Logo and `Landing Page` behavior match the desktop drawer. |

## Deferred major action items

These are deliberately out of scope for this navigation task:

1. Leads webhook integration.
2. WhatsApp API configuration and live connection validation.
3. Pricing payment-gateway integration.
