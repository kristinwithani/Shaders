---
name: Shader Studio
description: A monochrome instrument panel for six luminous WebGL shaders.
colors:
  ink: "#111111"
  paper: "#ffffff"
  hairline: "#e4e4e4"
  dim: "#6a6a6a"
  graphite: "#3d3d3d"
  slate: "#555555"
  section-rule: "#c9c9c9"
  field-wash: "#fafafa"
  hover-wash: "#f2f2f2"
  canvas-amber: "#f9b85f"
  canvas-sand: "#d9ccb0"
  canvas-sky: "#b6d9ff"
  canvas-ultramarine: "#2a00ff"
typography:
  display:
    fontFamily: "Satoshi, -apple-system, Helvetica Neue, sans-serif"
    fontSize: "52px"
    fontWeight: 500
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.8125rem"
    fontWeight: 700
    letterSpacing: "0.09em"
  title:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.75rem"
    fontWeight: 700
    letterSpacing: "0.1em"
  body:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.71875rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    letterSpacing: "0.05em"
  label-strong:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 700
    letterSpacing: "0.05em"
  readout:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.71875rem"
    fontWeight: 700
  micro:
    fontFamily: "ui-monospace, JetBrains Mono, Menlo, monospace"
    fontSize: "0.625rem"
    fontWeight: 400
    letterSpacing: "0.05em"
rounded:
  none: "0"
  control: "4px"
  well: "6px"
  pill: "999px"
  circle: "50%"
  arch: "999px 999px 40px 40px"
spacing:
  half: "4px"
  tight: "6px"
  beat: "8px"
  step: "12px"
  gutter: "16px"
  stage: "30px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 6px"
  button-ghost:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "8px 6px"
  button-quiet:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.dim}"
    typography: "{typography.micro}"
    rounded: "{rounded.none}"
    padding: "6px"
  tab:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    padding: "8px 4px"
  tab-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.label-strong}"
    rounded: "{rounded.none}"
    padding: "8px 4px"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "6px 8px"
  swatch:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.none}"
    size: "22px"
---

# Design System: Shader Studio

## 1. Overview

**Creative North Star: "The Oscilloscope"**

The studio is a measurement instrument. The chrome is the bezel: matte, monochrome, engraved with small uppercase labels. The shader canvas is the phosphor screen, the one luminous thing in the room, and every design decision exists to keep it that way. The panel measures, frames, and adjusts the signal; it never performs alongside it. Personality in three words: calibrated, dense, confident.

This is a product surface, an instrument rather than a toy. Density is a feature: many controls, tightly stacked, every one labeled, legible, and predictable. Restraint is the discipline that makes density readable: one ink, one family of greys, hairline structure, sharp corners, and a single interaction signature (invert to ink) doing the work that lesser tools hand to accent colors and glows. Motion follows the same doctrine. Transitions are functional confirmations of state, 150 to 200ms, ease curves, nothing choreographed; one slow 600ms fade is reserved for the ambient canvas hint. Under `prefers-reduced-motion`, shaders boot paused.

The system explicitly rejects its era's defaults: AI-slop dashboards (dark mode + neon glow, glassmorphism, gradient text), generic Tailwind card grids, and rounded-everything SaaS chrome. Light theme only; the canvas supplies darkness and color when the work calls for it.

**Key Characteristics:**
- Monochrome chrome; panel color appears only as a live readout of canvas state
- JetBrains Mono UI text with uppercase, letter-spaced micro-labels on a fixed label rail
- Borderless wash texture: structure comes from soft fills and spacing, not outlines
- Micro-radius scale (4px controls, 6px wells); ink inversion reserved for the primary action
- Tinted meters: value-fill sliders that sample the live color they govern
- Functional motion only: 150 to 200ms state confirmations, reduced-motion respected

*Note (Tinted Meter revision, 2026-07): this doc describes the product studio
(`studio/`). The legacy single-file studio retains the earlier sharp/invert
dialect of the same system.*

## 2. Colors: The Bezel and the Signal

A one-ink instrument: black text and structure on white, a disciplined ladder of greys between them, and four signal colors that live only on the canvas.

### Primary
- **Signal Ink** (#111111): The only chromatic voice the panel has. Text, emphasis borders, active fills, slider thumbs, checkbox accents, and the focus ring. Never true black; #111 keeps the bezel matte rather than void.

### Neutral
- **Instrument White** (#ffffff): The panel and page surface. The studio is light-theme only; darkness is the canvas's job.
- **Hairline** (#e4e4e4): The structural grey. Default borders, slider tracks, and the 1px gaps that read as engraved separators in the tab grid.
- **Section Rule** (#c9c9c9): A half-step darker rule under top-level layer sections, so section boundaries read above ordinary hairlines.
- **Dim Readout** (#6a6a6a): Secondary text. The FPS readout, hints, unit suffixes, quiet-button labels, and collapsed-marker glyphs.
- **Label Graphite** (#3d3d3d): Control labels and help prose. Darker than Dim Readout because these lines are read constantly, not glanced at.
- **Sublabel Slate** (#555555): Sub-section summaries inside layers. Sits between Graphite and Dim by design; a candidate for consolidation into one of its neighbors.
- **Field Wash** (#fafafa): The faint recess behind editable surfaces: the code drawer's editor, a readout mid-edit, the crop preview.
- **Hover Wash** (#f2f2f2): The lightest possible acknowledgment; inactive tab hover only.

### The Canvas Palette (signal, not chrome)
Forbidden in the panel. These are the signature shader colors, recurring across presets, and they appear in the chrome only inside color-swatch wells:
- **Core Amber** (#f9b85f): The orb's radiant center ring.
- **Halo Sand** (#d9ccb0): The second ring, a warm neutral falloff.
- **Ring Sky** (#b6d9ff): The third ring, the cool outer band.
- **Spike Ultramarine** (#2a00ff): The 250 spikes; the palette's single voltage.

### Named Rules
**The One-Ink Rule.** The panel is monochrome. Ink, white, and the grey ladder are the entire chrome vocabulary; any other color on the bezel is a defect. Color belongs to the canvas and to swatch wells reporting canvas state.

**The Invert Rule (revised).** Ink inversion is reserved for the single primary action on a surface (export, apply) and the on-state of a switch. Everything else selects quietly: a deeper wash step plus weight. Nothing glows.

**The Sampled Tint Rule.** A meter is tinted only when its slider governs a specific color's geometry, and it takes that color's live value (mixed ~45% into Instrument White). Change the ring, the meter follows. Panel color is information — a readout of canvas state — never decoration; sliders that govern nothing chromatic stay monochrome.

## 3. Typography

**Display Font:** Satoshi (with -apple-system, Helvetica Neue fallbacks); hero overlay only
**UI/Mono Font:** ui-monospace, JetBrains Mono (with Menlo fallback); everything else

**Character:** A lab journal set entirely in mono, with one borrowed editorial voice. The mono carries every label, value, and control at small sizes with wide tracking; Satoshi exists solely so the hero overlay can preview how a real landing page would sit on top of the shader.

### Hierarchy
- **Display** (500, 52px, 1.08, -0.02em): Hero overlay headline. The only large type and the only non-mono voice in the system. Overlay body runs 18px/1.6 and its link 16px/1.6, both regular weight.
- **Headline** (700, 0.8125rem, 0.09em tracking, uppercase): The panel title. One per screen.
- **Title** (700, 0.75rem, 0.1em tracking, uppercase): Layer section summaries; the widest tracking in the system marks the deepest structure.
- **Body** (400, 0.71875rem, 1.55): The panel's base size: help prose and control labels. The code drawer's editor runs one rung smaller (0.6875rem) on the same 1.55 leading.
- **Label** (400, 0.6875rem, 0.05em tracking, uppercase): The workhorse. Buttons, tabs, chips, file names, menu items, status lines.
- **Label Strong** (700, 0.6875rem, 0.05em tracking): Tabs; same size as Label, weight does the emphasis.
- **Readout** (700, 0.71875rem, tabular figures): Slider values. Body-sized bold with no tracking, right-aligned.
- **Micro** (400, 0.625rem, 0.05em tracking, uppercase): Quiet utility buttons only; the smallest legible rung.

### Named Rules
**The Micro-Label Rule.** Every UI label is uppercase, 0.6875rem or smaller, and tracked at least 0.05em. Hierarchy comes from weight (400, 600, 700) and tracking (0.05 to 0.1em), never from size jumps inside the panel. The code status line is tracked feedback prose; like the canvas hint, it is exempt from the uppercase clause.

**The Tabular Rule.** Slider value readouts are set in tabular figures, weight 700, right-aligned; values must not jitter as digits change. The FPS line and rotate input carry the same tabular figures at regular weight (telemetry and input, not readouts); the crop zoom readout complies in full.

**The Two-Voices Rule.** Satoshi appears only inside the hero overlay preview. A display face in the chrome (buttons, labels, panel text) is prohibited.

## 4. Elevation

The system is strictly flat. There are no shadows; depth is drawn, not cast. Structure comes from 1px borders (Signal Ink for emphasis and interactive frames, Hairline for separation), from 1px gaps that read as engraved lines, and from the Invert Rule marking what is active. Floating surfaces (menus, popovers, the help card) declare themselves with a 1px Signal Ink border and opaque Instrument White fill; overlap plus a drawn frame is all the depth an instrument needs. Sticky surfaces (the panel header and footer) separate with a hairline, not a scrim.

The chrome carries no `box-shadow` anywhere. The text-editor popover and the help card, once the system's two legacy blurs, now float on their 1px Signal Ink frames alone.

### Named Rules
**The No-Shadow Rule.** `box-shadow` is prohibited. If a surface floats, frame it in 1px Signal Ink. If a frame is not enough, the surface is wrong.

## 5. Components

Controls are refined and restrained: the invert is a quiet confirmation, not a mechanical slam. Fields and wells recess by one wash step; frames sharpen from Hairline to Signal Ink under the cursor; nothing bounces, glows, or inflates. Every interactive element answers hover, focus, active, and disabled states within the same monochrome vocabulary. Focus is universal: a 2px Signal Ink outline, offset 1px.

### Buttons
Four voices, one shape: 4px radius, uppercase mono label, borderless.
- **Primary** (Signal Ink fill, Instrument White text): The one inverted control per surface — export, apply. Hover eases fill opacity to 0.86; pressed drops to 0.7.
- **Chip** (Field Wash fill, Signal Ink text): Everything actionable that isn't primary — save, undo/redo, revert, copy, file wells. Hover deepens one wash step.
- **Quiet** (Micro type, Field Wash fill, Dim Readout text): Canvas utilities. Hover deepens the wash and promotes the text to ink.
- **Link** (no frame, no padding, Dim Readout text, dotted underline): Inline utilities like clearing saved state. Hover promotes the text to Signal Ink.
- **Disabled** (any voice): opacity 0.25, cursor default. Gated controls (a layer switched off) dim to 0.35 and ignore the pointer.

### Panel Shell
A fixed 300px column behind a hairline left rule. The header (title, tabs, history, FPS) sticks to the top and the footer's button rows stick to the bottom, both separating with hairlines over opaque Instrument White. Footer rows stack quiet utilities above commit actions on the 8px beat.

### Shader Tabs
A 3-column grid of chips resting in a Field-Wash track (6px radius, 2px inset). Tabs rest as Dim text on the track; hover raises a Hover-Wash chip; the active tab sits on a Hairline-3 chip in Label Strong. Tab counts that break the grid resolve by widening the last tab to fill its row.

### Tinted Meter
The signature control (supersedes the thumb slider). A 14px Field-Wash bar, 4px radius; the fill IS the value — Hairline-4 grey by default, or the sampled tint where the Sampled Tint Rule applies. A 3px Signal Ink cursor marks position and grows on hover; a 1px tick marks the factory default. Rows sit on a 96px label rail with a 52px readout column, one line per parameter; hovering the label explains the parameter (ink-framed tooltip), double-clicking it resets to factory. Adjacent min·max parameters merge into one dual-cursor meter with a joined range readout. Labels are copy-edited to fit the rail (the tooltip carries the full name) and may wrap to two lines; they never ellipsize.

### Editable Readout
Every meter value is also an input. At rest: the Readout voice, tabular, right-aligned. Hover underlines with a dotted ink rule to disclose editability; mid-edit the readout takes a 1px ink outline over Field Wash and accepts typed precision. Range readouts display as lo–hi.

### Switch
Layer power and inline booleans are a 26x15px pill switch: Hairline-4 wash when off, Signal Ink when on, paper thumb sliding 150ms. Native checkboxes do not appear in the chrome.

### Color Swatches
A 22x22px well with a 1px Hairline frame, sharp corners, the raw color inside. Consecutive color controls merge into one horizontal swatch strip with 4px gaps; the strip is the only place the canvas palette touches the panel.

### Segmented Control
Equal-width borderless wash chips, 4px radius and gaps. Selected = one wash step deeper plus weight. Preset segments carry a meter-band of their palette along the bottom edge — colors sampled from the preset's own value bundle, 55% opacity at rest, saturating on hover and selection. The band is the theme's preview. **The Breakout Rule:** copy is never squeezed — if any chip's text cannot fit beside the label rail (measured, not guessed), the whole seg drops onto its own full-width line below the label.

### Field Rows
- **File well** (full-width, left-aligned, uppercase, 1px Hairline border): Shows the loaded file name, ellipsized; hover sharpens the frame to ink.
- **Rotate row**: A 52px right-aligned numeric input with spinners suppressed, a Dim unit suffix, and a step button that quarter-turns the media.
- **Crop well**: A live preview canvas on Field Wash behind a Hairline frame; grab and grabbing cursors while panning, plus/minus steppers and a tabular zoom readout beneath.

### Layer Sections
Collapsible layers with a Dim Readout disclosure glyph that swaps from ▸ to ▾ when open and earns ink under the cursor, a Title-voice summary, and a Section Rule bottom border. A layer's power switch sits at the summary's right edge as an ink-accented checkbox; switched off, the layer's controls stay visible but gated at 0.35 opacity. Sub-sections indent 26px and speak in Sublabel Slate at weight 600, the ladder's only 600 and a candidate to consolidate to 700. Boolean controls reuse the same ink-accented native checkbox inline, left-aligned in the control grid.

### Export Drop-Up
The summary is a primary button with a direction glyph that flips between up and down. The menu rises above it as an Instrument-White list framed in 1px Signal Ink; items are uppercase, left-aligned, hairline-separated, and invert fully on hover.

### Code Drawer
A bottom drawer with a hairline top rule. The bar holds a Label voice title, apply as primary, revert and copy as ghosts, and a Dim status line that ellipsizes. The editor is a 38vh mono field on Field Wash, borderless except the hairline above, tab-size 2.

### Hero Overlay
The landing-page preview: Display-voice headline, 18px body, and a link whose arrow slides 4px rightward over 0.2s on hover. It renders above the canvas and belongs to the signal, not the bezel.

### Text Tools
Two ink-framed chips above the canvas in the Label voice; the text toggle obeys the Invert Rule when on. The edit chip opens a 250px popover floating on a 1px Signal Ink frame per the No-Shadow Rule, holding hairline-framed title, body, and button-label fields at 6px gaps.

### Help
A 20px circular ghost key in the panel header (the system's second curve), inverting on hover. It opens a fixed 320px card framed in 1px Signal Ink: Body prose with uppercase Label-weight terms over Label Graphite definitions, closed by a ghost button that inverts. Its heading runs in the Title voice.

### Canvas Frame
The screen itself: an arched window (999px 999px 40px 40px) sized at 88cqmin, crosshair cursor, no border. When the hero overlay is on, the frame yields to 60cqmin so the text preview and the signal share the stage; vmin fallbacks cover browsers without container-query units. The one curve in the system, and it belongs to the signal.

### Canvas Hint
A Dim Readout prose line tucked under the canvas edge, 0.6875rem on 1.5 leading at a relaxed 0.02em (prose, not a label, so exempt from the Micro-Label Rule), fading in and out over the reserved 600ms.

## 6. Do's and Don'ts

### Do:
- **Do** keep the panel monochrome: Signal Ink (#111111), Instrument White (#ffffff), and the named grey ladder are the entire chrome palette.
- **Do** reserve ink inversion for the primary action and switch on-states; selection elsewhere is a deeper wash plus weight.
- **Do** build resting structure from wash fills and spacing; 1px Signal Ink frames belong to floating surfaces (menus, popovers, tooltips), hairlines to the panel's sticky edges.
- **Do** tint a meter only by sampling the live color it governs; a tint that isn't a readout is a defect.
- **Do** set every label uppercase in the mono stack, 0.6875rem or smaller, tracked 0.05em or wider.
- **Do** set slider readouts in tabular figures, 700, right-aligned, and keep them click-to-edit; the FPS line, crop zoom, and rotate input share the same figures.
- **Do** reference the named tokens instead of raw values; the ladder lives as CSS custom properties (--ink, --paper, --hairline, --section-rule, --dim, --graphite, --slate, --field-wash, --hover-wash) precisely so no new grey is ever invented.
- **Do** hold spacing to the ladder: 4/6/8/12/16px with the 8px beat carrying vertical rhythm; the only off-ladder values that remain are optical offsets and the hero overlay's editorial margins, and they belong to the signal, not the bezel.
- **Do** keep motion functional: 150 to 200ms ease on state changes, and boot shaders paused under `prefers-reduced-motion`.
- **Do** give every interactive element the universal focus ring: 2px Signal Ink outline, offset 1px.
- **Do** keep every text grey at or above 4.5:1 on its wash: Dim Readout (#6a6a6a) is the lightest permitted text color, 5.41:1 on Instrument White and 5.19:1 on Field Wash; no lighter grey may carry text.
- **Do** keep every control keyboard-operable: sliders nudge with arrow keys, readouts open to edit from focus, and the focus ring is never suppressed.

### Don't:
- **Don't** build AI-slop dashboards: dark mode + neon glow, glassmorphism, and gradient text are prohibited by name.
- **Don't** reach for generic Tailwind card grids or rounded-everything SaaS chrome; the micro-radius scale (4px controls, 6px wells) is the ceiling — anything rounder belongs to the switch pills, the help key, and the canvas arch alone.
- **Don't** put color on the bezel. If a screenshot of the panel contains anything beyond ink, white, and the grey ladder outside a swatch well, the chrome has failed.
- **Don't** cast shadows. The chrome carries none; the popover and help card float on their 1px Signal Ink frames, and no blur returns.
- **Don't** use a display face in the chrome; Satoshi exists only inside the hero overlay preview.
- **Don't** use colored side-stripe borders, hero-metric stat blocks, or modal dialogs where an inline surface will do; the studio has none and gains none.
- **Don't** ship a dark theme. Light theme only; the canvas supplies darkness when the work calls for it.
- **Don't** animate layout properties or add entrance choreography; the instrument is already on when you sit down.
