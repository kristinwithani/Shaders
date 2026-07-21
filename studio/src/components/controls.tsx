import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react';
import { useState } from 'react';
import { Slider } from '@base-ui/react/slider';
import { Switch } from '@base-ui/react/switch';
import { Tooltip } from '@base-ui/react/tooltip';
import { EFFECTS } from '../shaders/registry';
import {
  resolveSections,
  type Config,
  type ControlDescriptor,
  type PairControl,
  type PanelSection,
  type PanelSub,
  type RangeControl,
  type SegControl,
} from '../shaders/types';
import { labelFor, presetPalettes, tintFor, tipFor } from '../shaders/controlMeta';
import {
  activeConfig,
  applySeg,
  commit,
  rotBy,
  setValue,
  uploadAsset,
  useStudio,
  zoomBy,
} from '../state/store';
import { getAsset } from '../runtime/assetDom';

/* ============================================================ gating */

function useGate(key: string): boolean {
  const activeId = useStudio((s) => s.activeId);
  const deps = EFFECTS[activeId].deps;
  const pred = deps && deps[key];
  return pred ? !!pred(activeConfig()) : true;
}

/* ============================================================ label rail
 * Hover explains the parameter (authored tooltip); double-click resets the
 * control to its factory default. */

function RailLabel({
  label,
  keys,
  rebuild,
}: {
  label: string;
  keys: string[];
  rebuild?: boolean;
}) {
  const activeId = useStudio((s) => s.activeId);
  const tip = tipFor(activeId, keys[0]);
  const resetToDefault = () => {
    const defaults = EFFECTS[activeId].DEFAULTS;
    const C = activeConfig();
    let touched = false;
    for (const k of keys) {
      if (k in defaults && C[k] !== defaults[k]) {
        C[k] = defaults[k];
        touched = true;
      }
    }
    if (!touched) return;
    setValue(keys[0], activeConfig()[keys[0]], { rebuild });
    commit();
  };
  const display = labelFor(label);
  const span = (
    <span
      className="lbl"
      title={tip ? undefined : keys[0]}
      onDoubleClick={resetToDefault}
    >
      {display}
    </span>
  );
  if (!tip) return span;
  return (
    <Tooltip.Root>
      <Tooltip.Trigger render={<span className="lbl" onDoubleClick={resetToDefault} />}>
        {display}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Positioner side="bottom" align="start" sideOffset={4}>
          <Tooltip.Popup className="tipPop">
            {tip}
            <span className="tipHint">2×click resets</span>
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

/* ============================================================ tinted meter
 * The Sampled Tint Rule: the fill takes the LIVE value of the color this
 * slider governs (see controlMeta.TINTS); everything else stays monochrome.
 * A hairline tick marks the factory default. */

function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i === -1 ? 0 : s.length - i - 1;
}

function fmt(v: number, step: number): string {
  return String(parseFloat(v.toFixed(Math.max(decimalsOf(step), 0) + 1)))
    .replace(/^0\./, '.')
    .replace(/^-0\./, '-.');
}

function MeterRow({ c }: { c: RangeControl }) {
  const on = useGate(c.key);
  const activeId = useStudio((s) => s.activeId);
  const C = activeConfig();
  const outRef = useRef<HTMLOutputElement>(null);
  const editingRef = useRef(false);

  const value = Number(C[c.key]);
  const tint = tintFor(activeId, c.key, C);
  const dflt = EFFECTS[activeId].DEFAULTS[c.key];
  const tickPct =
    typeof dflt === 'number' && c.max > c.min
      ? ((dflt - c.min) / (c.max - c.min)) * 100
      : null;

  /* click the number to type an exact value (identity-stable text node) */
  const beginEdit = () => {
    const out = outRef.current;
    if (!out || editingRef.current) return;
    editingRef.current = true;
    out.contentEditable = 'plaintext-only';
    out.focus();
    window.getSelection()?.selectAllChildren(out);
  };
  const done = (commitEdit: boolean) => {
    const out = outRef.current;
    if (!out || !editingRef.current) return;
    editingRef.current = false;
    out.contentEditable = 'false';
    const v = parseFloat(out.textContent || '');
    if (!commitEdit || isNaN(v)) {
      out.textContent = String(C[c.key]);
      return;
    }
    const cl = Math.min(Math.max(v, c.min), c.max);
    out.textContent = String(cl);
    setValue(c.key, cl, { rebuild: c.rebuild });
    commit();
  };

  return (
    <div className={'ctl' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key]} rebuild={c.rebuild} />
      <Slider.Root
        className="meter"
        value={value}
        min={c.min}
        max={c.max}
        step={c.step}
        disabled={!on}
        onValueChange={(v) => setValue(c.key, v as number, { rebuild: c.rebuild })}
        onValueCommitted={() => commit()}
        style={tint ? ({ '--tint': tint } as CSSProperties) : undefined}
      >
        <Slider.Control className="meterCtl">
          <Slider.Track className="meterTrack">
            {tickPct !== null && tickPct > 1 && tickPct < 99 && (
              <span className="meterTick" style={{ left: tickPct + '%' }} />
            )}
            <Slider.Indicator className={'meterFill' + (tint ? ' tinted' : '')} />
            <Slider.Thumb className="meterThumb" aria-label={c.label} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <output
        ref={outRef}
        onClick={beginEdit}
        onBlur={() => done(true)}
        onKeyDown={(e) => {
          if (!editingRef.current) return;
          if (e.key === 'Enter') {
            e.preventDefault();
            outRef.current?.blur();
          } else if (e.key === 'Escape') done(false);
        }}
        suppressContentEditableWarning
      >
        {String(C[c.key])}
      </output>
    </div>
  );
}

/** Dual-thumb range: a merged <stem>Min / <stem>Max pair on one meter. */
function PairRow({ c }: { c: PairControl }) {
  const on = useGate(c.key);
  const activeId = useStudio((s) => s.activeId);
  const C = activeConfig();
  const tint = tintFor(activeId, c.key, C);
  const lo = Number(C[c.key]);
  const hi = Number(C[c.keyMax]);

  return (
    <div className={'ctl' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key, c.keyMax]} rebuild={c.rebuild} />
      <Slider.Root
        className="meter"
        value={[lo, hi]}
        min={c.min}
        max={c.max}
        step={c.step}
        disabled={!on}
        onValueChange={(v) => {
          const [a, b] = v as number[];
          const cfg = activeConfig();
          cfg[c.key] = a;
          cfg[c.keyMax] = b;
          setValue(c.key, a, { rebuild: c.rebuild });
        }}
        onValueCommitted={() => commit()}
        style={tint ? ({ '--tint': tint } as CSSProperties) : undefined}
      >
        <Slider.Control className="meterCtl">
          <Slider.Track className="meterTrack">
            <Slider.Indicator className={'meterFill mid' + (tint ? ' tinted' : '')} />
            <Slider.Thumb className="meterThumb" aria-label={`${c.label} minimum`} />
            <Slider.Thumb className="meterThumb" aria-label={`${c.label} maximum`} />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
      <output className="pairVal">
        {fmt(lo, c.step)}–{fmt(hi, c.step)}
      </output>
    </div>
  );
}

/* ============================================================ switch */

function SwitchPill({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <Switch.Root
      className="sw"
      checked={checked}
      disabled={disabled}
      aria-label={label}
      onCheckedChange={onChange}
    >
      <Switch.Thumb className="swThumb" />
    </Switch.Root>
  );
}

function CheckRow({ c }: { c: ControlDescriptor }) {
  const on = useGate(c.key);
  const C = activeConfig();
  return (
    <div className={'ctl noval' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key]} />
      <div className="ctlSlot">
        <SwitchPill
          checked={!!C[c.key]}
          disabled={!on}
          label={c.label}
          onChange={(v) => {
            setValue(c.key, v);
            commit();
          }}
        />
      </div>
    </div>
  );
}

/* ============================================================ colors */

function ColorRow({ c }: { c: ControlDescriptor }) {
  const on = useGate(c.key);
  const C = activeConfig();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => commit();
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <div className={'ctl noval colorRow' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key]} />
      <div className="ctlSlot end">
        <input
          ref={ref}
          type="color"
          value={String(C[c.key])}
          title={c.label}
          aria-label={c.label}
          disabled={!on}
          onChange={(e) => setValue(c.key, e.target.value)}
        />
      </div>
    </div>
  );
}

function SwatchRow({ run }: { run: ControlDescriptor[] }) {
  const activeId = useStudio((s) => s.activeId);
  const deps = EFFECTS[activeId].deps;
  const C = activeConfig();
  return (
    <div className="ctl noval">
      <span className="lbl">colors</span>
      <div className="swatchRow">
        {run.map((c) => {
          const on = deps && deps[c.key] ? !!deps[c.key](C) : true;
          return <SwatchInput key={c.key} c={c} value={String(C[c.key])} inactive={!on} />;
        })}
      </div>
    </div>
  );
}

function SwatchInput({
  c,
  value,
  inactive,
}: {
  c: ControlDescriptor;
  value: string;
  inactive: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => commit();
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <input
      ref={ref}
      type="color"
      className={inactive ? 'inactive' : undefined}
      value={value}
      title={c.label}
      aria-label={c.label}
      onChange={(e) => setValue(c.key, e.target.value)}
    />
  );
}

/* ============================================================ file / rot */

function FileRow({ c }: { c: ControlDescriptor }) {
  const on = useGate(c.key);
  const activeId = useStudio((s) => s.activeId);
  const assetNames = useStudio((s) => s.assetNames);
  const fileRef = useRef<HTMLInputElement>(null);
  const assetId = (EFFECTS[activeId].fileAssets || {})[c.key];
  const fname = assetId ? assetNames[assetId] : undefined;
  return (
    <div className={'ctl noval' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key]} />
      <button
        type="button"
        className="fileBtn"
        title={fname || ''}
        onClick={() => fileRef.current?.click()}
      >
        {fname || 'choose file…'}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        hidden
        aria-label={c.label}
        onChange={(e) => {
          const f = e.target.files && e.target.files[0];
          if (f) uploadAsset(c.key, f);
        }}
      />
    </div>
  );
}

function RotRow({ c }: { c: ControlDescriptor }) {
  const on = useGate(c.key);
  const C = activeConfig();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onChange = () => commit();
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);
  return (
    <div className={'ctl noval' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={[c.key]} />
      <div className="rotRow">
        <input
          ref={ref}
          type="number"
          step={1}
          value={Number(C[c.key])}
          aria-label={`${c.label} in degrees`}
          disabled={!on}
          onChange={(e) => setValue(c.key, parseFloat(e.target.value) || 0)}
        />
        <span className="unit">°</span>
        <button type="button" aria-label="rotate 90 degrees" onClick={() => rotBy(c.key, 90)}>
          ⟳ 90
        </button>
      </div>
    </div>
  );
}

/* ============================================================ seg (B3 band)
 * Preset chips carry a meter-band of their palette along the bottom edge —
 * quiet at rest, saturating on hover and selection. Palettes are extracted
 * from the preset's own value bundle (never hand-picked). */

function SegRow({ c }: { c: SegControl }) {
  const on = useGate(c.key);
  const activeId = useStudio((s) => s.activeId);
  const C = activeConfig();
  const current = Math.round(Number(C[c.key]));
  const palettes = useMemo(
    () => presetPalettes(EFFECTS[activeId], c.key),
    [activeId, c.key],
  );
  /* A2 breakout: measured, not guessed — if any chip's text can't fit beside
     the label rail, the whole seg drops onto its own full-width line. Future
     shaders inherit the rule automatically. */
  const rowRef = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    if (stacked) return;
    const row = rowRef.current;
    if (!row) return;
    const overflowing = [...row.querySelectorAll<HTMLElement>('.seg')].some((seg) => {
      const b = seg.querySelector('b');
      return (
        seg.scrollWidth > seg.clientWidth + 1 ||
        (b ? b.getClientRects().length > 1 : false)
      );
    });
    if (overflowing) setStacked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, c.key]);
  return (
    <div
      ref={rowRef}
      className={'ctl ' + (stacked ? 'stackctl' : 'noval') + (on ? '' : ' inactive')}
    >
      <RailLabel label={c.label} keys={[c.key]} />
      <div className="segRow" role="radiogroup" aria-label={c.label}>
        {c.options.map((g, i) => {
          const pal = palettes?.[i];
          return (
            <button
              key={i}
              type="button"
              className={'seg' + (current === i ? ' on' : '') + (pal ? ' banded' : '')}
              aria-label={`${c.label} ${g}`}
              onClick={() => applySeg(c.key, i)}
            >
              <b>{g}</b>
              {pal && (
                <span className="band" aria-hidden>
                  {pal.map((col, j) => (
                    <i key={j} style={{ background: col }} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============================================================ cropper
 * (unchanged mechanics: preview + viewport frame sharing the shader's math;
 * for video it draws the engine's own decoder via canvas#c._bgVideo) */

const cropImgs: Record<
  string,
  { src: string; img?: HTMLImageElement; vid?: HTMLVideoElement; url?: string }
> = {};
const cropLiveSeen = new WeakSet<HTMLVideoElement>();

function CropRow({ c }: { c: ControlDescriptor }) {
  const on = useGate(c.key);
  const activeId = useStudio((s) => s.activeId);
  const rev = useStudio((s) => s.rev);
  const cvRef = useRef<HTMLCanvasElement>(null);
  const zvRef = useRef<HTMLSpanElement>(null);
  const metaRef = useRef<{
    dw: number;
    dh: number;
    wS: number;
    hS: number;
    atX: number;
    atY: number;
    minU: number;
    maxU: number;
    minV: number;
    maxV: number;
    cU: number;
    cV: number;
  } | null>(null);
  const rafRef = useRef(0);
  const dragRef = useRef<[number, number] | null>(null);

  const schedule = () => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      draw();
    });
  };

  const cropLive = (vid: HTMLVideoElement) => {
    if (!('requestVideoFrameCallback' in HTMLVideoElement.prototype) || cropLiveSeen.has(vid))
      return;
    cropLiveSeen.add(vid);
    const loop = () => {
      schedule();
      vid.requestVideoFrameCallback(loop);
    };
    vid.requestVideoFrameCallback(loop);
  };

  const placeholder = (ctx: CanvasRenderingContext2D, cv: HTMLCanvasElement, msg: string) => {
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = '#6a6a6a'; /* Dim Readout — no new grey is ever invented */
    ctx.font = '11px ui-monospace, Menlo, monospace';
    ctx.textAlign = 'center';
    ctx.fillText(msg, cv.width / 2, cv.height / 2 + 4);
  };

  const draw = () => {
    const cv = cvRef.current;
    if (!cv) return;
    const C = activeConfig();
    if (zvRef.current) zvRef.current.textContent = (Number(C.imageZoom) || 1).toFixed(2) + '×';
    const ctx = cv.getContext('2d')!;
    ctx.clearRect(0, 0, cv.width, cv.height);
    const fa = EFFECTS[activeId].fileAssets;
    const assetId = fa && Object.values(fa)[0];
    const data = assetId ? getAsset(assetId) : '';
    metaRef.current = null;
    if (!data) {
      placeholder(ctx, cv, 'upload an image to crop');
      return;
    }
    const isVideo = /^data:video\/|\.(mp4|webm|ogv|mov|m4v)(\?|#|$)/i.test(data);
    const mainCv = document.getElementById('c') as
      | (HTMLCanvasElement & { _bgVideo?: HTMLVideoElement })
      | null;
    const sharedVid = isVideo && mainCv ? mainCv._bgVideo || null : null;
    let rec = assetId ? cropImgs[assetId] : undefined;
    if (assetId && sharedVid && rec && rec.vid) {
      rec.vid.pause();
      rec.vid.removeAttribute('src');
      rec.vid.load();
      if (rec.url) URL.revokeObjectURL(rec.url);
      delete cropImgs[assetId];
      rec = undefined;
    }
    if (assetId && !sharedVid && (!rec || rec.src !== data)) {
      if (rec && rec.vid) {
        rec.vid.pause();
        rec.vid.removeAttribute('src');
        rec.vid.load();
      }
      if (rec && rec.url) URL.revokeObjectURL(rec.url);
      if (isVideo) {
        const vid = document.createElement('video');
        rec = cropImgs[assetId] = { src: data, vid };
        Object.assign(vid, { muted: true, loop: true, autoplay: true, playsInline: true });
        vid.addEventListener('loadeddata', () => schedule());
        if (data.startsWith('data:')) {
          fetch(data)
            .then((r) => r.blob())
            .then((b) => {
              if (cropImgs[assetId] !== rec) return;
              rec!.url = URL.createObjectURL(b);
              vid.src = rec!.url;
              vid.play().catch(() => {});
            });
        } else {
          vid.src = data;
          vid.play().catch(() => {});
        }
      } else {
        const img = new Image();
        rec = cropImgs[assetId] = { src: data, img };
        img.onload = () => schedule();
        img.src = data;
      }
    }
    const vid = sharedVid || (rec && rec.vid) || null;
    if (vid) cropLive(vid);
    const img = vid || rec?.img;
    if (!img) {
      placeholder(ctx, cv, 'loading…');
      return;
    }
    const ready = vid
      ? vid.readyState >= 2 && vid.videoWidth
      : (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth;
    if (!ready) {
      placeholder(ctx, cv, 'loading…');
      return;
    }
    const ia = vid
      ? vid.videoWidth / vid.videoHeight
      : (img as HTMLImageElement).naturalWidth / (img as HTMLImageElement).naturalHeight;
    const cw = cv.width,
      ch = cv.height;
    let dw = cw,
      dh = cw / ia;
    if (dh > ch) {
      dh = ch;
      dw = ch * ia;
    }
    const dx = (cw - dw) / 2,
      dy2 = (ch - dh) / 2;
    const mc = mainCv!;
    const A = mc.width / Math.max(mc.height, 1);
    const wS = ia > A ? A / ia : 1,
      hS = ia > A ? 1 : ia / A;
    const z = Math.max(Number(C.imageZoom) || 1, 0.05);
    const r = ((Number(C.imageRotate) || 0) * Math.PI) / 180;
    const cr = Math.cos(r),
      sr = Math.sin(r);
    const uvPts = (
      [
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
      ] as Array<[number, number]>
    ).map(([fx, fy]) => {
      let qx = (fx - 0.5) * A,
        qy = fy - 0.5;
      if (C.imageFlip) qx = -qx;
      let rx = cr * qx - sr * qy,
        ry = sr * qx + cr * qy;
      rx /= z;
      ry /= z;
      rx /= A;
      const u = rx + 0.5 - (Number(C.imageX) || 0),
        v = ry + 0.5 - (Number(C.imageY) || 0);
      return [0.5 + (u - 0.5) * wS, 0.5 + (v - 0.5) * hS] as [number, number];
    });
    const us = uvPts.map((p) => p[0]),
      vs = uvPts.map((p) => p[1]);
    metaRef.current = {
      dw,
      dh,
      wS,
      hS,
      atX: Number(C.imageX) || 0,
      atY: Number(C.imageY) || 0,
      minU: Math.min(...us),
      maxU: Math.max(...us),
      minV: Math.min(...vs),
      maxV: Math.max(...vs),
      cU: (Math.min(...us) + Math.max(...us)) / 2,
      cV: (Math.min(...vs) + Math.max(...vs)) / 2,
    };
    const offX = (Number(C.imageX) || 0) * wS * dw,
      offY = -(Number(C.imageY) || 0) * hS * dh;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(img as CanvasImageSource, dx + offX, dy2 + offY, dw, dh);
    const pts = uvPts.map(([u, v]) => [dx + u * dw + offX, dy2 + (1 - v) * dh + offY]);
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#111';
    ctx.lineWidth = 1;
    const m = metaRef.current;
    if (Math.abs(m.cU - 0.5) < 0.002) {
      ctx.beginPath();
      ctx.moveTo(dx + 0.5 * dw + offX, dy2 + offY);
      ctx.lineTo(dx + 0.5 * dw + offX, dy2 + dh + offY);
      ctx.stroke();
    }
    if (Math.abs(m.cV - 0.5) < 0.002) {
      ctx.beginPath();
      ctx.moveTo(dx + offX, dy2 + 0.5 * dh + offY);
      ctx.lineTo(dx + dw + offX, dy2 + 0.5 * dh + offY);
      ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, cw, ch);
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 3; i >= 0; i--) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
    ctx.fill('evenodd');
    ctx.restore();
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#111';
    ctx.stroke();
  };

  useEffect(() => {
    schedule();
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, activeId]);

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = [e.clientX, e.clientY];
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const cv = cvRef.current;
    const m = metaRef.current;
    if (!dragRef.current || !m || !cv) return;
    const C = activeConfig();
    const scale = cv.width / cv.getBoundingClientRect().width;
    const dpx = (e.clientX - dragRef.current[0]) * scale,
      dpy = (e.clientY - dragRef.current[1]) * scale;
    dragRef.current = [e.clientX, e.clientY];
    let Xc = Math.min(Math.max(Number(C.imageX) + dpx / m.dw / m.wS, -1.5), 1.5);
    let Yc = Math.min(Math.max(Number(C.imageY) - dpy / m.dh / m.hS, -1.5), 1.5);
    const EPS = 0.015;
    const dX = Xc - m.atX,
      dY = Yc - m.atY;
    const cU = m.cU - dX * m.wS,
      minU = m.minU - dX * m.wS,
      maxU = m.maxU - dX * m.wS;
    if (Math.abs(cU - 0.5) < EPS) Xc += (cU - 0.5) / m.wS;
    else if (Math.abs(minU) < EPS) Xc += minU / m.wS;
    else if (Math.abs(maxU - 1) < EPS) Xc += (maxU - 1) / m.wS;
    const cV = m.cV - dY * m.hS,
      minV = m.minV - dY * m.hS,
      maxV = m.maxV - dY * m.hS;
    if (Math.abs(cV - 0.5) < EPS) Yc += (cV - 0.5) / m.hS;
    else if (Math.abs(minV) < EPS) Yc += minV / m.hS;
    else if (Math.abs(maxV - 1) < EPS) Yc += (maxV - 1) / m.hS;
    C.imageX = Xc;
    C.imageY = Yc;
    schedule();
  };
  const onPointerUp = () => {
    if (dragRef.current) {
      dragRef.current = null;
      setValue('imageX', activeConfig().imageX);
      commit();
    }
  };

  return (
    <div className={'ctl noval' + (on ? '' : ' inactive')}>
      <RailLabel label={c.label} keys={['imageZoom', 'imageX', 'imageY']} />
      <div className="cropWrap">
        <canvas
          ref={cvRef}
          className="cropCv"
          width={264}
          height={150}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
        <div className="cropBtns">
          <button type="button" onClick={() => zoomBy(0.9)}>
            − zoom
          </button>
          <button type="button" onClick={() => zoomBy(1.111)}>
            + zoom
          </button>
          <span className="cropZv" ref={zvRef} />
        </div>
      </div>
    </div>
  );
}

/* ============================================================ dispatch */

function Row({ c }: { c: ControlDescriptor }) {
  switch (c.type) {
    case 'range':
      return <MeterRow c={c} />;
    case 'pair':
      return <PairRow c={c} />;
    case 'color':
      return <ColorRow c={c} />;
    case 'check':
      return <CheckRow c={c} />;
    case 'file':
      return <FileRow c={c} />;
    case 'rot':
      return <RotRow c={c} />;
    case 'crop':
      return <CropRow c={c} />;
    case 'seg':
      return <SegRow c={c} />;
  }
}

function RowList({ controls }: { controls: ControlDescriptor[] }) {
  const out: ReactNode[] = [];
  for (let i = 0; i < controls.length; i++) {
    if (controls[i].type === 'color') {
      const run: ControlDescriptor[] = [];
      while (i < controls.length && controls[i].type === 'color') run.push(controls[i++]);
      i--;
      if (run.length > 1) out.push(<SwatchRow key={run[0].key} run={run} />);
      else out.push(<Row key={run[0].key} c={run[0]} />);
      continue;
    }
    out.push(<Row key={controls[i].key} c={controls[i]} />);
  }
  return <>{out}</>;
}

/* ============================================================ sections */

function subAllOff(
  sub: PanelSub,
  deps: Record<string, (c: Config) => boolean> | undefined,
  C: Config,
): boolean {
  if (!deps || !sub.controls.length) return false;
  return sub.controls.every((c) => deps[c.key] && !deps[c.key](C));
}

function AutoDetails({
  className,
  defaultOpen,
  allOff,
  summary,
  children,
}: {
  className: string;
  defaultOpen: boolean;
  allOff: boolean;
  summary: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const autoc = useRef(false);
  useEffect(() => {
    if (allOff && open) {
      setOpen(false);
      autoc.current = true;
    } else if (!allOff && !open && autoc.current) {
      setOpen(true);
      autoc.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allOff]);
  return (
    <details
      className={className}
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      {summary}
      {children}
    </details>
  );
}

function Section({ section }: { section: PanelSection }) {
  const activeId = useStudio((s) => s.activeId);
  useStudio((s) => s.rev);
  const def = EFFECTS[activeId];
  const C = activeConfig();
  const og = def.openGroups;
  const allOff = section.subs.every((sub) => subAllOff(sub, def.deps, C));
  return (
    <AutoDetails
      className="sec"
      defaultOpen
      allOff={allOff}
      summary={
        <summary>
          <span className="chev" aria-hidden />
          <span>{section.title}</span>
          {section.toggle && (
            <span className="secToggle" onClick={(e) => e.stopPropagation()}>
              <SwitchPill
                checked={!!C[section.toggle]}
                label={`${section.title} visible`}
                onChange={(v) => {
                  setValue(section.toggle!, v);
                  commit();
                }}
              />
            </span>
          )}
        </summary>
      }
    >
      {section.subs.map((sub, i) =>
        sub.title ? (
          <AutoDetails
            key={sub.title}
            className="sub"
            defaultOpen={!og || og.includes(sub.origTitle || sub.title) || og.includes(sub.title)}
            allOff={subAllOff(sub, def.deps, C)}
            summary={
              <summary>
                <span className="chev" aria-hidden />
                {sub.title}
              </summary>
            }
          >
            <RowList controls={sub.controls} />
          </AutoDetails>
        ) : (
          <RowList key={i} controls={sub.controls} />
        ),
      )}
    </AutoDetails>
  );
}

export default function Groups() {
  const activeId = useStudio((s) => s.activeId);
  const epoch = useStudio((s) => s.epoch);
  useStudio((s) => s.rev);
  const sections = useMemo(() => resolveSections(EFFECTS[activeId]), [activeId]);
  return (
    <Tooltip.Provider delay={450} closeDelay={0}>
      <div id="groups" key={`${activeId}:${epoch}`}>
        {sections.map((sec) => (
          <Section key={sec.title} section={sec} />
        ))}
      </div>
    </Tooltip.Provider>
  );
}
