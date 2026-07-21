# Shader Studio (product)

The hosted studio: React + Vite + TypeScript. Six live WebGL shaders (orb,
lava, pixels, particle, tide, bleed), a generated control panel, live engine
editing (CodeMirror), export (standalone HTML / preset JSON / PNG / 10s MP4),
deep links + deterministic capture mode, browser persistence, unlimited undo,
⌘K command palette.

```bash
npm install
npm run dev        # http://localhost:5181
npm run build      # typecheck + production bundle
npm run preview
```

Deploy: `vercel` from this directory. `vercel.json` sets the CSP the engine
model needs (`script-src 'unsafe-eval'`; `blob:`/`data:` for media).

## Architecture in one paragraph

Each shader engine is a **verbatim JS source string** (`src/engines/*.engine.js`,
imported with `?raw`) compiled at runtime with `new Function` — the same text
runs live, seeds the editor, and is inlined into standalone exports. Engines
read the live config **by reference** every frame and find uploaded media via
hidden `<script id="asset-*">` DOM nodes (`src/runtime/assetDom.ts`), so the
React shell never sits between the engine and its data. `<ShaderCanvas>` is the
imperative island: one canvas, one GL context, one rAF loop per mount, remounted
(`key = activeId:epoch`) for a fresh context on every switch. Zustand holds the
reactive chrome state plus two counters: `rev` (panel re-render) and `epoch`
(canvas remount). Saves stay on the original `shader-studio-v1` localStorage
key + `shader-studio-assets` IndexedDB, with the legacy key migration
preserved — old saves load unchanged.

Design system: `../figma-shader-orb/DESIGN.md` ("The Oscilloscope").
The original single-file studio lives at `../figma-shader-orb/index.html`.
