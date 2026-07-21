import { useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { SHADER_IDS } from '../shaders/registry';
import {
  clearSave,
  redo,
  reseed,
  reset,
  save,
  setActive,
  toggleHelp,
  undo,
  useStudio,
} from '../state/store';
import { exportHTML, exportJSON, requestPNG } from '../lib/export';
import Groups from './controls';

function Tabs() {
  const activeId = useStudio((s) => s.activeId);
  return (
    <div id="tabs">
      {SHADER_IDS.map((id) => (
        <button
          key={id}
          className={id === activeId ? 'active' : ''}
          onClick={() => setActive(id)}
        >
          {id}
        </button>
      ))}
    </div>
  );
}

function HistRow() {
  const canUndo = useStudio((s) => s.canUndo);
  const canRedo = useStudio((s) => s.canRedo);
  return (
    <div id="histRow">
      <button id="undoBtn" disabled={!canUndo} onClick={undo}>
        ↶ undo
      </button>
      <button id="redoBtn" disabled={!canRedo} onClick={redo}>
        ↷ redo
      </button>
    </div>
  );
}

function Fps() {
  const activeId = useStudio((s) => s.activeId);
  const fps = useStudio((s) => s.fps);
  const ms = useStudio((s) => s.ms);
  return (
    <div id="fps">
      {fps !== null && (
        <>
          {activeId} · <NumberFlow value={fps} /> fps · {ms?.toFixed(2)} ms
        </>
      )}
    </div>
  );
}

function ExportMenu() {
  const activeId = useStudio((s) => s.activeId);
  const ref = useRef<HTMLDetailsElement>(null);
  const [recLeft, setRecLeft] = useState<number | null>(null);

  /* outside click + Escape close the drop-up (MP4 keeps it open for the countdown) */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const el = ref.current;
      if (el && el.open && !el.contains(e.target as Node)) el.removeAttribute('open');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ref.current?.removeAttribute('open');
    };
    document.addEventListener('click', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('click', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const close = () => ref.current?.removeAttribute('open');

  const recordMP4 = () => {
    if (recLeft !== null) return;
    const cv = document.getElementById('c') as HTMLCanvasElement | null;
    if (!cv) return;
    const stream = cv.captureStream(60);
    // prefer real MP4 (H.264); fall back to WebM where the browser can't encode it
    const mime = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm',
    ].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
    if (!mime) {
      toast.error('video capture not supported in this browser');
      return;
    }
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12000000 });
    const chunks: Blob[] = [];
    rec.ondataavailable = (ev) => {
      if (ev.data.size) chunks.push(ev.data);
    };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: mime });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${activeId}.${ext}`;
      a.click();
      URL.revokeObjectURL(a.href);
      setRecLeft(null);
    };
    let left = 10;
    setRecLeft(left);
    const tick = setInterval(() => {
      left--;
      if (left > 0) setRecLeft(left);
      else clearInterval(tick);
    }, 1000);
    rec.start();
    setTimeout(() => rec.stop(), 10000);
  };

  return (
    <details id="exportMenu" ref={ref}>
      <summary role="button" aria-label="export menu">
        export
      </summary>
      <div className="menuList">
        <button
          title="standalone interactive page for your site"
          onClick={() => {
            exportHTML();
            close();
          }}
        >
          ↓ HTML file
        </button>
        <button
          title="current settings as JSON"
          onClick={() => {
            exportJSON();
            close();
          }}
        >
          ↓ preset (JSON)
        </button>
        <button
          title="current frame as an image"
          onClick={() => {
            requestPNG();
            close();
          }}
        >
          ↓ PNG frame
        </button>
        <button title="10-second live capture — interactions included" onClick={recordMP4}>
          {recLeft === null ? '↓ MP4 · 10s' : `rec ${recLeft}s…`}
        </button>
      </div>
    </details>
  );
}

export default function Panel() {
  return (
    <aside id="panel">
      <header>
        <h1>
          SHADER STUDIO{' '}
          <button
            id="helpBtn"
            title="what is this? (press ?)"
            aria-label="Help"
            onClick={() => toggleHelp()}
          >
            ?
          </button>
        </h1>
        <Tabs />
        <HistRow />
        <Fps />
      </header>
      <Groups />
      <div id="panelFoot">
        <div className="row">
          <button className="slim" onClick={reset}>
            reset shader
          </button>
          <button className="slim" onClick={reseed}>
            randomize seed
          </button>
        </div>
        <div className="row">
          <button
            className="act ghost"
            title="Saves all shader settings, the hero text, and code edits — restored whenever this page opens"
            onClick={() => save()}
          >
            save settings
          </button>
          <ExportMenu />
        </div>
        <div className="row">
          <button
            className="linkBtn"
            title="Forgets the saved state — next load starts from factory defaults"
            onClick={clearSave}
          >
            clear saved state
          </button>
        </div>
      </div>
    </aside>
  );
}
