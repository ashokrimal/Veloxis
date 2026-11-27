import {useEffect} from 'react';

interface ShortcutHandlers {
  disabled?: boolean;
  onToggleTest: () => void;
  onToggleUnit: () => void;
  onToggleMute: () => void;
  onOpenHistory: () => void;
  onToggleHelp: () => void;
}

export function useKeyboardShortcuts({
  disabled = false,
  onToggleTest,
  onToggleUnit,
  onToggleMute,
  onOpenHistory,
  onToggleHelp,
}: ShortcutHandlers) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.isContentEditable
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        onToggleHelp();
        return;
      }

      if (disabled) return;

      if (e.code === 'Space') {
        // Only hijack Space if focus is not already on an interactive button/link
        if (tag === 'button' || tag === 'a') return;
        e.preventDefault();
        onToggleTest();
      } else if (e.key === 'u' || e.key === 'U') {
        e.preventDefault();
        onToggleUnit();
      } else if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        onToggleMute();
      } else if (e.key === 'h' || e.key === 'H') {
        e.preventDefault();
        onOpenHistory();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    disabled,
    onOpenHistory,
    onToggleHelp,
    onToggleMute,
    onToggleTest,
    onToggleUnit,
  ]);
}
