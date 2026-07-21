import orbSrc from '../engines/orb.engine.js?raw';
import lavaSrc from '../engines/lava.engine.js?raw';
import pixelsSrc from '../engines/pixels.engine.js?raw';
import particleSrc from '../engines/particle.engine.js?raw';
import tideSrc from '../engines/tide.engine.js?raw';
import bleedSrc from '../engines/bleed.engine.js?raw';
// @ts-ignore -- extracted verbatim data module
import { EFFECTS as EFFECTS_RAW } from './registry.data.js';
import type { RawEffect, ShaderId } from './types';

export const EFFECTS = EFFECTS_RAW as unknown as Record<ShaderId, RawEffect>;

export const SHADER_IDS = Object.keys(EFFECTS) as ShaderId[];

/** Stock engine source strings — the single text that runs live, seeds the
 *  editor, and is inlined into standalone exports. */
export const ENGINE_SOURCES: Record<ShaderId, string> = {
  orb: orbSrc,
  lava: lavaSrc,
  pixels: pixelsSrc,
  particle: particleSrc,
  tide: tideSrc,
  bleed: bleedSrc,
};

export function isShaderId(id: unknown): id is ShaderId {
  return typeof id === 'string' && id in EFFECTS;
}
