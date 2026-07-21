import { useEffect } from 'react';
import { Toaster } from 'sonner';
import Stage from './components/Stage';
import Panel from './components/Panel';
import HelpCard from './components/HelpCard';
import CodeDrawer from './components/CodeDrawer';
import CommandPalette from './components/CommandPalette';
import { redo, toggleHelp, undo, useStudio } from './state/store';

export default function App() {
  /* global keys: ⌘Z / ⇧⌘Z history, ? help, esc close, ⌘K quick-dial */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing =
        !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        useStudio.setState((s) => ({ paletteOpen: !s.paletteOpen }));
        return;
      }
      if (e.key === 'Escape') {
        toggleHelp(false);
        useStudio.setState({ paletteOpen: false });
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (typing) return;
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (e.key === '?' && !typing) toggleHelp();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Stage />
      <Panel />
      <HelpCard />
      <CodeDrawer />
      <CommandPalette />
      <Toaster position="bottom-left" gap={6} visibleToasts={3} />
    </>
  );
}
