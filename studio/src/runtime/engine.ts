import { ENGINE_SOURCES } from '../shaders/registry';
import type { Config, Effect, ShaderId } from '../shaders/types';

/** Engine source resolution: a live code override wins over stock.
 *  The same string feeds (a) the runtime `new Function`, (b) the editor,
 *  and (c) standalone export. */
export function engineSrc(id: ShaderId, overrides: Partial<Record<ShaderId, string>>): string {
  return overrides[id] ?? ENGINE_SOURCES[id];
}

/** Compile + run an engine from its source string — identical to the original
 *  studio. Requires CSP `script-src 'unsafe-eval'` when hosted (see vercel.json). */
export function instantiate(src: string, canvas: HTMLCanvasElement, cfg: Config): Effect {
  const factory = new Function('canvas', 'C', src + '\nreturn createEffect(canvas, C);');
  return factory(canvas, cfg) as Effect;
}
