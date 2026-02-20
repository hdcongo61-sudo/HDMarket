import { useCallback, useEffect, useRef, useState } from 'react';

export default function useAutosaveDraft(storageKey, defaultValue, delay = 800) {
  const [draft, setDraft] = useState(defaultValue);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState('idle');
  const [savedAt, setSavedAt] = useState(null);
  const skipFirstSaveRef = useRef(true);

  useEffect(() => {
    skipFirstSaveRef.current = true;
    setStatus('idle');

    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDraft({ ...defaultValue, ...parsed });
      } else {
        setDraft(defaultValue);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
      setDraft(defaultValue);
      setStatus('error');
    } finally {
      setHydrated(true);
    }
  }, [storageKey, defaultValue]);

  useEffect(() => {
    if (!hydrated) return;
    if (skipFirstSaveRef.current) {
      skipFirstSaveRef.current = false;
      return;
    }

    setStatus('saving');
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(draft));
        setSavedAt(Date.now());
        setStatus('saved');
      } catch (error) {
        console.error('Failed to autosave draft:', error);
        setStatus('error');
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [draft, hydrated, storageKey, delay]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
    skipFirstSaveRef.current = true;
    setDraft(defaultValue);
    setStatus('idle');
    setSavedAt(null);
  }, [defaultValue, storageKey]);

  return {
    draft,
    setDraft,
    hydrated,
    status,
    savedAt,
    clearDraft
  };
}
