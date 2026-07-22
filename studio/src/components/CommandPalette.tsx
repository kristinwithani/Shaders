import { Command } from 'cmdk';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { SHADER_IDS } from '../shaders/registry';
import {
  clearSave,
  redo,
  reseed,
  reset,
  save,
  setActive,
  setOverlay,
  toggleHelp,
  undo,
  useStudio,
} from '../state/store';
import { exportHTML, exportJSON, requestPNG } from '../lib/export';

/** ⌘K quick-dial: every primary action, from the keyboard. */
export default function CommandPalette() {
  const open = useStudio((s) => s.paletteOpen);
  const overlayOn = useStudio((s) => s.overlay.on);
  const drawerOpen = useStudio((s) => s.drawerOpen);
  const close = () => useStudio.setState({ paletteOpen: false });
  const run = (fn: () => void) => () => {
    close();
    fn();
  };

  return (
    <MotionConfig reducedMotion="user">
    <AnimatePresence>
      {open && (
        <motion.div
          className="palette-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          onPointerDown={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <motion.div
            initial={{ y: -4 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
          >
            <Command className="palette" label="Command palette">
              <Command.Input autoFocus placeholder="type a command…" />
              <Command.List>
                <Command.Empty>nothing matches</Command.Empty>
                <Command.Group heading="Shaders">
                  {SHADER_IDS.map((id) => (
                    <Command.Item key={id} onSelect={run(() => setActive(id))}>
                      {id}
                    </Command.Item>
                  ))}
                </Command.Group>
                <Command.Group heading="Export">
                  <Command.Item onSelect={run(exportHTML)}>download HTML</Command.Item>
                  <Command.Item onSelect={run(exportJSON)}>download preset JSON</Command.Item>
                  <Command.Item onSelect={run(requestPNG)}>download PNG frame</Command.Item>
                </Command.Group>
                <Command.Group heading="Studio">
                  <Command.Item onSelect={run(() => save())}>
                    save settings
                  </Command.Item>
                  <Command.Item onSelect={run(undo)}>
                    undo <span className="kbd">⌘Z</span>
                  </Command.Item>
                  <Command.Item onSelect={run(redo)}>
                    redo <span className="kbd">⇧⌘Z</span>
                  </Command.Item>
                  <Command.Item onSelect={run(reset)}>reset shader</Command.Item>
                  <Command.Item onSelect={run(reseed)}>randomize seed</Command.Item>
                  <Command.Item
                    onSelect={run(() => useStudio.setState({ drawerOpen: !drawerOpen }))}
                  >
                    {drawerOpen ? 'close' : 'open'} code drawer
                  </Command.Item>
                  <Command.Item onSelect={run(() => setOverlay({ on: !overlayOn }))}>
                    hero text: {overlayOn ? 'off' : 'on'}
                  </Command.Item>
                  <Command.Item onSelect={run(() => toggleHelp(true))}>
                    help <span className="kbd">?</span>
                  </Command.Item>
                  <Command.Item onSelect={run(clearSave)}>clear saved state</Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </MotionConfig>
  );
}
