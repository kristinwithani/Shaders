# Roadmap — Shader Studio

The studio's strategic pivot: from a single-file portfolio artifact to a
**hosted product** (`studio/`, React + Vite + TypeScript), with the original
single-file studio (`figma-shader-orb/index.html`) kept as the reference
implementation. Design source of truth: `figma-shader-orb/DESIGN.md`
("The Oscilloscope") + `.impeccable.md`.

## Done (2026-07)

- **Phase 0 — docs + tokens + scaffold.** DESIGN.md (Stitch format, token
  frontmatter, six named rules) + `.impeccable/design.json` sidecar; token
  system applied to the legacy studio (CSS custom properties, No-Shadow Rule,
  ladder consolidation); `studio/` scaffold with Vercel CSP config
  (`script-src 'unsafe-eval'` for the engine model).
- **Phase 1 — architecture proof.** Engines as verbatim `?raw` source strings
  compiled with `new Function` (live-edit + export preserved); `<ShaderCanvas>`
  imperative island (keyed remount = fresh GL context, rAF outside React,
  config read by reference — zero per-frame re-renders); asset-DOM bridge for
  the engines' `getElementById('asset-*')` contract.
- **Phase 2 — all six shaders.** orb, lava, pixels, particle, tide, bleed on
  the typed registry (`ControlDescriptor` union normalized from the tuple
  schema); generated panel: layers, sub-groups, deps gating with
  auto-collapse, swatch strips, seg presets, rot/crop/file rows, editable
  readouts.
- **Phase 3 — feature parity.** Standalone HTML export (byte-compatible
  template), preset JSON, PNG (in-loop capture), MP4 (MediaRecorder,
  mp4→webm fallback); CodeMirror 6 editor with hot-swap + two-layer
  auto-revert (compile + runtime freeze); deep links (`?shader/?set/?text`)
  and deterministic capture mode (`?t/mx/my`); persistence on the same
  `shader-studio-v1` key with the legacy key-migration preserved
  (`avoidStrength→cursorPull` sign-flip verified) + IndexedDB media; hero
  overlay; whole-app snapshot undo/redo.
- **Phase 4 — the instrument.** ⌘K command palette (cmdk), monochrome toasts
  (Sonner), NumberFlow FPS readout, restrained motion (150ms fades, palette
  enter), keyboard operability, reduced-motion boot-paused.

## Next

- **Deploy.** `cd studio && vercel` — vercel.json carries the CSP
  (unsafe-eval for engines, blob:/data: for media). Confirm engine eval,
  video upload, and MP4 capture on the hosted origin (Risk R1/R3 from the
  migration plan).
- **Share links.** Serialize the active config into a shareable URL
  (`?set=` already covers overrides; add full-preset encoding).
- **Sandboxed engine host.** When share links can carry third-party engine
  code, move eval into a sandboxed iframe (postMessage bridge) so the parent
  origin can drop `unsafe-eval` — planned upgrade, not needed for v1.
- **Accounts / saved projects.** Cloud persistence beyond the browser.
- **Bundle diet.** The default pixels image ships in the JS bundle (~130KB
  base64); move to a fetched asset. Manual chunks for engine sources.
- **Retire or redirect the legacy studio** once the product is deployed and
  linked from the repo README.
