# Design System — Build Tracker
*Matches ericzunkley.com aesthetic. Dark, minimal, pill buttons, Inter font.*

---

## Color Tokens

```css
--bg:     #151515   /* page background */
--bg2:    #1e1e1e   /* card background */
--bg3:    #252525   /* input, bar track, inner surfaces */
--fg:     #F1F1F1   /* primary text, active icons */
--muted:  #999999   /* secondary text, inactive icons */
--border: rgba(241,241,241,0.12)  /* card borders, dividers */

/* Accent */
--red:    #D03737   /* danger, over-target, red-pill button */
--blue:   #0457D0   /* protein macro, blue-pill button */
--green:  #049D33   /* success, green-pill button, positive delta */
--yellow: #E8B602   /* warning, carbs macro */
--orange: #d35b2c   /* fat macro, calories bar */
```

**Macro color assignments:**
- Calories → `--fg` (#F1F1F1) white
- Protein → `--blue` (#0457D0)
- Carbohydrates → `--yellow` (#E8B602)
- Fat → `--orange` (#d35b2c)

---

## Typography

```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
```

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Greeting | 22px | 700 | --fg |
| Date | 13px | 400 | --muted |
| Card label | 10px | 700 | --muted, uppercase, 0.08em tracking |
| Card value (big) | 32px | 700 | --fg |
| Stat key | 14px | 400 | --muted |
| Stat value | 14px | 700 | --fg |
| Macro bar label | 12px | 700 | --muted, uppercase |
| Macro bar nums | 11px | 400 | --muted (value span: --fg 700) |
| Nav label | 9px | 500 | inherits from nav-btn |
| Section head label | 10px | 700 | --muted, uppercase, 0.1em tracking |
| Toast | 13px | 500 | -- |

---

## Spacing & Layout

```css
--radius: 16px    /* card border-radius */
--nav-h:  72px    /* bottom nav height */
```

- **Screen padding:** 16px horizontal
- **Card padding:** 16px
- **Card margin-bottom:** 12px
- **Section head margin-top:** 20px (between sections on same screen)
- **Section head margin-bottom:** 10px
- **Gap between nav items:** even flex distribution
- **Divider:** 1px, `var(--border)`, margin 16px 0

---

## Cards

```css
.card {
  background: var(--bg2);
  border: 1.5px solid var(--border);
  border-radius: var(--radius);     /* 16px */
  padding: 16px;
  margin-bottom: 12px;
}
```

**Variants used:**
- `.card` — standard
- `.card-label` — 10px uppercase muted label inside card
- `.card-value.big` — 32px bold number
- `.card-row` — flex row with space-between inside card
- `.stat-row` — flex row: stat-key (muted) + stat-val (bold right-aligned)

---

## Buttons (Pills)

All buttons use `border-radius: 999px` and `1.5px solid` border.

```css
.pill {
  border-radius: 999px;
  border: 1.5px solid var(--border);
  background: transparent;
  color: var(--fg);
  font-weight: 700;
  padding: 10px 20px;
}
.pill.sm    { padding: 7px 14px; font-size: 12px; }
.pill.active { border-color: var(--fg); }

/* Color variants */
.green-pill { border-color: var(--green); color: var(--green); }
.red-pill   { border-color: var(--red);   color: var(--red);   }
.blue-pill  { border-color: var(--blue);  color: var(--blue);  }
```

Hover: `opacity: 0.85`

---

## Section Heads

Horizontal rule with centered label — the line breaks at the label.

```css
.section-head {
  display: flex; align-items: center; gap: 10px;
  margin-bottom: 10px;
}
.section-head__label {
  font-size: 10px; font-weight: 700;
  color: var(--muted); text-transform: uppercase;
  letter-spacing: 0.1em; white-space: nowrap;
}
.section-head__line {
  flex: 1; height: 1px; background: var(--border);
}
```

---

## Macro Bars (Stacked — Home Screen)

Single thick bar (14px height, border-radius 999px) filled left-to-right with colored segments:

```
|████████████████████████░░░░░░░░░░░░░░|
 protein (blue) carbs (yellow) fat (orange)  remaining (--bg3)
```

Segment widths = (macro calories / total target calories) × 100%

Below the bar: dot rows
```
● Protein         126g / 215g
● Carbohydrates   95g  / 195g
● Fat             24g  / 65g
```

Dot: 10px circle, border-radius 50%, macro color
Value: 14px bold `--fg`
Target: 14px normal `--muted`
Turns `--red` if over target by >5%

---

## Nav Bar

```css
nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  height: 72px;
  background: var(--bg2);
  border-top: 1px solid var(--border);
  display: flex;
  padding-bottom: env(safe-area-inset-bottom);
}

.nav-btn {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 4px; font-size: 9px; font-weight: 500;
  color: var(--muted); background: none; border: none;
  transition: color 0.15s;
}
.nav-btn.active { color: var(--fg); }
```

**6 tabs:** Home · Workout · Nutrition · Progress · Log Food · Settings

**Icons:**
- Home, Nutrition, Progress: inline SVG (`stroke: currentColor`)
- Workout: `icons/dumbbell_11421684.png` (PNG)
- Log Food: `icons/cutlery_3141448.png` (PNG)
- Settings: `icons/settings-cog.svg` (SVG via img tag)

**PNG/SVG icon color trick** (black-on-white source → colored on dark bg):
```css
.nav-icon-png {
  width: 20px; height: 20px;
  filter: invert(1) brightness(0.6);    /* inactive: gray #999 */
  mix-blend-mode: screen;
}
.nav-btn.active .nav-icon-png { filter: invert(1) brightness(1); }  /* active: white */
.nav-btn:hover  .nav-icon-png { filter: invert(1) brightness(0.9); transform: scale(1.15); }
```

---

## Inputs

```css
input {
  background: var(--bg3);
  border: 1.5px solid var(--border);
  border-radius: 10px;
  color: var(--fg);
  padding: 10px 14px;
  font-size: 15px;
  width: 100%;
}
input:focus { border-color: rgba(241,241,241,0.4); outline: none; }
```

---

## Toast Notifications

Bottom-center, slides up, auto-dismisses after 2s.

```css
#toast {
  position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%);
  background: var(--fg); color: var(--bg);
  padding: 10px 20px; border-radius: 999px;
  font-size: 13px; font-weight: 700;
  opacity: 0; transition: opacity 0.2s;
  pointer-events: none; z-index: 999;
}
```

---

## Macro Grid (4-box layout)

Used in Nutrition screen for phase targets.

```css
.macro-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.macro-box {
  background: var(--bg3);
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}
.macro-box__val   { font-size: 20px; font-weight: 700; }
.macro-box__label { font-size: 10px; color: var(--muted); text-transform: uppercase; margin-top: 4px; }

/* Value colors */
.macro-box.protein .macro-box__val { color: var(--blue); }
.macro-box.carbs   .macro-box__val { color: var(--yellow); }
.macro-box.fat     .macro-box__val { color: var(--orange); }
```

---

## Progress Bar (linear, full-width)

```css
.progress-bar {
  height: 6px; background: var(--bg3); border-radius: 999px; overflow: hidden;
}
.progress-bar__fill {
  height: 100%; border-radius: 999px;
  transition: width 0.4s ease;
}
```

---

## Ring (SVG circular progress)

Used in Protein Log (now removed from Nutrition tab, may be re-used elsewhere).

```
SVG 70×70, viewBox 0 0 70 70
Circle cx=35 cy=35 r=30
stroke-dasharray: 188.5 (2π×30)
stroke-dashoffset: 188.5 → 0 as progress fills
transform="rotate(-90 35 35)" to start at 12 o'clock
```

---

## Screen Layout

```
┌─────────────────────────┐
│  screen content         │  overflow-y: auto
│  padding: 16px          │  padding-bottom: calc(72px + 16px)
│                         │
│                         │
└─────────────────────────┘
┌─────────────────────────┐
│  nav (fixed, 72px)      │
└─────────────────────────┘
```

Only one `.screen` has `display: block` at a time. Others are `display: none`. Managed by `goScreen(name)`.

---

## Scanner UI

```css
.scanner-wrap {
  position: relative; border-radius: 16px; overflow: hidden;
  aspect-ratio: 4/3; background: #000; margin-bottom: 12px;
}
video { width: 100%; height: 100%; object-fit: cover; }

/* Targeting frame overlay */
.scanner-frame {
  width: 65%; aspect-ratio: 1;
  border: 2px solid rgba(255,255,255,0.8);
  border-radius: 12px;
}

/* Animated scan line */
.scanner-line {
  position: absolute; left: 0; right: 0; height: 2px;
  background: var(--green);
  animation: scan 1.5s ease-in-out infinite alternate;
}
@keyframes scan { from { top: 10%; } to { top: 90%; } }
```
