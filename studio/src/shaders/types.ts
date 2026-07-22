/** Shared shader/registry types. The engine sources themselves are untyped
 *  strings by design (see DESIGN docs): the same text runs live via
 *  `new Function`, in the editor, and inlined into standalone exports. */

export type ShaderId = 'orb' | 'lava' | 'pixels' | 'particle' | 'tide' | 'silk' | 'bleed' | 'web';

export type ConfigValue = number | string | boolean;
export type Config = Record<string, ConfigValue>;

/** The live engine contract: `createEffect(canvas, C)` returns this. */
export interface Effect {
  frame(dt: number, mouse: [number, number]): void;
  rebuild?(): void;
  dispose?(): void;
}

/** Positional control tuple as authored in registry.data.js:
 *  [label, key, a, b?, step?, mode?] — slot `a` selects the control type. */
export type ControlTuple = [string, string, ...unknown[]];

export interface RawLayoutSection {
  t: string;
  groups: string[];
  toggle?: string;
  rename?: Record<string, string>;
}

export interface RawPresetGroup {
  key: string;
  options: Config[];
}

export interface RawEffect {
  name: string;
  assets?: string[];
  fileAssets?: Record<string, string>;
  deps?: Record<string, (c: Config) => boolean>;
  hint?: string;
  openGroups?: string[];
  LAYOUT?: RawLayoutSection[];
  bgKey?: string;
  frame?: { aspect?: string; radius?: string };
  presets?: RawPresetGroup | RawPresetGroup[];
  DEFAULTS: Config;
  GROUPS: Array<[string, ControlTuple[]]>;
}

/* ---- normalized descriptors (what the React panel consumes) ---- */

interface BaseControl {
  label: string;
  key: string;
}
export interface RangeControl extends BaseControl {
  type: 'range';
  min: number;
  max: number;
  step: number;
  rebuild: boolean;
}
export interface ColorControl extends BaseControl {
  type: 'color';
}
export interface CheckControl extends BaseControl {
  type: 'check';
}
export interface FileControl extends BaseControl {
  type: 'file';
}
export interface RotControl extends BaseControl {
  type: 'rot';
}
export interface CropControl extends BaseControl {
  type: 'crop';
}
export interface SegControl extends BaseControl {
  type: 'seg';
  options: string[];
}
/** Two adjacent <stem>Min / <stem>Max ranges merged into one dual-thumb row. */
export interface PairControl extends BaseControl {
  type: 'pair';
  keyMax: string;
  min: number;
  max: number;
  step: number;
  rebuild: boolean;
}
export type ControlDescriptor =
  | RangeControl
  | ColorControl
  | CheckControl
  | FileControl
  | RotControl
  | CropControl
  | SegControl
  | PairControl;

/** A resolved panel section (top-level layer), possibly holding sub-groups. */
export interface PanelSub {
  title: string | null;
  origTitle: string | null;
  controls: ControlDescriptor[];
}
export interface PanelSection {
  title: string;
  toggle?: string;
  subs: PanelSub[];
}

export function normalizeControl(item: ControlTuple): ControlDescriptor {
  const [label, key, a, b, step, mode] = item as [
    string,
    string,
    unknown,
    unknown,
    unknown,
    unknown,
  ];
  if (a === 'color') return { type: 'color', label, key };
  if (a === 'file') return { type: 'file', label, key };
  if (a === 'check') return { type: 'check', label, key };
  if (a === 'rot') return { type: 'rot', label, key };
  if (a === 'crop') return { type: 'crop', label, key };
  if (a === 'seg') return { type: 'seg', label, key, options: b as string[] };
  return {
    type: 'range',
    label,
    key,
    min: a as number,
    max: b as number,
    step: step as number,
    rebuild: mode === 'rebuild',
  };
}

/** Adjacent range tuples whose keys are <stem>Min / <stem>Max collapse into a
 *  single dual-thumb PairControl; the pair takes the min row's label with its
 *  "· min" suffix stripped. */
function mergePairs(controls: ControlDescriptor[]): ControlDescriptor[] {
  const out: ControlDescriptor[] = [];
  for (let i = 0; i < controls.length; i++) {
    const a = controls[i];
    const b = controls[i + 1];
    if (
      a?.type === 'range' &&
      b?.type === 'range' &&
      a.key.endsWith('Min') &&
      b.key === a.key.slice(0, -3) + 'Max'
    ) {
      out.push({
        type: 'pair',
        label: a.label.replace(/\s*·\s*min\s*$/i, ''),
        key: a.key,
        keyMax: b.key,
        min: a.min,
        max: a.max,
        step: a.step,
        rebuild: a.rebuild || b.rebuild,
      });
      i++;
      continue;
    }
    out.push(a);
  }
  return out;
}

/** Resolve GROUPS + LAYOUT into panel sections, mirroring the original
 *  buildPanel(): layout sections pull their groups (renamed), a section's
 *  toggle key is filtered out of its rows, single-group sections inline. */
export function resolveSections(def: RawEffect): PanelSection[] {
  const byTitle: Record<string, ControlTuple[]> = {};
  for (const [t, items] of def.GROUPS) byTitle[t] = items;
  if (!def.LAYOUT) {
    return def.GROUPS.map(([t, items]) => ({
      title: t,
      subs: [{ title: null, origTitle: null, controls: mergePairs(items.map(normalizeControl)) }],
    }));
  }
  return def.LAYOUT.map((sec) => {
    const pulled = sec.groups.map((g) => ({
      title: (sec.rename && sec.rename[g]) || g,
      origTitle: g,
      controls: mergePairs(
        (byTitle[g] || []).filter((it) => it[1] !== sec.toggle).map(normalizeControl),
      ),
    }));
    return sec.groups.length > 1
      ? { title: sec.t, toggle: sec.toggle, subs: pulled }
      : {
          title: sec.t,
          toggle: sec.toggle,
          subs: [{ title: null, origTitle: pulled[0].origTitle, controls: pulled[0].controls }],
        };
  });
}
