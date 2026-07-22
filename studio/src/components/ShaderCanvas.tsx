import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { engineSrc, instantiate } from '../runtime/engine';
import {
  configs,
  runtime,
  useStudio,
  captureParams,
  dismissHints,
  reportCompileRevert,
  reportRuntimeError,
} from '../state/store';
import type { Effect, ShaderId } from '../shaders/types';

/** The imperative island. Owns one <canvas>, one WebGL2 context, one engine
 *  instance and one rAF loop — all via refs, never React state. The component
 *  is remounted (key = activeId:epoch) whenever a fresh GL context is needed,
 *  replacing the original studio's cloneNode trick. */
export default function ShaderCanvas({ id }: { id: ShaderId }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const C = configs[id];
    runtime.broken = false;

    /* pointer -> centered unit coords, y up; [99,99] = pointer absent */
    const onMove = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      runtime.mouse = [
        ((ev.clientX - r.left) / r.width - 0.5) * 2,
        (0.5 - (ev.clientY - r.top) / r.height) * 2,
      ];
    };
    const onLeave = () => {
      runtime.mouse = [99, 99];
    };
    canvas.addEventListener('pointerdown', dismissHints, { once: true });
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerleave', onLeave);

    /* instantiate — a broken code override must never brick the studio:
       drop it, reload stock */
    let effect: Effect;
    const overrides = useStudio.getState().codeOverrides;
    try {
      effect = instantiate(engineSrc(id, overrides), canvas, C);
    } catch (err) {
      if (overrides[id]) {
        reportCompileRevert(id, String((err as Error).message || err));
        effect = instantiate(engineSrc(id, {}), canvas, C);
      } else {
        throw err;
      }
    }
    runtime.effect = effect;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, Number(C.dprCap) || 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    };

    let raf = 0;

    if (captureParams) {
      /* capture mode: simulate a cursor gliding to (mx,my) over t seconds,
         then freeze. Delayed so async assets finish decoding first. */
      const { t, mx, my } = captureParams;
      const timer = setTimeout(() => {
        const steps = Math.max(Math.round(t * 60), 1);
        const away = mx > 50;
        resize();
        for (let i = 0; i < steps; i++) {
          const u = steps === 1 ? 1 : i / (steps - 1);
          runtime.mouse = away
            ? [99, 99]
            : [mx - 0.55 * (1 - u), my - 0.4 * (1 - u)];
          effect.frame(1 / 60, runtime.mouse);
        }
        raf = requestAnimationFrame(() => {
          resize();
          effect.frame(0, runtime.mouse);
        });
      }, 500);
      return () => {
        clearTimeout(timer);
        cancelAnimationFrame(raf);
        canvas.removeEventListener('pointermove', onMove);
        canvas.removeEventListener('pointerleave', onLeave);
        runtime.effect = null;
        effect.dispose?.();
      };
    }

    /* live loop */
    let last = performance.now();
    let ema = 16.7;
    let lastFpsPush = 0;
    const loop = (now: number) => {
      resize();
      const dt = Math.min(Math.max((now - last) / 1000, 0.001), 0.05);
      last = now;
      if (!runtime.broken) {
        try {
          effect.frame(C.paused ? 0 : dt, runtime.mouse);
        } catch (err) {
          // runtime error in edited code: freeze this effect, keep the studio alive
          runtime.broken = true;
          reportRuntimeError(String((err as Error).message || err));
        }
      }
      if (runtime.pngRequest) {
        runtime.pngRequest = false;
        canvas.toBlob((blob) => {
          if (!blob) return;
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${id}.png`;
          a.click();
          URL.revokeObjectURL(a.href);
          toast('png saved ✓');
        }, 'image/png');
      }
      ema = ema * 0.95 + dt * 1000 * 0.05;
      if (now - lastFpsPush > 500) {
        lastFpsPush = now;
        useStudio.setState({ fps: Math.round(1000 / ema), ms: Math.round(ema * 100) / 100 });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      runtime.effect = null;
      effect.dispose?.(); // release the previous effect's video/decoder
      // Belt and braces against the browser's live-context cap — but ONLY on a
      // real unmount (element leaving the DOM). An effect re-run on the same
      // attached canvas (HMR, future StrictMode) must keep its context alive,
      // or the next instantiate compiles against a dead GL context.
      // On a key-swap unmount the canvas is already detached when this cleanup
      // runs, so releasing NOW frees the context before the replacement mounts
      // (no transient two-context overlap during rapid switching).
      const release = () =>
        canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
      if (!canvas.isConnected) release();
      else
        queueMicrotask(() => {
          if (!canvas.isConnected) release();
        });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* id="c" is a load-bearing bridge: the cropper reads the live video decoder
     off this element (canvas._bgVideo) and its aspect for viewport math. */
  return <canvas id="c" ref={canvasRef} />;
}
