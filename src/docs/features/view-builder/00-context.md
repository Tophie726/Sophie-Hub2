# View Builder (Inception Mode) Context

Date: 2026-02-10
Round: 00 (Context capture)

## Request Summary

Redesign the `/admin/views/[viewId]` builder page from a settings-first layout (module checkboxes + form fields + small preview) into a **true inception-mode builder** where the preview IS the main event.

The builder should show **exactly what Sophie Hub looks like** for a given audience member -- including the sidebar, navigation, content area, profile section, and everything the real app has. An admin clicking into "Admin" view should see the full app as an admin would see it. Clicking "PPC Basic" should show what a PPC Basic partner sees.

### Core Vision

> "It's essentially inception. I'm looking at Sophie Hub, but inside it I see another Sophie Hub showing what that person would see."

**Reference analogy:** Shopify theme editor / WordPress Customizer -- a thin control bar on top, with the actual site rendered as a full preview below.

### What the User Wants

1. **Full-width preview** -- no module palette sidebar eating space. The preview dominates.
2. **Complete app shell** in the preview -- sidebar with role-filtered nav, content area, header, profile, bug report button, everything.
3. **Modules = Pages/Sections** -- like the reporting builder where sections appear in the left nav. Each section is a page, each page has widgets.
4. **Partner/role-specific content** -- modules tie to whoever that specific partner or staff member is.
5. **Minimal admin controls** -- view settings (name, description, active/default, audience rules) should be in a secondary tab or hidden panel, not prime real estate.
6. **Fullscreen mode** -- expand to see exactly what the user would see, with a way to exit.
7. **Device preview** -- mobile/tablet/desktop toggle (reuse existing dashboard-builder pattern).
8. **Audience switcher** -- flip between "What does PPC Basic see?" vs "What does Admin see?" vs a specific partner.
9. **Dummy data for templates** -- when building templates, use placeholder data. Can switch to real partner/staff data to preview.

### What the Current Builder Has (To Be Redesigned)

The current `[viewId]/page.tsx` (943 lines) has:
- Left sidebar (320px): Module Palette checkboxes, View Settings form, Audience Rules editor
- Right canvas: Preview showing module cards + dashboard widget samples
- Device preview toggle (desktop/tablet/mobile)
- Fullscreen mode

**Problem:** It's settings-first, preview-second. The sidebar eats 320px. The preview is a simplified card view, not a real app replica. There's no sidebar nav in the preview. You can't see what the actual Sophie Hub experience would be.

## Decisions Locked (2026-02-10)

1. **Architecture: Custom iframe + postMessage** -- render the real Next.js app inside an iframe with simulated role/audience context. Not a page-builder library.
2. **Optional future layer: Puck** (MIT, 12.1k stars) -- if we later need drag-and-drop widget rearrangement inside the preview, Puck is the best React-native option. But v1 is custom iframe.
3. **Preview route:** New `/preview` route (or `/admin/preview`) that renders the full app shell (sidebar, nav, content) using a simulated audience context passed via query params or postMessage.
4. **Modules = nav pages** -- each assigned module becomes a nav item in the preview sidebar. Clicking it shows that module's dashboard/widgets.
5. **View settings are secondary** -- accessible via a gear icon or "Settings" tab, not in the main builder layout.
6. **Audience switching** -- dropdown in the builder toolbar to switch which partner/staff/role you're previewing as.

## Research: Open-Source Tools Evaluated

| Tool | License | Stars | Verdict |
|------|---------|-------|---------|
| **Puck** (puckeditor/puck) | MIT | 12.1k | Best option IF we need drag-and-drop. iframe-based preview, renders React components, Next.js native, active maintenance. **Reserve for v2 widget layout customization.** |
| Craft.js | MIT | 8.5k | No iframe, no device preview, maintenance concerns. Not recommended. |
| GrapesJS | BSD 3-Clause | 25.5k | Cannot render React components in canvas. Wrong architecture. Eliminated. |
| React Bricks | Proprietary | N/A | Not open source. Eliminated. |
| Builder.io | MIT (SDK only) | ~10k | Editor is closed-source SaaS. Cannot self-host. Eliminated. |
| Plasmic | MIT/AGPL | 6.6k | Dual license complicates usage. SaaS-first. Not ideal. |

**Recommendation:** Custom iframe approach for v1 (Shopify/WordPress pattern). Puck reserved for future widget-level drag-and-drop.

## Architectural Pattern: iframe + postMessage (Shopify/WordPress)

The proven pattern used by Shopify Theme Editor and WordPress Customizer:

```
+---------------------------------------------+
|  Builder Page (Parent)                       |
|  ┌──────┐ ┌──────────────────────────────┐  |
|  │Thin  │ │  iframe                      │  |
|  │tool- │ │                              │  |
|  │bar   │ │  Real Next.js app rendered   │  |
|  │(opt) │ │  with simulated audience     │  |
|  │      │ │  context (role, partner,     │  |
|  │      │ │  view profile)               │  |
|  │      │ │                              │  |
|  │      │ │  Full sidebar + nav +        │  |
|  │      │ │  content area + profile      │  |
|  │      │ │                              │  |
|  └──────┘ └──────────────────────────────┘  |
+---------------------------------------------+
```

- **Parent frame:** Builder toolbar (audience selector, device toggle, fullscreen, settings gear)
- **iframe:** Loads `/preview?_role=partner&_partner_type=ppc_basic&_view_id=xxx`
- **Communication:** postMessage for bidirectional updates (audience change, theme, etc.)
- **Security:** Same-origin iframe, so full DOM access if needed

### How Shopify Does It
- Controls pane (sidebar) with settings, section config, block management
- Preview pane (iframe) showing the actual storefront
- postMessage API between controls and preview
- `Shopify.visualPreviewMode` flag to detect when in preview mode

### How WordPress Does It
- Two panes: Controls (sidebar) + Preview (iframe)
- Communication via `wp.customize.Messenger` (postMessage wrapper)
- Preview content rendered server-side with drafted changes

## Existing System to Reuse

### View Resolution (Already Built)
- `src/lib/views/resolve-view.ts` -- 5-tier resolution (Staff > Role > Partner > Partner Type > Default)
- `view_profiles` + `view_audience_rules` + `view_profile_modules` tables all exist
- Viewer context API exists (`/api/viewer-context`) with "See as" capability

### Sidebar & Navigation (Already Built)
- `src/components/layout/sidebar.tsx` -- role-based filtering via `getNavigationForRole(role)`
- `src/lib/navigation/config.ts` -- centralized nav config with `requiredRole` gating
- `src/components/layout/main-layout.tsx` -- full app shell (sidebar + header + content)

### Dashboard Builder (Pattern to Reuse)
- `src/components/reporting/dashboard-builder.tsx` -- device preview frames (375px mobile, 768px tablet)
- `src/components/reporting/dashboard-header.tsx` -- device toggle buttons (Monitor/Tablet/Smartphone)
- Grid system with occupancy tracking for widget placement
- Section management (add/collapse/delete sections, add widgets to sections)

### Module System (Already Built)
- `modules` table with slug, name, description, icon, color
- `dashboards` per module with sections and widgets
- `view_profile_modules` junction table for view-to-module assignments
- API: `GET /api/modules`, `GET /api/admin/views/[viewId]/modules`

### Widget System (Already Built)
- 6 widget types: metric, chart, table, text, ai_text, smart_text
- `widget-renderer.tsx` routes types to components
- `widget-config-dialog.tsx` for editing widget configs
- `section-container.tsx` for responsive grid layout

## What Needs to Be Built

### 1. Preview Route (`/preview` or `/admin/preview`)
- Renders the full Sophie Hub app shell using simulated context
- Accepts audience params: `_role`, `_partner_type`, `_partner_id`, `_staff_id`, `_view_id`
- Sets up a `PreviewProvider` that overrides the normal auth/view context
- Navigation filtered by simulated role (not the real admin role)
- Content area shows modules assigned to the resolved view
- Each module = a navigable page with its dashboard/sections/widgets

### 2. Builder Chrome (Redesigned `[viewId]/page.tsx`)
- **Top toolbar only** -- no sidebar. Contains:
  - Back button (to `/admin/views`)
  - View name (editable inline)
  - Audience selector dropdown (role, partner type, specific partner)
  - Device toggle (desktop/tablet/mobile)
  - Settings gear (opens drawer/modal with view settings + audience rules)
  - Fullscreen toggle
- **Preview area** -- full-width iframe showing the preview route
- **Fullscreen mode** -- hides the builder toolbar, shows just the preview with a floating exit button

### 3. Module-as-Navigation Mapping
- Each module assigned to a view becomes a nav item in the preview sidebar
- Clicking a nav item shows that module's dashboard
- Module order = sidebar order (controlled by `view_profile_modules.sort_order`)
- Need to define which nav sections modules map to (or create a new "Modules" section)

### 4. Audience Context Override for Preview
- New context provider or middleware that detects `_preview=true` params
- Overrides `resolveEffectiveView()` to use the specified view instead of resolving from real auth
- Overrides role for navigation filtering
- Provides dummy/real partner data based on selected audience

## Known Risks

1. **iframe complexity** -- same-origin iframe with Next.js app router could have routing conflicts, double-rendering of layouts, or style leakage.
2. **Auth in preview** -- the preview route still needs real authentication (admin only), but must render as-if a different role. Must not actually grant partner-level data access.
3. **Performance** -- rendering the full app inside an iframe means double-loading the Next.js bundle. May need optimization.
4. **Module-to-nav mapping** -- current modules don't have a 1:1 mapping to navigation items. Need to define how module assignments translate to sidebar nav.
5. **Data in preview** -- when previewing "as PPC Basic partner," what data shows? Dummy data? Real partner data? Need a clear policy.

## Open Questions for Codex

1. Should the preview route be a separate Next.js route group (e.g., `(preview)`) with its own layout, or a query-param mode on the existing `(dashboard)` layout?
2. How should modules map to navigation items? New nav section "Modules" with dynamic items, or replace the existing nav sections entirely?
3. For widget data in preview mode: use the existing snapshot/demo data system, or create a dedicated preview data provider?
4. Should the builder support inline editing (click a widget in the preview to edit it), or is that v2/Puck territory?
5. How does the "Add module" flow work? Floating action button in the builder toolbar that opens a module picker, or something in the preview sidebar?
6. Should the view builder support creating new dashboards/sections/widgets, or only compose existing ones?

## Design Philosophy Alignment

Per CLAUDE.md design principles:
- **Progressive disclosure** -- show the preview first, reveal settings only when requested
- **Delight over function** -- the inception preview should feel magical, not like a settings form
- **Instant feedback** -- toggling audience should immediately re-render the preview
- **Motion with purpose** -- device frame transitions, audience switch animations
- **Data feels solid** -- preview must show real-feeling data, not empty states
