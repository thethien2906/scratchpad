import React, { useRef, useEffect } from 'react';
import { SaveStatusState } from '../types';
import { SaveStatus } from './SaveStatus';

interface EditorProps {
  title: string;
  isProject?: boolean;
  content: string;
  saveStatus: SaveStatusState;
  onChangeContent: (value: string) => void;
  onRenameTitle?: (newTitle: string) => void;
}

export const Editor: React.FC<EditorProps> = ({
  title,
  isProject = false,
  content,
  saveStatus,
  onChangeContent,
  onRenameTitle,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleValue, setTitleValue] = React.useState(title);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTitleValue(title);
  }, [title]);

  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Focus editor textarea on switch
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [title]);

  // Handle Tab key in textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newContent =
        content.substring(0, start) + '  ' + content.substring(end);
      onChangeContent(newContent);

      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  const handleTitleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== title && onRenameTitle) {
      onRenameTitle(trimmed);
    } else {
      setTitleValue(title);
    }
    setIsEditingTitle(false);
  };

  // Word count & character count
  const words = content.trim() ? content.trim().split(/\s+/).length : 0;
  const chars = content.length;

  return (
    <main className="flex-1 h-full flex flex-col bg-dark-base overflow-hidden">
      {/* Header - Clean Title Only */}
      <header className="px-8 pt-7 pb-4 flex items-baseline justify-between select-none">
        <div className="flex-1 min-w-0 pr-4">
          {isProject && isEditingTitle ? (
            <form onSubmit={handleTitleSubmit}>
              <input
                ref={titleInputRef}
                type="text"
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setTitleValue(title);
                    setIsEditingTitle(false);
                  }
                }}
                className="text-2xl font-semibold text-text-primary bg-transparent border-b border-dark-subtle outline-none w-full"
              />
            </form>
          ) : (
            <h1
              onClick={() => isProject && setIsEditingTitle(true)}
              title={isProject ? 'Click to rename' : undefined}
              className={`text-2xl font-semibold text-text-primary tracking-tight truncate ${
                isProject ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
              }`}
            >
              {title}
            </h1>
          )}
        </div>
      </header>

      {/* Textarea Workspace */}
      <div className="flex-1 px-8 py-2 relative flex flex-col min-h-0">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => onChangeContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            isProject
              ? `Note for ${title}...`
              : 'Write freely...'
          }
          className="w-full flex-1 resize-none bg-transparent outline-none text-text-primary font-sans text-base leading-relaxed placeholder:text-text-muted/40 placeholder:font-normal"
          spellCheck={false}
        />
      </div>

      {/* Subtle Dark Footer Bar */}
      <footer className="px-8 py-3 border-t border-dark-border/60 flex items-center justify-between text-xs text-text-muted select-none">
        <div className="flex items-center gap-3">
          <span>{words} {words === 1 ? 'word' : 'words'}</span>
          <span>•</span>
          <span>{chars} {chars === 1 ? 'char' : 'chars'}</span>
        </div>
        <SaveStatus status={saveStatus} />
      </footer>
    </main>
  );
};
