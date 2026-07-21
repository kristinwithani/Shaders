import { Suspense, lazy, useRef } from 'react';
import { toast } from 'sonner';
import type { EditorView } from '@codemirror/view';
import { engineSrc } from '../runtime/engine';
import { applyCode, revertCode, useStudio } from '../state/store';

const CodeEditor = lazy(() => import('./CodeEditor'));

export default function CodeDrawer() {
  const activeId = useStudio((s) => s.activeId);
  const open = useStudio((s) => s.drawerOpen);
  const overrides = useStudio((s) => s.codeOverrides);
  const status = useStudio((s) => s.codeStatus);
  const viewRef = useRef<EditorView | null>(null);

  const edited = !!overrides[activeId];
  const source = engineSrc(activeId, overrides);

  const copy = async () => {
    const text = viewRef.current ? viewRef.current.state.doc.toString() : source;
    try {
      await navigator.clipboard.writeText(text);
      toast('copied ✓');
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
        <span id="codeLabel">
          engine: {activeId}
          {edited ? ' (edited)' : ''}
        </span>
        <span id="codeStatus">{status}</span>
        {open && (
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
            <button onClick={copy}>copy</button>
          </>
        )}
      </div>
      {open && (
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
