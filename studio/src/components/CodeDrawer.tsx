import { Suspense, lazy, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { EditorView } from '@codemirror/view';
import { engineSrc } from '../runtime/engine';
import { activeConfig, applyCode, revertCode, useStudio } from '../state/store';

const CodeEditor = lazy(() => import('./CodeEditor'));

/** The live `const C = {…}` the controls are driving into the canvas — the
 *  honest copy/paste artifact. Reflects exactly what's on screen (paused, a
 *  studio-only flag, is stripped, matching preset/standalone export). */
function configText(): string {
  const { paused, ...cfg } = activeConfig();
  void paused;
  return 'const C = ' + JSON.stringify(cfg, null, 2) + ';';
}

export default function CodeDrawer() {
  const activeId = useStudio((s) => s.activeId);
  const open = useStudio((s) => s.drawerOpen);
  const overrides = useStudio((s) => s.codeOverrides);
  const status = useStudio((s) => s.codeStatus);
  useStudio((s) => s.rev); // re-render the settings mirror as controls tune
  const viewRef = useRef<EditorView | null>(null);
  const [view, setView] = useState<'settings' | 'engine'>('settings');

  const edited = !!overrides[activeId];
  const source = engineSrc(activeId, overrides);
  const settings = configText();

  const copy = async (text: string, label = 'copied ✓') => {
    try {
      await navigator.clipboard.writeText(text);
      toast(label);
    } catch {
      toast.error('copy failed');
    }
  };

  return (
    <div id="codeDrawer" className={open ? '' : 'collapsed'}>
      <div id="codeBar">
        <button onClick={() => useStudio.setState({ drawerOpen: !open })}>
          {open ? 'code ▾' : 'code ▴'}
        </button>
        {open && (
          <div className="viewToggle" role="tablist" aria-label="code view">
            <button
              role="tab"
              aria-selected={view === 'settings'}
              className={view === 'settings' ? 'on' : ''}
              onClick={() => setView('settings')}
            >
              settings
            </button>
            <button
              role="tab"
              aria-selected={view === 'engine'}
              className={view === 'engine' ? 'on' : ''}
              onClick={() => setView('engine')}
            >
              engine
            </button>
          </div>
        )}
        <span id="codeLabel">
          {view}: {activeId}
          {view === 'engine' && edited ? ' (edited)' : ''}
        </span>
        <span id="codeStatus">{status}</span>
        {open && view === 'settings' && (
          <button onClick={() => copy(settings, 'settings copied ✓')}>copy</button>
        )}
        {open && view === 'engine' && (
          <>
            <button
              className="primary"
              onClick={() => {
                const src = viewRef.current ? viewRef.current.state.doc.toString() : source;
                applyCode(src);
              }}
            >
              apply
            </button>
            <button onClick={revertCode}>revert</button>
            <button
              onClick={() => copy(viewRef.current ? viewRef.current.state.doc.toString() : source)}
            >
              copy
            </button>
          </>
        )}
      </div>
      {open && view === 'settings' && (
        <pre id="codeEditorHost" className="settingsView" tabIndex={0}>
          {settings}
        </pre>
      )}
      {open && view === 'engine' && (
        <Suspense fallback={<div id="codeEditorHost" />}>
          <CodeEditor
            docKey={`${activeId}:${edited ? 'edit' : 'stock'}:${source.length}`}
            initial={source}
            viewRef={viewRef}
          />
        </Suspense>
      )}
    </div>
  );
}
