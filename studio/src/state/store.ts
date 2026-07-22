import { create } from 'zustand';
import { toast } from 'sonner';
import { EFFECTS, isShaderId, ENGINE_SOURCES } from '../shaders/registry';
import type { Config, Effect, ShaderId } from '../shaders/types';
import { setAsset, ensureAssetNodes } from '../runtime/assetDom';
import { saveAssetsDB, loadAssetsDB, clearAssetsDB } from './assetDB';

/* ============================================================ MUTABLE CORE
 * The engine reads its config object BY REFERENCE every frame; control edits
 * mutate that same object in place (replacing it would orphan the engine's
 * closure). React is notified through two counters:
 *   - rev:   bump -> panel re-renders (values, deps gating)
 *   - epoch: bump -> <ShaderCanvas> remounts (fresh GL context + instantiate)
 */

export const configs: Record<ShaderId, Config> = {} as Record<ShaderId, Config>;
for (const id of Object.keys(EFFECTS) as ShaderId[]) {
  configs[id] = { ...EFFECTS[id].DEFAULTS };
}

/** Uploaded media data-URLs (+ `<assetId>:name` filename entries). */
export const customAssets: Record<string, string> = {};

/** Values the render loop shares with actions without React re-renders. */
export const runtime: {
  effect: Effect | null;
  mouse: [number, number];
  pngRequest: boolean;
  broken: boolean;
} = { effect: null, mouse: [99, 99], pngRequest: false, broken: false };

/* ============================================================ STORE */

export interface OverlayState {
  on: boolean;
  title: string;
  body: string;
  btn: string;
}

interface StudioState {
  activeId: ShaderId;
  epoch: number;
  rev: number;
  overlay: OverlayState;
  codeOverrides: Partial<Record<ShaderId, string>>;
  codeStatus: string;
  canUndo: boolean;
  canRedo: boolean;
  assetNames: Record<string, string>;
  hint: string | null;
  helpOpen: boolean;
  drawerOpen: boolean;
  paletteOpen: boolean;
  textEditorOpen: boolean;
  fps: number | null;
  ms: number | null;
}

export const useStudio = create<StudioState>(() => ({
  activeId: 'orb',
  epoch: 0,
  rev: 0,
  overlay: {
    on: false,
    title: 'Design that breathes',
    body: 'A live shader background, tuned in this studio and exported as a single self-contained file for your site.',
    btn: 'Learn more',
  },
  codeOverrides: {},
  codeStatus: '',
  canUndo: false,
  canRedo: false,
  assetNames: {},
  hint: null,
  helpOpen: false,
  drawerOpen: false,
  paletteOpen: false,
  textEditorOpen: false,
  fps: null,
  ms: null,
}));

const set = useStudio.setState;
const get = useStudio.getState;

export function activeConfig(): Config {
  return configs[get().activeId];
}

/* ============================================================ HISTORY
 * Whole-app snapshots ({configs, overlay, activeId}), committed AFTER a change
 * is applied — slider release / colour pick / checkbox / tab switch / reset /
 * reseed / cropper drag-end / overlay field change. Unlimited depth. */

type Snap = { configs: Record<ShaderId, Config>; overlay: OverlayState; activeId: ShaderId };
const undoStack: Snap[] = [];
const redoStack: Snap[] = [];
let lastSnap: Snap | null = null;

const snapshot = (): Snap =>
  JSON.parse(JSON.stringify({ configs, overlay: get().overlay, activeId: get().activeId }));

export function commit(): void {
  if (lastSnap) undoStack.push(lastSnap);
  redoStack.length = 0;
  lastSnap = snapshot();
  set({ canUndo: undoStack.length > 0, canRedo: false });
}

function applySnap(s: Snap): void {
  for (const id of Object.keys(s.configs) as ShaderId[]) {
    if (configs[id]) {
      // preserve object identity: engines close over these objects
      const target = configs[id];
      for (const k of Object.keys(target)) delete target[k];
      Object.assign(target, JSON.parse(JSON.stringify(s.configs[id])));
    }
  }
  const activeId = isShaderId(s.activeId) ? s.activeId : get().activeId;
  set((st) => ({
    overlay: { ...st.overlay, ...s.overlay },
    activeId,
    epoch: st.epoch + 1,
    rev: st.rev + 1,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
  }));
  persistText();
}

export function undo(): void {
  if (!undoStack.length || !lastSnap) return;
  redoStack.push(lastSnap);
  lastSnap = JSON.parse(JSON.stringify(undoStack.pop()));
  applySnap(lastSnap!);
}

export function redo(): void {
  if (!redoStack.length || !lastSnap) return;
  undoStack.push(lastSnap);
  lastSnap = JSON.parse(JSON.stringify(redoStack.pop()));
  applySnap(lastSnap!);
}

/* ============================================================ ACTIONS */

export function setActive(id: ShaderId): void {
  if (id === get().activeId) return;
  set((st) => ({ activeId: id, epoch: st.epoch + 1, rev: st.rev + 1, codeStatus: '' }));
  showHint(id);
  commit();
}

/** Live control write: mutates the config the engine reads, no history entry.
 *  History lands on the control's `change`/commit event. */
export function setValue(key: string, value: Config[string], opts?: { rebuild?: boolean }): void {
  activeConfig()[key] = value;
  if (opts?.rebuild) runtime.effect?.rebuild?.();
  set((st) => ({ rev: st.rev + 1 }));
}

export function reset(): void {
  const id = get().activeId;
  const target = configs[id];
  for (const k of Object.keys(target)) delete target[k];
  Object.assign(target, { ...EFFECTS[id].DEFAULTS });
  set((st) => ({ epoch: st.epoch + 1, rev: st.rev + 1 }));
  commit();
}

export function reseed(): void {
  const C = activeConfig();
  if (!('seed' in C)) return;
  C.seed = Math.floor(Math.random() * 1000);
  runtime.effect?.rebuild?.();
  set((st) => ({ rev: st.rev + 1 }));
  commit();
}

/** Segmented control: writes the index; a matching preset row writes a whole
 *  value bundle into the config. */
export function applySeg(key: string, index: number): void {
  const C = activeConfig();
  C[key] = index;
  const decl = EFFECTS[get().activeId].presets;
  const rows = Array.isArray(decl) ? decl : decl ? [decl] : [];
  const preset = rows.find((p) => p.key === key);
  if (preset) {
    const vals = preset.options[Math.round(index)];
    if (vals) Object.assign(C, vals);
    // once the user has saved at all, preset picks persist on their own —
    // a refresh should never quietly undo a chosen palette
    try {
      if (localStorage.getItem(STORE_KEY)) save(true);
    } catch {}
  }
  set((st) => ({ rev: st.rev + 1 }));
  commit();
}

export function rotBy(key: string, deg: number): void {
  const C = activeConfig();
  let v = ((Number(C[key]) || 0) + deg);
  v = ((((v + 180) % 360) + 360) % 360) - 180; // normalize to (-180, 180]
  C[key] = v;
  set((st) => ({ rev: st.rev + 1 }));
  commit();
}

export function zoomBy(factor: number): void {
  const C = activeConfig();
  C.imageZoom = Math.min(Math.max((Number(C.imageZoom) || 1) * factor, 0.5), 4);
  set((st) => ({ rev: st.rev + 1 }));
  commit();
}

export function uploadAsset(key: string, file: File): void {
  const id = get().activeId;
  const assetId = (EFFECTS[id].fileAssets || {})[key];
  if (!assetId) return;
  const rd = new FileReader();
  rd.onload = () => {
    const dataUrl = String(rd.result);
    setAsset(assetId, dataUrl);
    customAssets[assetId] = dataUrl;
    customAssets[assetId + ':name'] = file.name;
    set((st) => ({
      assetNames: { ...st.assetNames, [assetId]: file.name },
      epoch: st.epoch + 1, // reload engine with the new image/video
      rev: st.rev + 1,
    }));
  };
  rd.readAsDataURL(file);
}

/* ---- code drawer ---- */

export function applyCode(src: string): void {
  const id = get().activeId;
  const stock = ENGINE_SOURCES[id];
  const overrides = { ...get().codeOverrides };
  if (src === stock) delete overrides[id];
  else overrides[id] = src;
  set((st) => ({ codeOverrides: overrides, epoch: st.epoch + 1, codeStatus: '' }));
  // status lands after (re)instantiation: ShaderCanvas reports compile failures
  if (overrides[id] || src === stock) {
    set({ codeStatus: 'applied ✓' });
    toast('engine applied');
  }
}

export function revertCode(): void {
  const id = get().activeId;
  const overrides = { ...get().codeOverrides };
  delete overrides[id];
  set((st) => ({ codeOverrides: overrides, epoch: st.epoch + 1, codeStatus: 'reverted to stock' }));
  toast('reverted to stock');
}

/** Called by ShaderCanvas when a code override fails to compile: the override
 *  is dropped and stock reloaded — a broken edit must never brick the studio. */
export function reportCompileRevert(id: ShaderId, message: string): void {
  const overrides = { ...get().codeOverrides };
  delete overrides[id];
  set({ codeOverrides: overrides, codeStatus: 'edit failed, reverted — ' + message });
  toast.error('edit failed, reverted');
}

export function reportRuntimeError(message: string): void {
  set({ codeStatus: 'runtime error — ' + message });
  toast.error('runtime error — effect frozen');
}

/* ---- hero text overlay (auto-persists on every change) ---- */

const TEXT_KEY = 'shader-studio-text-v1';

export function setOverlay(patch: Partial<OverlayState>): void {
  set((st) => ({ overlay: { ...st.overlay, ...patch } }));
  persistText();
}

function persistText(): void {
  try {
    localStorage.setItem(TEXT_KEY, JSON.stringify(get().overlay));
  } catch {}
}

function restoreText(): void {
  try {
    const t = JSON.parse(localStorage.getItem(TEXT_KEY) || 'null');
    if (t) {
      set((st) => {
        const next = { ...st.overlay };
        for (const k of Object.keys(next) as (keyof OverlayState)[]) {
          if (k in t) (next as Record<string, unknown>)[k] = t[k];
        }
        return { overlay: next };
      });
    }
  } catch {}
}

/* ============================================================ PERSISTENCE
 * Same key + shape as the original studio ('shader-studio-v1':
 * {activeId, configs (paused stripped), overlay, code}), so existing saves
 * load unchanged. Load-time key migration is preserved verbatim. */

const STORE_KEY = 'shader-studio-v1';
const HINT_KEY = 'shader-studio-hints-v1';
const HELP_KEY = 'shader-studio-help-v1';

export function save(silent = false): void {
  const st = get();
  const snap: {
    activeId: ShaderId;
    configs: Record<string, Config>;
    overlay: OverlayState;
    code: Partial<Record<ShaderId, string>>;
  } = { activeId: st.activeId, configs: {}, overlay: { ...st.overlay }, code: { ...st.codeOverrides } };
  for (const id of Object.keys(configs) as ShaderId[]) {
    const { paused, ...cfg } = configs[id];
    snap.configs[id] = cfg;
  }
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(snap));
  } catch {}
  saveAssetsDB(customAssets);
  if (!silent) toast('all saved ✓');
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORE_KEY);
    localStorage.removeItem(TEXT_KEY);
  } catch {}
  clearAssetsDB();
  toast('saved state cleared');
}

function loadState(): ShaderId | null {
  try {
    const snap = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (!snap || !snap.configs) return null;
    // migration: cursor physics unified to cursorPull / cursorRadius, positive
    // pulls toward the cursor (2026-07). Old keys carry over with signs flipped
    // where the shader used a repel-positive convention.
    const o = snap.configs.orb,
      pa = snap.configs.particle;
    if (o && 'avoidStrength' in o && !('cursorPull' in o)) o.cursorPull = -o.avoidStrength;
    if (o && 'avoidRadius' in o && !('cursorRadius' in o)) o.cursorRadius = o.avoidRadius;
    if (pa && 'repel' in pa && !('cursorPull' in pa)) pa.cursorPull = -pa.repel;
    if (pa && 'repelRadius' in pa && !('cursorRadius' in pa)) pa.cursorRadius = pa.repelRadius;
    for (const id of Object.keys(configs) as ShaderId[]) {
      const saved = snap.configs[id];
      if (!saved) continue;
      // copy only keys the current schema knows, so old saves survive upgrades
      for (const k of Object.keys(configs[id])) if (k in saved) configs[id][k] = saved[k];
    }
    if (snap.overlay) {
      set((st) => {
        const next = { ...st.overlay };
        for (const k of Object.keys(next) as (keyof OverlayState)[]) {
          if (k in snap.overlay) (next as Record<string, unknown>)[k] = snap.overlay[k];
        }
        return { overlay: next };
      });
    }
    if (snap.code) {
      const overrides: Partial<Record<ShaderId, string>> = {};
      for (const id of Object.keys(snap.code)) {
        if (isShaderId(id)) overrides[id] = snap.code[id];
      }
      set({ codeOverrides: overrides });
    }
    if (snap.assets) {
      // legacy saves carried assets inline in localStorage
      for (const aid of Object.keys(snap.assets)) {
        setAsset(aid, snap.assets[aid]);
        customAssets[aid] = snap.assets[aid];
      }
    }
    return isShaderId(snap.activeId) ? snap.activeId : null;
  } catch {
    return null;
  }
}

/* ---- first-touch hints ---- */

let hintsDone = false;
try {
  hintsDone = !!localStorage.getItem(HINT_KEY);
} catch {}

function showHint(id: ShaderId): void {
  set({ hint: hintsDone ? null : EFFECTS[id].hint || null });
}

export function dismissHints(): void {
  if (hintsDone) return;
  hintsDone = true;
  try {
    localStorage.setItem(HINT_KEY, '1');
  } catch {}
  set({ hint: null });
}

/* ---- help ---- */

export function toggleHelp(force?: boolean): void {
  const open = force !== undefined ? force : !get().helpOpen;
  set({ helpOpen: open });
  if (open) {
    try {
      localStorage.setItem(HELP_KEY, '1');
    } catch {}
  }
}

/* ============================================================ BOOT */

export interface CaptureParams {
  t: number;
  mx: number;
  my: number;
}
export let captureParams: CaptureParams | null = null;

export function boot(): void {
  ensureAssetNodes();
  const params = new URLSearchParams(location.search);
  // restore last saved settings (if any); an explicit ?shader= wins over the save
  const savedShader = loadState();
  // respect prefers-reduced-motion: start paused; the pause toggle re-enables
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    for (const id of Object.keys(configs) as ShaderId[]) configs[id].paused = true;
  }
  restoreText(); // auto-saved text wins over the snapshot
  if (params.has('text')) {
    set((st) => ({ overlay: { ...st.overlay, on: params.get('text') === 'on' } }));
  }
  const urlShader = params.get('shader');
  const activeId = isShaderId(urlShader) ? urlShader : savedShader || 'orb';
  set({ activeId });
  showHint(activeId);

  // deep-link overrides: ?set=headThickness:1,clusterRadius:8 — applied before
  // the first instantiation, so the engine boots with them (no rebuild needed)
  if (params.has('set')) {
    const C = configs[activeId];
    for (const pair of (params.get('set') || '').split(',')) {
      const [k, v] = pair.split(':');
      if (!(k in C)) continue;
      C[k] = v === 'true' ? true : v === 'false' ? false : isNaN(+v) ? v : +v;
    }
  }

  // capture mode: ?t=4&mx=0.1&my=-0.1 — deterministic frozen frame
  if (params.has('t')) {
    captureParams = {
      t: Math.max(parseFloat(params.get('t') || '0') || 0, 0),
      mx: parseFloat(params.get('mx') ?? '99'),
      my: parseFloat(params.get('my') ?? '99'),
    };
  }

  // saved uploads live in IndexedDB and arrive async: pour them into the asset
  // slots, then restart the active engine so it picks up the restored media
  loadAssetsDB().then((assets) => {
    const ids = Object.keys(assets);
    if (!ids.length) return;
    const names: Record<string, string> = {};
    for (const aid of ids) {
      customAssets[aid] = assets[aid];
      if (aid.endsWith(':name')) names[aid.slice(0, -5)] = assets[aid];
      else setAsset(aid, assets[aid]);
    }
    set((st) => ({
      assetNames: { ...st.assetNames, ...names },
      epoch: st.epoch + 1,
      rev: st.rev + 1,
    }));
  });

  // first visit: open help once so cold visitors get oriented; never again after
  try {
    if (!localStorage.getItem(HELP_KEY)) toggleHelp(true);
  } catch {}

  // baseline for undo history: the state the page booted into
  lastSnap = snapshot();
  set({ canUndo: false, canRedo: false });
}
