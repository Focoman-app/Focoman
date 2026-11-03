# App-derived social brand kit

**Verified against repository sources:** 2026-11-03. Refresh these lightweight exports when the application identity changes; do not generate or redesign a substitute logo.

## Logo provenance

| File | Source and permitted change |
| --- | --- |
| [logo.svg](logo.svg) | Exact copy of [`focoman-brand-logo.svg`](../../apps/web/public/focoman-brand-logo.svg), checked against [`FocomanLogo.tsx`](../../apps/web/src/components/FocomanLogo.tsx) light variant |
| [logo-dark.svg](logo-dark.svg) | Same SVG, with only Foco text `#111827` → `#FFFFFF` and Studios text `#4B5563` → `#CBD5E1`, matching the component's dark variant |
| [mark.svg](mark.svg) | Exact copy of [`focoman-social-icon-transparent.svg`](../../apps/web/public/focoman-social-icon-transparent.svg); its five shield paths match the current component |

The SVGs have transparent backgrounds. Apply opacity when compositing. Preserve shield paths, gradients, spelling, proportions and Studios suffix. Navbar and DashboardSidebar use the component above. Older repository PNGs and standalone Downloads logos are not the current identity source.

## Palette and theme

[`globals.css`](../../apps/web/src/app/globals.css) defines light surfaces/text and brand utility colours. [`DashboardSidebar.tsx`](../../apps/web/src/components/DashboardSidebar.tsx) defines the dark sidebar. The [brand design guide](../../docs/design/brand-design-system.md) supplies supporting palette context; its older white-sidebar recommendation does not override the actual dark sidebar.

| Role | Current value |
| --- | --- |
| Brand orange / blue / purple | `#F97316` / `#0EA5E9` / `#8B5CF6` |
| App / card background | `#FAFAFA` / `#FFFFFF` |
| Primary / secondary / tertiary text | `#111827` / `#4B5563` / `#9CA3AF` |
| Light border | `#E5E7EB` |
| Dark sidebar / border | `#181B20` / `#262A32` |
| Dark active / hover surface | `#242932` / `#22262E` |

The app uses Inter with system sans-serif fallbacks. Preserve that character for Latin text; choose a compatible Tamil font and verify shaping rather than assuming Inter covers Tamil. Keep font binaries on the device. Use current component styles for other depicted screens; do not invent a paper/retro theme for product imagery.

## Capture and placement

Use actual app screenshots or verified existing captures. Faithful crops/annotations and clearly identified exact reproductions are allowed; invented screens/data are not. Capture only when needed, keep files outside Git and follow repository browser restrictions.

Keep corner branding clear of captions, faces, important UI and platform controls. Choose light/dark wordmarks by background. Initial logo opacity 20–30% and text opacity 15–25% remain adjustable proposals; use stronger logo visibility on title/end cards.
