import type { Config, RawEffect, ShaderId } from './types';

/** THE SAMPLED TINT RULE (DESIGN.md): a meter is tinted only when its slider
 *  governs a specific color's geometry — and it takes that color's LIVE value.
 *  Panel color is a readout of canvas state, never decoration. Maps are
 *  deliberately conservative: only unambiguous single-color bindings tint. */
export const TINTS: Record<ShaderId, Record<string, string>> = {
  orb: {
    ringEnd1: 'ring1',
    ringEnd2: 'ring2',
    ringEnd3: 'ring3',
    lenMin: 'spikeColor',
    innerMin: 'spikeColor',
    tipWidthMin: 'spikeColor',
    taper: 'spikeColor',
    centerFade: 'spikeColor',
    fadeReach: 'spikeColor',
    nodeMin: 'nodeColor',
  },
  lava: {
    ringOpacity: 'color1',
  },
  pixels: {},
  particle: {
    size: 'color',
    sizeVar: 'color',
    opacity: 'color',
    softness: 'color',
  },
  tide: {
    surfaceLine: 'surfaceColor',
    nodeSize: 'nodeColor',
    lineWidth: 'lineColor',
    lineOpacity: 'lineColor',
  },
  bleed: {},
};

export function tintFor(id: ShaderId, key: string, C: Config): string | null {
  const colorKey = TINTS[id][key];
  const v = colorKey ? C[colorKey] : null;
  return typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) ? v : null;
}

/** B3 preset bands: the palette preview is extracted from the preset's own
 *  value bundle — every hex color it writes, in declaration order. */
export function presetPalettes(def: RawEffect, segKey: string): string[][] | null {
  const decl = def.presets;
  const rows = Array.isArray(decl) ? decl : decl ? [decl] : [];
  const preset = rows.find((p) => p.key === segKey);
  if (!preset) return null;
  const palettes = preset.options.map((opt) =>
    Object.values(opt)
      .filter((v): v is string => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v))
      .slice(0, 5),
  );
  return palettes.some((p) => p.length >= 2) ? palettes : null;
}

/* ============================================================ tooltips
 * One line per parameter: what turning the knob does, in canvas terms. */

const COMMON: Record<string, string> = {
  imageUpload: 'load a background image or video',
  imageOn: 'show or hide the background media',
  imageRotate: 'rotate the media in degrees; ⟳ steps by 90',
  imageZoom: 'pan and zoom the media inside the frame',
  imageFlip: 'mirror the media left-to-right',
  imageOpacity: 'fade the media toward the background color',
  seed: 'reshuffles random placement — same seed, same layout',
  dprCap: 'caps render resolution; lower is faster on hidpi screens',
  paused: 'freezes time — the frame stays put but interactive',
  cursorPull: 'how strongly the cursor attracts; negative repels',
  cursorRadius: 'how far the cursor’s influence reaches',
  stiffness: 'spring snap-back speed toward rest',
  damping: 'how quickly spring motion settles',
  speed: 'animation speed',
};

const PER: Record<ShaderId, Record<string, string>> = {
  orb: {
    count: 'number of spikes on the sphere',
    circleRadius: 'overall orb size in the frame',
    ring1: 'center ring color',
    ring2: 'second ring color',
    ring3: 'third ring color',
    ring4: 'outer field color',
    ringEnd1: 'where the center ring hands off to ring 2',
    ringEnd2: 'where ring 2 hands off to ring 3',
    ringEnd3: 'where ring 3 fades into the outer field',
    blendSoft: 'how gradually neighbouring rings blend',
    spikeColor: 'spike color',
    lenMin: 'shortest and longest spike length',
    innerMin: 'gap between the orb center and where spikes start',
    tipWidthMin: 'spike thickness at the tip',
    taper: 'how fast a spike narrows along its length',
    centerFade: 'spikes fade out near the orb center',
    fadeReach: 'how far the center fade extends outward',
    showNodes: 'dots at each spike tip',
    nodeColor: 'end-node dot color',
    nodeMin: 'end-node dot size range; scales with spike length',
    timeScale: 'idle animation speed',
    tumbleX: 'slow 3d tumble around the x axis',
    tumbleY: 'slow 3d tumble around the y axis',
    wobbleAmp: 'per-spike wobble amount',
    wobbleSpeed: 'wobble frequency',
    squish: 'radial squash as the cursor presses in',
  },
  lava: {
    blobCount: 'number of metaballs in the field',
    blobSize: 'metaball radius',
    bg: 'background gradient, top',
    bg2: 'background gradient, bottom',
    bandCount: 'number of stepped color bands around blobs',
    steps: 'quantization steps within each band',
    softness: 'edge softness between bands',
    tightness: 'how tightly bands hug the blobs',
    glow: 'bright rim at band edges',
    ringOpacity: 'opacity of the outermost band',
    opacityStep: 'opacity change per band, moving inward',
    coreSize: 'size of the innermost core band',
    coreStart: 'field level where the core begins',
    rise: 'vertical drift; negative sinks',
    warpAmount: 'gooey domain-warp strength',
    warpScale: 'goo detail scale',
    shatter: 'how violently blobs break apart at the cursor',
  },
  pixels: {
    bg: 'letterbox color around the media',
    pixelScale: 'mosaic grid resolution',
    sizeMix: 'blend between small and large blocks',
    maxPixel: 'largest block size in the mosaic',
    minPixel: 'smallest block size in the mosaic',
    spotRadius: 'radius of the un-pixelated spotlight',
    coreSize: 'fully clear center of the spotlight',
    spotPixel: 'block size inside the spotlight rim',
    edgeBlur: 'blur amount at the spotlight rim',
    edgeSoftness: 'how gradual the rim transition is',
    rimJitter: 'irregularity of the spotlight rim',
    blinkSpeed: 'block blink rate',
    blinkDensity: 'how many blocks blink',
    blinkBand: 'ring where blinking concentrates',
    followEase: 'how quickly the spotlight follows the cursor',
    wander: 'spotlight drifts on its own when idle',
    wanderSpeed: 'idle drift speed',
  },
  particle: {
    bg: 'background gradient, top',
    bg2: 'background gradient, bottom',
    count: 'number of particles in the field',
    color: 'particle color',
    size: 'base particle size',
    sizeVar: 'random size spread between particles',
    irregular: 'per-particle shape irregularity',
    grain: 'film-grain texture inside particles',
    stretch: 'directional stretch of each particle',
    opacity: 'particle opacity',
    softness: 'particle edge softness',
    depth: 'z-depth range of the field',
    perspective: 'perspective strength front-to-back',
    depthFade: 'far particles fade out',
    depthShrink: 'far particles shrink',
    driftSpeed: 'ambient drift speed',
    rise: 'upward drift; negative falls',
    wind: 'sideways drift; negative blows left',
    wobbleAmp: 'per-particle wobble amount',
    wobbleSpeed: 'wobble frequency',
    twinkle: 'brightness flicker amount',
    twinkleSpeed: 'flicker speed',
  },
  tide: {
    count: 'number of pooled blobs',
    size: 'blob size',
    sizeVariation: 'size spread between blobs',
    edgeSoftness: 'blob edge softness',
    opacity: 'blob opacity',
    palettePreset: 'restyles background and all blob colors at once',
    paletteCount: 'how many palette colors are in use',
    colorDrift: 'how far each blob’s hue wanders',
    driftSpeed: 'hue drift speed',
    fillLevel: 'waterline height',
    boundarySoft: 'field fade across the waterline',
    surfaceLine: 'waterline stroke thickness',
    surfaceColor: 'waterline stroke color',
    bg1: 'background gradient, first stop',
    bg2: 'background gradient, second stop',
    gradientAngle: 'background gradient angle',
    edgeBlur: 'blur at the frame edge',
    webOn: 'show the 3d spring web overlay',
    webCount: 'number of web nodes',
    webRadius: 'web size',
    webIrregularity: 'node scatter from the sphere',
    linksPerNode: 'connections per node',
    nodeSize: 'node dot size',
    nodeColor: 'node dot color',
    lineWidth: 'link line thickness',
    lineOpacity: 'link line opacity',
    lineColor: 'link line color',
    perspective: 'web perspective strength',
    depthFade: 'far nodes fade',
    depthShrink: 'far nodes shrink',
    snapStiffness: 'node snap-back speed after a drag',
    snapDamping: 'how quickly node motion settles',
    webStiffness: 'how strongly dragging pulls the whole web',
    autoSpin: 'idle rotation speed',
    autoTilt: 'idle tilt around the y axis',
    dragSwing: 'momentum the web keeps after a drag',
    swingDelay: 'how slowly the swing responds',
    blobStatic: 'freeze blob motion; the web stays live',
  },
  bleed: {
    bars: 'number of color columns',
    spread: 'column width spread',
    jitter: 'random height variation per column',
    shapePreset: 'silhouette presets for the column field',
    peak: 'tallest column height',
    valley: 'column height at the edges',
    curve: 'silhouette curve shape',
    fold: 'perspective fold angle',
    foldDepth: 'how deep the fold recedes',
    palettePreset: 'recolors all gradient stops at once',
    bg: 'stage color behind the columns',
    blendMode: 'how column colors combine where they overlap',
    brightness: 'overall brightness',
    stopCount: 'number of gradient stops in use',
    c1: 'gradient stop at the floor',
    c8: 'gradient stop at the crest',
    melt: 'horizontal blur bleed between columns',
    feather: 'softness at the crest',
    halo: 'glow above the crest',
    colorSoft: 'blend between neighbouring stops',
    breathe: 'slow height breathing',
    shimmer: 'fine shimmer along the columns',
    riseOn: 'columns rise from the floor on load',
    riseTime: 'rise duration',
    cursorLift: 'columns reach up toward the cursor',
    cursorGlow: 'brightening near the cursor',
    cursorRadius: 'how far the reach extends',
  },
};

export function tipFor(id: ShaderId, key: string): string | null {
  return PER[id][key] ?? COMMON[key] ?? null;
}

/** Copy-edited micro-labels (B1): the eight audit offenders shortened so they
 *  sit on the 96px rail; the full meaning lives on in the tooltip. Labels not
 *  listed here may still wrap to two lines (B2) rather than ellipsize. */
const LABEL_OVERRIDES: Record<string, string> = {
  'upload image / video': 'media file',
  'spring stiffness': 'stiffness',
  'ring opacity (outer)': 'outer opacity',
  'opacity step / ring': 'opacity step',
  'wind (− blows left)': 'wind',
  'static (freeze blobs)': 'freeze blobs',
  'web irregularity': 'irregularity',
  'stage / backdrop': 'backdrop',
};

export function labelFor(label: string): string {
  return LABEL_OVERRIDES[label] ?? label;
}
