import { useEffect, useRef, useState } from 'react';
import { EFFECTS } from '../shaders/registry';
import { commit, setOverlay, useStudio } from '../state/store';
import ShaderCanvas from './ShaderCanvas';

/** History lands on blur only when the field actually changed since focus —
 *  an unchanged blur must not push a no-op undo entry. */
let overlayDirty = false;
const markDirty = () => {
  overlayDirty = true;
};
const commitIfDirty = () => {
  if (overlayDirty) {
    overlayDirty = false;
    commit();
  }
};

function TextTools() {
  const overlay = useStudio((s) => s.overlay);
  const editorOpen = useStudio((s) => s.textEditorOpen);
  return (
    <div id="textTools">
      <div id="textChips">
        <button
          id="textToggle"
          className={overlay.on ? 'on' : ''}
          onClick={() => {
            setOverlay({ on: !overlay.on });
            if (overlay.on) useStudio.setState({ textEditorOpen: false });
          }}
        >
          text: {overlay.on ? 'on' : 'off'}
        </button>
        <button
          id="textEdit"
          hidden={!overlay.on}
          onClick={() => useStudio.setState({ textEditorOpen: !editorOpen })}
        >
          edit ▾
        </button>
      </div>
      <div id="textEditor" hidden={!overlay.on || !editorOpen}>
        <input
          id="editTitle"
          placeholder="title"
          value={overlay.title}
          onChange={(e) => {
            setOverlay({ title: e.target.value });
            markDirty();
          }}
          onBlur={commitIfDirty}
        />
        <textarea
          id="editBody"
          rows={3}
          placeholder="body copy"
          value={overlay.body}
          onChange={(e) => {
            setOverlay({ body: e.target.value });
            markDirty();
          }}
          onBlur={commitIfDirty}
        />
        <input
          id="editBtn"
          placeholder="button label"
          value={overlay.btn}
          onChange={(e) => {
            setOverlay({ btn: e.target.value });
            markDirty();
          }}
          onBlur={commitIfDirty}
        />
      </div>
    </div>
  );
}

function HeroOverlay() {
  const overlay = useStudio((s) => s.overlay);
  if (!overlay.on) return null;
  return (
    <div id="overlay">
      <h1 id="ovTitle">{overlay.title}</h1>
      <p id="ovBody">{overlay.body}</p>
      <a id="ovBtn" href="#" onClick={(e) => e.preventDefault()}>
        <span id="ovBtnLabel">{overlay.btn}</span> <span className="arrow">→</span>
      </a>
    </div>
  );
}

function CanvasHint() {
  const hint = useStudio((s) => s.hint);
  // keep the element mounted through its reserved 600ms fade-out (DESIGN.md)
  const [shown, setShown] = useState<string | null>(hint);
  const [visible, setVisible] = useState(!!hint);
  const timer = useRef(0);
  useEffect(() => {
    window.clearTimeout(timer.current);
    if (hint) {
      setShown(hint);
      setVisible(true);
    } else {
      setVisible(false);
      timer.current = window.setTimeout(() => setShown(null), 700);
    }
    return () => window.clearTimeout(timer.current);
  }, [hint]);
  if (!shown) return null;
  return (
    <div id="canvasHint" style={{ opacity: visible ? 1 : 0 }}>
      {shown}
    </div>
  );
}

export default function Stage() {
  const activeId = useStudio((s) => s.activeId);
  const epoch = useStudio((s) => s.epoch);
  const textOn = useStudio((s) => s.overlay.on);
  const frame = EFFECTS[activeId].frame || {};
  return (
    <div id="stage">
      <div id="stack" className={textOn ? 'textOn' : ''}>
        <TextTools />
        <HeroOverlay />
        <div
          id="canvasWrap"
          style={{
            aspectRatio: frame.aspect || undefined,
            borderRadius: frame.radius !== undefined ? frame.radius : undefined,
          }}
        >
          <ShaderCanvas key={`${activeId}:${epoch}`} id={activeId} />
        </div>
        <CanvasHint />
      </div>
    </div>
  );
}
