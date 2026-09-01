import { useState, useEffect, useRef, useCallback } from 'react';
import { SaveStatusState } from '../types';

interface UseAutoSaveOptions {
  content: string;
  onSave: (val: string) => Promise<void>;
  debounceMs?: number;
}

export function useAutoSave({
  content,
  onSave,
  debounceMs = 500,
}: UseAutoSaveOptions) {
  const [status, setStatus] = useState<SaveStatusState>('saved');
  const latestContentRef = useRef(content);
  const lastSavedContentRef = useRef(content);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);

  latestContentRef.current = content;

  // Perform immediate save
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const valueToSave = latestContentRef.current;
    if (valueToSave === lastSavedContentRef.current) {
      setStatus('saved');
      return;
    }

    try {
      isSavingRef.current = true;
      setStatus('saving');
      await onSave(valueToSave);
      lastSavedContentRef.current = valueToSave;
      setStatus('saved');
    } catch (err) {
      console.error('AutoSave failed:', err);
      setStatus('error');
    } finally {
      isSavingRef.current = false;
    }
  }, [onSave]);

  // Set initial content reference without triggering unsaved status
  const resetSavedContent = useCallback((newInitialContent: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    latestContentRef.current = newInitialContent;
    lastSavedContentRef.current = newInitialContent;
    setStatus('saved');
  }, []);

  useEffect(() => {
    // If content is identical to last saved, do nothing
    if (content === lastSavedContentRef.current) {
      return;
    }

    setStatus('unsaved');

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(async () => {
      await flush();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [content, debounceMs, flush]);

  return {
    status,
    flush,
    resetSavedContent,
  };
}
