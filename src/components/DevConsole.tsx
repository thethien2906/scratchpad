import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../types';

interface DevConsoleProps {
  onOpenCreateProfile: () => void;
  onLock?: () => Promise<void> | void;
  hasUnlockedProfile: boolean;
}

interface ConsoleLine {
  id: number;
  text: string;
  tone?: 'muted' | 'error' | 'success';
}

export const DevConsole: React.FC<DevConsoleProps> = ({
  onOpenCreateProfile,
  onLock,
  hasUnlockedProfile,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<ConsoleLine[]>([
    { id: 0, text: 'Erwining developer console. Type "help" for commands.', tone: 'muted' },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const commandHistory = useRef<string[]>([]);
  const historyIndex = useRef(0);
  const nextLineId = useRef(1);
  const openCreateProfileRef = useRef(onOpenCreateProfile);
  const lockRef = useRef(onLock);
  const hasUnlockedProfileRef = useRef(hasUnlockedProfile);

  openCreateProfileRef.current = onOpenCreateProfile;
  lockRef.current = onLock;
  hasUnlockedProfileRef.current = hasUnlockedProfile;

  const appendLine = useCallback((text: string, tone?: ConsoleLine['tone']) => {
    setLines((current) => [...current, { id: nextLineId.current++, text, tone }]);
  }, []);

  useEffect(() => {
    if (isOpen) {
      window.requestAnimationFrame(() => inputRef.current?.focus());
    } else if (document.activeElement === inputRef.current) {
      inputRef.current?.blur();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Backquote') {
        const target = event.target instanceof HTMLElement ? event.target : null;
        const isConsoleInput = target?.dataset.devConsoleInput === 'true';
        const isTextEntry =
          target?.tagName === 'INPUT' ||
          target?.tagName === 'TEXTAREA' ||
          target?.isContentEditable === true;

        if (isTextEntry && !isConsoleInput && !event.ctrlKey) return;
        event.preventDefault();
        setIsOpen((open) => !open);
        return;
      }

      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  const runCommand = useCallback(async (rawCommand: string) => {
    const trimmed = rawCommand.trim();
    if (!trimmed) return;

    const normalized = trimmed.toLowerCase();
    appendLine(`erwining> ${trimmed}`);

    if (normalized === 'create_profile') {
      setIsOpen(false);
      openCreateProfileRef.current();
      return;
    }
    if (normalized === 'help') {
      appendLine('Commands: create_profile, lock, logout, help, clear, close, exit', 'muted');
      return;
    }
    if (normalized === 'clear') {
      setLines([]);
      return;
    }
    if (normalized === 'close' || normalized === 'exit') {
      setIsOpen(false);
      return;
    }
    if (normalized === 'lock' || normalized === 'logout') {
      if (!hasUnlockedProfileRef.current || !lockRef.current) {
        appendLine('No profile is currently unlocked.', 'muted');
        return;
      }
      try {
        await lockRef.current();
        setIsOpen(false);
        appendLine('Profile locked.', 'success');
      } catch (error) {
        appendLine((error as ApiError).message || 'Unable to lock profile.', 'error');
      }
      return;
    }

    appendLine(`Unknown command: "${trimmed}". Type "help" for available commands.`, 'error');
  }, [appendLine]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = command.trim();
    if (trimmed) {
      commandHistory.current.push(trimmed);
      historyIndex.current = commandHistory.current.length;
      void runCommand(trimmed);
    }
    setCommand('');
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      historyIndex.current = Math.max(0, historyIndex.current - 1);
      setCommand(commandHistory.current[historyIndex.current] || '');
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      historyIndex.current = Math.min(commandHistory.current.length, historyIndex.current + 1);
      setCommand(commandHistory.current[historyIndex.current] || '');
    }
  };

  return (
    <section
      aria-label="Developer console"
      aria-hidden={!isOpen}
      className={`fixed top-0 left-0 right-0 z-50 h-[38vh] min-h-[230px] bg-[#0a0a0a]/95 backdrop-blur-md border-b border-dark-border font-mono text-xs shadow-2xl transition-transform duration-150 ${
        isOpen ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      <div className="h-full max-w-5xl mx-auto flex flex-col px-5 py-4">
        <div className="flex items-center justify-between pb-3 border-b border-dark-border/80 text-text-muted">
          <span className="tracking-wider uppercase">Erwining // Developer Console</span>
          <span>BACKQUOTE · ESC TO CLOSE</span>
        </div>

        <div ref={logRef} className="flex-1 overflow-y-auto py-3 space-y-1" role="log" aria-live="polite">
          {lines.map((line) => (
            <div
              key={line.id}
              className={
                line.tone === 'error'
                  ? 'text-red-300'
                  : line.tone === 'success'
                    ? 'text-emerald-300'
                    : line.tone === 'muted'
                      ? 'text-text-muted'
                      : 'text-text-primary'
              }
            >
              {line.text}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-dark-border/80 pt-3">
          <label htmlFor="dev-console-command" className="text-emerald-400 shrink-0">erwining&gt;</label>
          <input
            ref={inputRef}
            id="dev-console-command"
            data-dev-console-input="true"
            type="text"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            onKeyDown={handleInputKeyDown}
            autoComplete="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-faint"
            placeholder="enter command"
            tabIndex={isOpen ? 0 : -1}
          />
        </form>
      </div>
    </section>
  );
};
