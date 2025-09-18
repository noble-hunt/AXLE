# SwiftUI-Inspired Design System

This document outlines the design tokens and utilities implemented for the AXLE fitness tracking application, following SwiftUI design principles.

## Spacing Scale (8pt Grid)

Our spacing system follows Apple's 8-point grid for consistent, harmonious layouts:

| Token | Value | Usage |
|-------|-------|-------|
| `0.5` | 2px   | Fine adjustments |
| `1`   | 4px   | Micro spacing |
| `1.5` | 6px   | Small gaps |
| `2`   | 8px   | Base unit |
| `3`   | 12px  | Small padding |
| `4`   | 16px  | Medium padding |
| `5`   | 20px  | Large padding |
| `6`   | 24px  | Section spacing |
| `8`   | 32px  | Component spacing |
| `10`  | 40px  | Layout spacing |

## Border Radius

Inspired by SwiftUI's rounded corners:

| Token | Value | Usage |
|-------|-------|-------|
| `md`  | 12px  | Cards, buttons |
| `xl`  | 16px  | Larger containers |
| `2xl` | 24px  | Hero sections, modals |

## Typography Scale

SwiftUI-inspired text hierarchy with format: `size/line-height/weight`

| Token      | Size/Line/Weight | Usage |
|------------|------------------|-------|
| `display`  | 34px/40px/700   | Page titles, hero text |
| `title`    | 28px/34px/700   | Section headings |
| `headline` | 22px/28px/600   | Card titles, important content |
| `body`     | 16px/24px/500   | Body text, descriptions |
| `caption`  | 13px/18px/500   | Labels, metadata |

### Usage Examples

```tsx
<h1 className="text-display">Welcome to AXLE</h1>
<h2 className="text-title">Your Workouts</h2>
<h3 className="text-headline">Today's Session</h3>
<p className="text-body">Track your fitness journey with precision.</p>
<span className="text-caption">Last updated 2 minutes ago</span>
```

## Color Tokens

### Light Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | `hsl(0, 0%, 100%)` | Primary backgrounds |
| `--card` | `hsl(0, 0%, 96.47%)` | Card backgrounds |
| `--primary` | `hsl(96, 85.19%, 73.53%)` | Primary actions, brand |
| `--accent` | `hsl(254, 100%, 92.55%)` | Accent elements |
| `--muted` | `hsl(0, 0%, 96.08%)` | Subtle backgrounds |
| `--border` | `hsl(0, 0%, 96.47%)` | Dividers, outlines |

### Dark Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--surface` | `hsl(228, 9.8%, 10%)` | Primary backgrounds |
| `--card` | `hsl(228, 9.8%, 10%)` | Card backgrounds |
| `--primary` | `hsl(203.77, 87.6%, 52.55%)` | Primary actions, brand |
| `--accent` | `hsl(205.71, 70%, 7.84%)` | Accent elements |
| `--muted` | `hsl(0, 0%, 9.41%)` | Subtle backgrounds |
| `--border` | `hsl(210, 5.26%, 14.9%)` | Dividers, outlines |

## Custom Utilities

### Gradients

| Class | Description |
|-------|-------------|
| `.soft-gradient` | Subtle surface-to-muted gradient |

### Shadows

| Class | Description | Light Mode | Dark Mode |
|-------|-------------|------------|-----------|
| `.shadow-soft` | Minimal shadow for subtle elevation | `0 1px 3px rgba(0,0,0,0.04)` | `0 1px 3px rgba(0,0,0,0.2)` |
| `.shadow-card` | Card elevation with transition | `0 2px 8px rgba(0,0,0,0.06)` | `0 2px 8px rgba(0,0,0,0.3)` |

### Usage Examples

```tsx
// Gradient background
<div className="soft-gradient p-6 rounded-xl">
  Content with subtle gradient
</div>

// Card with shadow
<div className="bg-card shadow-card rounded-md p-4">
  Card content with elevation
</div>

// Soft shadow for subtle elements
<button className="shadow-soft bg-surface rounded-md px-4 py-2">
  Gentle Button
</button>
```

## Framer Motion Variants

Pre-configured animation variants following SwiftUI's natural motion:

### Available Variants

| Variant | Description | Duration |
|---------|-------------|----------|
| `fadeIn` | Opacity fade with smooth easing | 0.3s |
| `slideUp` | Slide from bottom with fade | 0.4s |
| `slideDown` | Slide from top with fade | 0.4s |
| `scale` | Scale up with fade | 0.3s |
| `container` | Stagger container for lists | - |
| `item` | Stagger item for use with container | 0.3s |

### Usage Examples

```tsx
import { motion } from 'framer-motion';
import { fadeIn, slideUp, container, item } from '@/lib/motion-variants';

// Simple fade in
<motion.div variants={fadeIn} initial="initial" animate="animate">
  Content
</motion.div>

// Slide up animation
<motion.div variants={slideUp} initial="initial" animate="animate">
  Content
</motion.div>

// Staggered list
<motion.ul variants={container} initial="initial" animate="animate">
  {items.map(item => (
    <motion.li key={item.id} variants={item}>
      {item.content}
    </motion.li>
  ))}
</motion.ul>
```

## Implementation Notes

- All tokens are CSS custom properties that respect light/dark mode
- Typography uses the configured font stack with proper line heights
- Shadows automatically adapt to dark mode for better contrast
- Motion variants use Apple's preferred easing curves for natural feel
- 8pt spacing ensures consistent rhythm across all components

## Compilation

To ensure tokens compile correctly:

1. Tailwind config includes custom spacing and typography scales
2. CSS variables are defined in both `:root` and `.dark` selectors
3. Utilities layer includes custom shadow and gradient classes
4. Framer Motion variants export standard animation patterns

The design system is fully functional and ready for use across the AXLE application.