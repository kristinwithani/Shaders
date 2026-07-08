# Shaders

Interactive WebGL shader experiments, built with Claude Code.

## figma-shader-orb

A self-contained shader design studio (`figma-shader-orb/index.html`) with four
interactive shaders — orb, lava, pixels, aura — each with live debug controls,
per-shader export (standalone HTML, preset JSON, 10s MP4), a live code editor,
and a hero-text overlay for landing-page previews.

**Try it:** download the repo, open `figma-shader-orb/index.html` in any
modern browser. No build step, no dependencies — the studio runs standalone.

See [figma-shader-orb/README.md](figma-shader-orb/README.md) for details.

## Local preview server

For previewing and live-tuning, a [Vite](https://vitejs.dev) dev server serves
the studio over HTTP with reload-on-save. The HTML stays fully standalone —
this is a thin layer on top, not a build step baked into it.

```bash
npm install      # one-time
npm run dev      # dev server, auto-opens the studio, reloads on save
```

- **`npm run dev`** — starts on <http://localhost:5180> and opens the studio.
  Edit `figma-shader-orb/index.html` and the browser reloads instantly. Also
  exposed on your LAN (`Network:` URL) for previewing on a phone or tablet.
  (Port pinned to 5180 in `vite.config.mjs` so it won't collide with other
  local Vite projects.)
- **`npm run build`** — bundles the studio to `dist/`.
- **`npm run preview`** — serves the production `dist/` build locally.

> Live tuning happens two ways: (1) the studio's in-page debug controls + code
> drawer (tweak shaders without touching source), and (2) editing the source
> file with the dev server for reload-on-save. Both are non-destructive — the
> standalone file still opens directly via `open figma-shader-orb/index.html`.
