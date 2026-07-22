# Shaders

Interactive WebGL shader experiments, built with Claude Code.

## studio — the product

The hosted Shader Studio (`studio/`): a React + Vite + TypeScript app with six
interactive shaders — orb, lava, pixels, particle, tide, bleed — a generated
control panel, a live CodeMirror engine editor, per-shader export (standalone
HTML, preset JSON, PNG, 10s MP4), deep links + deterministic capture mode,
browser persistence, unlimited undo, and a ⌘K command palette.

```bash
cd studio
npm install
npm run dev      # http://localhost:5181
```

Deploys to Vercel (`vercel.json` carries the CSP the live-engine model needs).
See [studio/README.md](studio/README.md) for the architecture and
[ROADMAP.md](ROADMAP.md) for status + what's next.

## figma-shader-orb — the original single-file studio

The reference implementation (`figma-shader-orb/index.html`): the same six
shaders in one self-contained HTML file with zero dependencies. This is where
the engines and the design system live; the product imports the engine sources
verbatim.

**Try it:** download the repo, open `figma-shader-orb/index.html` in any
modern browser. No build step — the studio runs standalone.

- [figma-shader-orb/README.md](figma-shader-orb/README.md) — features + the orb recipe
- [figma-shader-orb/DESIGN.md](figma-shader-orb/DESIGN.md) — the design system
  ("The Oscilloscope"): tokens, named rules, component specs

## Local preview server (legacy studio)

A thin [Vite](https://vitejs.dev) layer serves the single-file studio with
reload-on-save; the HTML stays fully standalone.

```bash
npm install      # one-time, repo root
npm run dev      # http://localhost:5180, reloads on save
```

> Live tuning happens two ways: (1) the studio's in-page debug controls + code
> drawer (tweak shaders without touching source), and (2) editing the source
> file with the dev server for reload-on-save. Both are non-destructive — the
> standalone file still opens directly via `open figma-shader-orb/index.html`.
