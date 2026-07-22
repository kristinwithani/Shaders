import { EFFECTS } from '../shaders/registry';
import { engineSrc } from '../runtime/engine';
import { getAsset } from '../runtime/assetDom';
import { configs, runtime, useStudio } from '../state/store';
import type { ShaderId } from '../shaders/types';

export function download(name: string, text: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function exportJSON(): void {
  const id = useStudio.getState().activeId;
  const { paused, ...cfg } = configs[id];
  download(`${id}-preset.json`, JSON.stringify({ shader: id, ...cfg }, null, 2), 'application/json');
}

export function exportHTML(): void {
  const id = useStudio.getState().activeId;
  const { paused, ...cfg } = configs[id];
  download(`${id}.html`, buildStandalone(id, cfg), 'text/html');
}

export function requestPNG(): void {
  runtime.pngRequest = true;
}

/** The standalone file: engine source (carrying live code edits) + asset
 *  data-URI script tags + the config baked in as JSON + a minimal rAF loop.
 *  Output format is byte-compatible with the original studio's export. */
export function buildStandalone(id: ShaderId, cfg: Record<string, unknown>): string {
  const engine = engineSrc(id, useStudio.getState().codeOverrides);
  const assetTags = (EFFECTS[id].assets || [])
    .map((aid) => `<script id="${aid}" type="text/plain">${getAsset(aid)}<\/script>`)
    .join('\n');
  const bg = (cfg[EFFECTS[id].bgKey || ''] as string) || '#ffffff';
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${id} shader</title>
<style>
  html, body { margin: 0; height: 100%; background: ${bg}; }
  body { display: grid; place-items: center; }
  canvas { width: min(90vmin, 800px); height: min(90vmin, 800px); display: block; cursor: crosshair; }
</style>
</head>
<body>
<canvas id="c"></canvas>
${assetTags}
<script>
'use strict';
const C = ${JSON.stringify(cfg, null, 2)};
${engine}
const canvas = document.getElementById('c');
const effect = createEffect(canvas, C);
let mouse = [99, 99];
canvas.addEventListener('pointermove', ev => {
  const r = canvas.getBoundingClientRect();
  mouse = [((ev.clientX - r.left) / r.width - 0.5) * 2, (0.5 - (ev.clientY - r.top) / r.height) * 2];
});
canvas.addEventListener('pointerleave', () => { mouse = [99, 99]; });
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, C.dprCap);
  const size = Math.round(canvas.clientWidth * dpr);
  if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
}
let last = performance.now(), running = true;
document.addEventListener('visibilitychange', () => {
  running = !document.hidden;
  if (running) { last = performance.now(); requestAnimationFrame(loop); }
});
function loop(now) {
  if (!running) return;
  resize();
  const dt = Math.min(Math.max((now - last) / 1000, 0.001), 0.05);
  last = now;
  effect.frame(dt, mouse);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
<\/script>
</body>
</html>`;
}
