# Sophie Hub UX Standards

> Based on Emil Kowalski's Design Engineering Principles
> "Build interfaces with uncommon care."

This document is the definitive UX reference for Sophie Hub, grounded in Emil's design engineering teachings. All new features must follow these patterns.

---

## Quick Decision Flowcharts

### Should I Animate This?

```
Will users see this 100+ times daily?
├── Yes → Don't animate
└── No
    ├── Is this user-initiated?
    │   └── Yes → Animate with ease-out (150-250ms)
    └── Is this a page transition?
        └── Yes → Animate (300-400ms max)
```

### What Easing Should I Use?

```
Is the element entering or exiting?
├── Yes → ease-out
└── No
    ├── Is it moving on screen?
    │   └── Yes → ease-in-out
    └── Is it a hover/color change?
        ├── Yes → ease
        └── Default → ease-out
```

---

## 1. Core Principles (Emil's Foundation)

### No Layout Shift

Dynamic elements should cause no layout shift. Use:
- Hardcoded dimensions for skeletons and placeholders
- `font-variant-numeric: tabular-nums` for changing numbers
- Never change font weight on hover/selected states

### Touch-First, Hover-Enhanced

Design for touch first, then add hover enhancements:
- Disable hover effects on touch devices
- Ensure 44px minimum tap targets
- Never rely on hover for core functionality

### Keyboard Navigation

- Tabbing should work consistently
- Only allow tabbing through visible elements
- Ensure keyboard navigation scrolls elements into view

**Input Mode Switching**: When a component supports both keyboard navigation and mouse hover, they must be mutually exclusive. Use a `usingKeyboard` state:
- `onKeyDown` sets `usingKeyboard = true` → shows focus indicator, hides hover
- `onMouseMove` on container sets `usingKeyboard = false` → hides focus indicator, enables hover
- Never show both focus ring and hover highlight simultaneously

```tsx
const [usingKeyboard, setUsingKeyboard] = useState(false)

// In keyboard handler:
if (!usingKeyboard) setUsingKeyboard(true)

// On container:
onMouseMove={() => { if (usingKeyboard) setUsingKeyboard(false) }}

// In row className:
const isFocused = usingKeyboard && focusedIndex === idx
className={`${isFocused ? 'border-l-primary' : ''} ${!usingKeyboard ? 'hover:bg-muted/30' : ''}`}
```

### Accessibility by Default

- Every animation needs `prefers-reduced-motion` support
- Every icon button needs an aria label
- Every interactive element needs proper focus states

### Speed Over Delight

- Product UI should be fast and purposeful
- Skip animations for frequently-used interactions
- Marketing pages can be more elaborate

---

## 2. Animation System

### The Easing Blueprint

Import from `@/lib/animations`:

```typescript
import { easeOut, easeInOut, easeOutBack, duration } from '@/lib/animations'
```

#### ease-out (Most Common)

Use for **user-initiated interactions**: dropdowns, modals, tooltips, any element entering or exiting.

```css
/* Sorted weak to strong */
--ease-out-quad: cubic-bezier(0.25, 0.46, 0.45, 0.94);
--ease-out-cubic: cubic-bezier(0.215, 0.61, 0.355, 1);
--ease-out-quart: cubic-bezier(0.165, 0.84, 0.44, 1);
--ease-out-quint: cubic-bezier(0.23, 1, 0.32, 1);
--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
```

Why: Acceleration at start creates instant, responsive feeling.

#### ease-in-out (For Movement)

Use when **elements already on screen need to move or morph**. Mimics natural motion.

```css
--ease-in-out-quad: cubic-bezier(0.455, 0.03, 0.515, 0.955);
--ease-in-out-cubic: cubic-bezier(0.645, 0.045, 0.355, 1);
```

#### ease (For Hover Effects)

Use for **hover states and color transitions**:

```css
transition: background-color 150ms ease;
```

#### linear (Avoid in UI)

Only use for:
- Constant-speed animations (marquees, tickers)
- Time visualization (progress indicators)

#### ease-in (Almost Never)

**Avoid.** Makes interfaces feel sluggish because the slow start delays visual feedback.

### Paired Elements Rule

Elements that animate together must use the same easing and duration:

```css
/* Both use the same timing */
.modal { transition: transform 200ms ease-out; }
.overlay { transition: opacity 200ms ease-out; }
```

### Duration Guidelines

| Element Type | Duration |
|--------------|----------|
| Micro-interactions (button press) | 100-150ms |
| Standard UI (tooltips, dropdowns) | 150-250ms |
| Modals, drawers | 200-300ms |
| Page transitions | 300-400ms |

**Rule:** UI animations should stay under 300ms. Larger elements animate slower.

### The Frequency Principle

- **100+ times/day** → No animation (or drastically reduced)
- **Occasional use** → Standard animation
- **Rare/first-time** → Can add delight

### When to Animate

**Do animate:**
- Enter/exit transitions for spatial consistency
- State changes that benefit from visual continuity
- Responses to user actions (feedback)

**Don't animate:**
- Keyboard-initiated actions
- Hover effects on frequently-used elements
- Anything users interact with 100+ times daily
- When speed matters more than smoothness

### No Animation on Page Load

Use `initial={false}` on motion components:

```tsx
// GOOD - no animation on mount
<motion.div
  initial={false}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
/>

// BAD - animates every mount
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
/>
```

### Performance

**Only animate `transform` and `opacity`.** These skip layout and paint.

**Avoid animating:**
- `padding`, `margin`, `height`, `width` (trigger layout)
- `blur` filters above 20px (expensive, especially Safari)
- CSS variables in deep component trees

**Never use `transition: all`:**

```css
/* Bad */
.button { transition: all 200ms ease; }

/* Good - specify exact properties */
.button { transition: background-color 200ms ease, transform 200ms ease; }
```

### Shimmer / Skeleton Loading

Skeleton loaders with a diagonal shimmer wave. Follows Emil's principles:
- **ease-in-out**: Element is already on screen, morphing continuously
- **background-position only**: Lightweight — no layout or paint triggers
- **Hardcoded dimensions**: Prevents layout shift when real content loads

#### Technique

An oversized gradient (`200% width`) whose `background-position` slides back and forth via the `shimmer` `@keyframes` in `globals.css`. Staggering the `animation-delay` per cell creates a diagonal wave.

#### Constants (from `@/lib/animations`)

```typescript
import {
  shimmerDuration,        // 1.5s cycle
  shimmerStagger,         // 40ms per-cell delay
  shimmerClass,           // Tailwind class: bg-size + animate
  shimmerGradient,        // Data cell gradient (muted)
  shimmerGradientHeader,  // Header cell gradient (primary accent)
} from '@/lib/animations'
```

#### Components

**`<ShimmerGrid>`** — Tabular/grid loading states:

```tsx
import { ShimmerGrid } from '@/components/ui/shimmer-grid'

<ShimmerGrid />                          // Default 8×4 grid
<ShimmerGrid variant="table" rows={8} columns={5} showRowNumbers />  // Table with header
<ShimmerGrid variant="list" rows={6} />  // Single-column list
```

| Prop | Default | Description |
|------|---------|-------------|
| `rows` | 8 | Number of data rows |
| `columns` | 4 | Number of columns |
| `variant` | `'grid'` | `'table'` (header row), `'grid'` (uniform), `'list'` (single column) |
| `cellHeight` | 32 | Cell height in px |
| `gap` | 12 | Gap between cells in px |
| `stagger` | 40 | Delay between cells in ms (lower = faster wave) |
| `showRowNumbers` | false | Show row numbers on left |

**`<ShimmerBar>`** — Inline loading placeholders:

```tsx
import { ShimmerBar } from '@/components/ui/shimmer-grid'

<ShimmerBar width={120} height={16} />   // Fixed width
<ShimmerBar width="100%" height={20} />  // Full width
```

#### When to Use

| Scenario | Component |
|----------|-----------|
| Table/grid data loading | `<ShimmerGrid variant="table">` |
| Card grid placeholder | `<ShimmerGrid>` |
| List loading | `<ShimmerGrid variant="list">` |
| Inline text placeholder | `<ShimmerBar>` |
| Single stat/badge | `<ShimmerBar>` with fixed width |

#### When NOT to Use

- **Instant data** — If data loads in <100ms, skip the skeleton (flash of loading is worse)
- **Spinners already present** — Don't combine shimmer with spinner; pick one
- **Frequently re-fetched content** — Use opacity transition instead of full skeleton swap

### Accessibility

Every animation needs `prefers-reduced-motion`:

```css
.modal {
  animation: fadeIn 200ms ease-out;
}

@media (prefers-reduced-motion: reduce) {
  .modal {
    animation: none;
  }
}
```

Framer Motion:

```tsx
import { useReducedMotion } from "framer-motion";

function Component() {
  const shouldReduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    />
  );
}
```

---

## 3. Typography

### Font Rendering

Always apply antialiased font smoothing:

```css
body {
  -webkit-font-smoothing: antialiased;
}
```

### Preventing Layout Shift

**Never change font weight on hover or selected states:**

```css
/* Bad - causes layout shift */
.tab:hover { font-weight: 600; }

/* Good - consistent weight */
.tab { font-weight: 500; }
.tab.selected { color: var(--color-primary); }
```

**Tabular numbers for dynamic values:**

```css
.counter { font-variant-numeric: tabular-nums; }
```

### Text Wrapping

Use `text-wrap: balance` on headings:

```css
h1, h2, h3 { text-wrap: balance; }
```

### Proper Characters

| Instead of | Use |
|------------|-----|
| `...` | `…` (ellipsis) |
| `'` | `'` (curly apostrophe) |
| `"` | `"` (curly quotes) |

---

## 4. Visual Design

### Shadows for Borders

Use shadows instead of borders for better blending:

```css
/* Instead of border: 1px solid rgba(0,0,0,0.08) */
box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.08);
```

### Hairline Borders

Use 0.5px borders on retina displays:

```css
:root {
  --border-hairline: 1px;
}

@media (min-device-pixel-ratio: 2) {
  :root {
    --border-hairline: 0.5px;
  }
}
```

### Gradients

- Use **eased gradients** over linear for solid colors (less banding)
- Prefer `mask-image` over gradients for fades
- **Don't apply fade on scrollable lists** — cuts off content

### Scrollbars

Don't replace page scrollbars. Only customize in small elements like code blocks:

```css
.code-block::-webkit-scrollbar {
  width: 8px;
}
.code-block::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
}
```

### Z-Index Scale

Use a fixed scale. Avoid `z-index: 9999`.

```css
:root {
  --z-dropdown: 100;
  --z-modal: 200;
  --z-tooltip: 300;
  --z-toast: 400;
}
```

Better: Use `isolation: isolate` to create stacking contexts without z-index.

### Safe Areas

Account for device notches:

```css
.footer { padding-bottom: env(safe-area-inset-bottom); }
.sidebar { padding-left: env(safe-area-inset-left); }
```

### Scroll Margins

```css
[id] { scroll-margin-top: 80px; /* Height of sticky header */ }
```

### Focus Outlines

Don't change outline color to anything other than grey, black, or white.

### Dark Mode

Use CSS variables that flip, not Tailwind `dark:` everywhere:

```css
/* Good - variables flip automatically */
.button {
  background: var(--gray-12);
  color: var(--gray-1);
}

/* Avoid - manual dark mode overrides */
.button { @apply bg-gray-900 dark:bg-gray-100; }
```

### Decorative Elements

```css
.decorative-bg { pointer-events: none; }
.illustration { user-select: none; }
```

---

## 5. Forms & Controls

### Labels

Clicking label must focus input:

```html
<label for="email">Email</label>
<input id="email" type="email" />

<!-- Or wrap -->
<label>
  Email
  <input type="email" />
</label>
```

### Input Types

Use appropriate types: `email`, `password`, `tel`, `url`, `number`, `search`

### Font Size (iOS)

**Inputs must be 16px+ to prevent iOS zoom on focus:**

```css
input, textarea, select { font-size: 16px; }
```

### Autofocus

- Autofocus on desktop when modal opens
- **Never autofocus on touch devices** — opens keyboard unexpectedly

```tsx
const isTouchDevice = 'ontouchstart' in window;
<input autoFocus={!isTouchDevice} />
```

### Form Wrapper

Always wrap inputs in `<form>` for Enter submission:

```html
<form onSubmit={handleSubmit}>
  <input type="text" />
  <button type="submit">Submit</button>
</form>
```

### Keyboard Submission

Support `Cmd+Enter` / `Ctrl+Enter` for textareas:

```tsx
function handleKeyDown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    handleSubmit();
  }
}
```

### Buttons

**Always use `<button>`, never clickable divs.**

**Press feel** is built into our Button component:

```tsx
// Already applied in src/components/ui/button.tsx
active:scale-[0.97] transition-[color,background-color,border-color,transform]
```

**Show shortcuts in tooltips:**

```tsx
<Tooltip content="Save (⌘S)">
  <button>Save</button>
</Tooltip>
```

**Disable after submit** to prevent double-submits.

### Tabs - Sliding Indicator

Tabs should have a **sliding background** that moves between selections:

```tsx
// Use layoutId for spring-physics animation between tabs
{isActive && (
  <motion.div
    layoutId="activeTab"
    className="absolute inset-0 bg-background shadow-md rounded-lg"
    transition={{ type: 'spring', bounce: 0.15, duration: 0.4 }}
  />
)}
<span className="relative z-10">{label}</span>
```

This creates a connected, fluid experience. See SheetTabBar and Sidebar for examples.

### Checkboxes - No Dead Zones

The space between checkbox and label must be clickable:

```html
<label class="checkbox-row">
  <input type="checkbox" />
  <span>Remember me</span>
</label>
```

### Input Decorations

Icons should be absolutely positioned, not siblings:

```css
.input-wrapper { position: relative; }
.input-icon {
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.input-field { padding-left: 40px; }
```

### Error Messages

Colocate errors close to the field:

```tsx
<div className="field">
  <input type="email" aria-invalid={!!error} />
  {error && <span className="error">{error}</span>}
</div>
```

---

## 6. Touch & Accessibility

### Hover Effects

Disable on touch devices:

```css
@media (hover: hover) and (pointer: fine) {
  .element:hover { transform: scale(1.05); }
}
```

**Never rely on hover for core functionality.**

### Touch Action

Prevent double-tap zoom on controls:

```css
button, a, input { touch-action: manipulation; }
```

### Tap Targets

Minimum 44px, even if visual size is smaller:

```css
.icon-button {
  width: 24px;
  height: 24px;
  position: relative;
}

.icon-button::before {
  content: '';
  position: absolute;
  inset: -10px; /* Expands hit area */
}
```

### ARIA Labels

Always on icon buttons:

```html
<button aria-label="Close dialog">
  <CloseIcon />
</button>
```

### Focus Management

- When opening modals, move focus to first interactive element
- When closing, return focus to trigger element
- Use `inert` attribute to hide from tab order:

```tsx
<div inert={!isVisible}>...</div>
```

### Video Autoplay

```html
<video autoplay muted playsinline loop>
  <source src="video.mp4" type="video/mp4" />
</video>
```

For reduced motion users, show play button instead.

### OS-Specific Shortcuts

```ts
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
const modKey = isMac ? '⌘' : 'Ctrl';
```

### Tooltips

- Add 200ms delay before appearing
- **Sequential tooltips:** Once one is open, others open with no delay

---

## 7. Responsive Design

### Breakpoints

| Breakpoint | Width | Usage |
|------------|-------|-------|
| Default | < 640px | Mobile phones |
| `sm` | 640px+ | Mobile landscape |
| `md` | 768px+ | Tablets — **PRIMARY** |
| `lg` | 1024px+ | Desktops |
| `xl` | 1280px+ | Large desktops |

### Mobile-First

```tsx
// GOOD
<div className="p-4 md:p-8">

// BAD
<div className="p-8 max-md:p-4">
```

### Text Truncation

```tsx
<span className="truncate max-w-[80px] md:max-w-[120px]">{text}</span>
<p className="line-clamp-2">{text}</p>
```

### Responsive Patterns

```tsx
// Stack mobile, grid desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Stats grid - 2 columns on mobile, 4 on desktop
<div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">

// Hide/show
<div className="hidden md:block">  {/* Desktop only */}
<div className="md:hidden">        {/* Mobile only */}

// Horizontal scroll
<div className="overflow-x-auto scrollbar-hide">
  <div className="flex gap-2 min-w-max">
```

### Touch Target Patterns

Buttons should be larger on mobile (44px min) and can be smaller on desktop:

```tsx
// Standard button - taller on mobile, smaller on desktop
<Button className="h-10 md:h-9">Action</Button>

// Icon-only button
<Button className="h-9 w-9 md:h-8 md:w-8 p-0">
  <Icon className="h-4 w-4" />
</Button>

// Inline buttons (in cards, lists)
<button className="py-2 md:py-1.5 px-3 text-sm">Label</button>

// Filter tabs
<button className="px-3 py-2.5 md:py-2 text-sm">Tab</button>
```

### Responsive Spacing

```tsx
// Page padding
<div className="p-4 md:p-8">

// Section gaps
<div className="space-y-3 md:space-y-4">

// Inline gaps
<div className="flex items-center gap-2 md:gap-4">
```

### Responsive Widths

```tsx
// Popover widths - narrower on mobile
<PopoverContent className="w-48 md:w-56">

// Dialog widths - viewport-aware on mobile
<DialogContent className="max-w-[95vw] md:max-w-[700px]">

// Select triggers
<SelectTrigger className="w-[120px] md:w-[160px] h-10 md:h-9">
```

### Responsive Text

```tsx
// Text sizes that scale
<p className="text-xs md:text-sm">

// Labels that hide on mobile (icon only)
<Button>
  <Icon className="h-4 w-4 md:mr-1.5" />
  <span className="hidden md:inline">Label</span>
</Button>
```

### Viewport-Aware Panels

When a panel contains a scrollable list plus fixed header/footer, use flex-col with viewport height to keep buttons visible:

```tsx
// Container fills viewport minus chrome (header, tabs, padding)
<div className="flex flex-col h-[calc(100vh-180px)]">
  <div className="flex-shrink-0">Header / Controls</div>
  <ScrollArea className="flex-1 min-h-[200px]">
    {/* Scrollable content */}
  </ScrollArea>
  <div className="flex-shrink-0">Footer / Action Buttons</div>
</div>
```

Key rules:
- **Never use fixed heights** like `h-[380px]` on scroll areas inside panels — buttons get pushed off-screen
- **`flex-shrink-0`** on all non-scrollable elements (header, footer, filter bars)
- **`flex-1 min-h-0`** on intermediate flex containers to allow shrinking below content size
- **`min-h-[200px]`** on scroll area as safety floor

---

## 8. Error Handling

### Toast Notifications

```tsx
import { toast } from 'sonner'

toast.success('Changes saved')
toast.error('Failed to save', {
  action: { label: 'Retry', onClick: handleRetry }
})

// Loading → Success pattern
const toastId = toast.loading('Saving...')
toast.success('Saved!', { id: toastId })
```

### SessionMonitor

Automatically handles auth errors:
1. Detects `session.error === 'RefreshAccessTokenError'`
2. Intercepts 401 responses
3. Shows toast, redirects to sign-in

---

## 9. Performance

### Lists & Virtualization

Virtualize large lists with `@tanstack/react-virtual`.

**Never use Framer Motion `layout` prop on large lists** (100+ items). The `layout` prop triggers layout recalculation on every state change across all items. Use plain `<div>` with CSS `transition-colors` instead:

```tsx
// BAD — 200 items with layout prop = severe lag
<motion.div layout className="..." />

// GOOD — plain div with CSS transitions
<div className="transition-colors duration-100 active:scale-[0.997]" />
```

### Keyboard Navigation Scroll

Use `behavior: 'instant'` for keyboard-driven `scrollIntoView` (ArrowUp/ArrowDown). Smooth scrolling causes visible lag when holding keys because each animation must complete before the next starts:

```tsx
// BAD — smooth + rapid keystrokes = queued animations, visible lag
row.scrollIntoView({ block: 'nearest', behavior: 'smooth' })

// GOOD — instant scroll on keyboard, smooth only for infrequent user clicks
row.scrollIntoView({ block: 'nearest', behavior: 'instant' })
```

Reserve `behavior: 'smooth'` for user-initiated one-off actions (clicking a row, jumping to a section).

### React Performance

Animate outside React's render cycle when possible:

```tsx
// Bad - re-renders every frame
const [position, setPosition] = useState(0);

// Good - direct DOM manipulation
const ref = useRef(null);
useEffect(() => {
  ref.current.style.transform = `translateX(${pos}px)`;
}, [pos]);
```

### Off-Screen Content

Pause looping animations when off-screen using IntersectionObserver.

---

## 10. Component Design

### Compound Components

Use for multi-part components sharing state:

```tsx
<Dialog>
  <Dialog.Trigger>Open</Dialog.Trigger>
  <Dialog.Content>
    <Dialog.Title>Are you sure?</Dialog.Title>
    <Dialog.Close>Cancel</Dialog.Close>
  </Dialog.Content>
</Dialog>
```

### Customization Balance

```tsx
// Just right - variants + escape hatch
<Button variant="primary" size="md" className="custom">
  Click
</Button>
```

### Props API

- Consistent naming (`disabled`, not `isDisabled`)
- Positive booleans (avoid double negatives)
- Event handlers: `onChange`, `onBlur`, `onOpenChange`

### Always Forward Refs

```tsx
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, ...props }, ref) => (
    <button ref={ref} {...props}>{children}</button>
  )
);
```

### Spread Remaining Props

```tsx
function Button({ variant, size, className, ...props }) {
  return <button className={cn(variants({ variant, size }), className)} {...props} />;
}
```

---

## 11. Visual Consistency Principle

**When the same data appears in multiple places, it must look identical.**

Example: Header status (grey/orange/green dot) appears in:
- Tab bar (`SheetTabBar`)
- Grid cards (`TabCard`)
- List rows (`TabListRow`)

All three MUST use the exact same indicator. When adding a new indicator, update ALL views.

---

## 12. No Fake Data

> **Every number, stat, and piece of information in the UI MUST come from the database.**

The UI is a **window into the database**.

- **DO**: Query tables, derive stats, auto-update from single source of truth
- **DON'T**: Hardcode numbers, create separate progress fields, show mock data

---

## Review Checklist

Before shipping any component:

- [ ] No layout shift on dynamic content
- [ ] Animations have reduced motion support
- [ ] Touch targets are 44px minimum
- [ ] Hover effects disabled on touch devices
- [ ] Keyboard navigation works properly
- [ ] Icon buttons have aria labels
- [ ] Forms submit with Enter/Cmd+Enter
- [ ] Inputs are 16px+ to prevent iOS zoom
- [ ] No `transition: all`
- [ ] z-index uses fixed scale
- [ ] Same data looks identical everywhere
- [ ] All stats from database (no hardcoded numbers)

---

## Common Mistakes

| Mistake | Fix |
|---------|-----|
| `transition: all` | Specify exact properties |
| Hover effects on touch | Use `@media (hover: hover)` |
| Font weight change on hover | Use consistent weights |
| Animating `height`/`width` | Use `transform` and `opacity` only |
| No reduced motion support | Add `prefers-reduced-motion` query |
| z-index: 9999 | Use fixed scale or `isolation: isolate` |
| Custom page scrollbars | Only customize in small elements |
| Animation on page load | Use `initial={false}` |

---

## Quick Reference

```tsx
// Animation - no mount animation
<motion.div initial={false} animate={{ opacity: 1 }} />

// Toast
import { toast } from 'sonner'
toast.success('Saved')
toast.error('Error', { action: { label: 'Retry', onClick: fn } })

// Responsive truncation
className="truncate max-w-[80px] md:max-w-[120px]"

// Touch-friendly button
className="h-11 min-w-[44px] px-4 active:scale-[0.97]"

// Tabular numbers
className="tabular-nums"

// Hover only on non-touch
@media (hover: hover) and (pointer: fine) { .el:hover { ... } }

// Safe area padding
className="pb-safe"
```
