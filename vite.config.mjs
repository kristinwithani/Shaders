import { defineConfig } from 'vite'
import { resolve } from 'node:path'

// The self-contained shader studio lives in figma-shader-orb/index.html.
// Vite serves it over HTTP with reload-on-save; the file stays standalone
// (still openable directly via `open figma-shader-orb/index.html`).
const root = resolve(import.meta.dirname, 'figma-shader-orb')

export default defineConfig({
  root,
  server: {
    port: 5180, // pinned so it won't collide with other local Vite projects
    open: true, // opens the studio (index.html) at /
    host: true, // expose on the LAN for phone/tablet preview
  },
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
  },
})
