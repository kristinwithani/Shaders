import { useEffect, useRef } from 'react';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language';

/** CodeMirror 6 editing surface for the engine source. Lazy-loaded so the
 *  editor's weight stays out of the main bundle until the drawer opens. */
export default function CodeEditor({
  docKey,
  initial,
  viewRef,
}: {
  docKey: string;
  initial: string;
  viewRef: React.MutableRefObject<EditorView | null>;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const view = new EditorView({
      state: EditorState.create({
        doc: initial,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          highlightActiveLineGutter(),
          history(),
          bracketMatching(),
          javascript(),
          syntaxHighlighting(defaultHighlightStyle),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.lineWrapping,
        ],
      }),
      parent: host,
    });
    viewRef.current = view;
    return () => {
      viewRef.current = null;
      view.destroy();
    };
    // re-create when the underlying document identity changes (shader switch,
    // apply/revert) — mirrors the original drawer refresh
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  return <div id="codeEditorHost" ref={hostRef} />;
}
