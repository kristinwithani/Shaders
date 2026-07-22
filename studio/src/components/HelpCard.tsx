import { toggleHelp, useStudio } from '../state/store';

export default function HelpCard() {
  const open = useStudio((s) => s.helpOpen);
  if (!open) return null;
  return (
    <div id="helpCard">
      <h2>SHADER STUDIO</h2>
      <p>
        Six interactive WebGL shaders for website backgrounds. Pick a tab, play with the canvas,
        tune the layers on the right — then export.
      </p>
      <dl>
        <dt>canvas</dt>
        <dd>
          every shader reacts to your cursor — sweep, drag, stir. On tide, drag web nodes or empty
          space to rotate in 3D.
        </dd>
        <dt>panel</dt>
        <dd>
          sections are the shader's layers, in render order. Header checkboxes toggle a whole
          layer. Click any number to type an exact value; sliders nudge with ← → when focused.
        </dd>
        <dt>export</dt>
        <dd>
          the black <b>export</b> button opens the formats: <b>html</b> — a standalone file of the
          current shader for your site · <b>preset</b> — settings as JSON · <b>png</b> — current
          frame · <b>mp4</b> — 10-second capture (interactions included).
        </dd>
        <dt>saving</dt>
        <dd>
          save settings keeps everything (all shaders, hero text, code edits) in this browser
          across reloads. Undo is unlimited: <b>⌘Z / ⇧⌘Z</b>.
        </dd>
        <dt>code</dt>
        <dd>
          the bottom drawer shows the live engine source — edit, apply, copy. Broken edits revert
          themselves.
        </dd>
        <dt>quick-dial</dt>
        <dd>
          <b>⌘K</b> opens the command palette: switch shaders, export, undo — everything, from the
          keyboard.
        </dd>
      </dl>
      <button onClick={() => toggleHelp(false)}>close · esc</button>
    </div>
  );
}
