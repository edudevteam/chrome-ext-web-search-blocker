import { useCallback, useEffect, useState } from 'react';
import { loadSettings, onSettingsChanged, saveSettings } from '../storage';
import type { Settings } from '../types';

/**
 * Settings for an extension page. Also subscribes to storage changes, so the
 * popup and the options page stay in step when both are open.
 */
export function useSettings(): [Settings | null, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
    return onSettingsChanged(setSettings);
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      void saveSettings(next);
      return next;
    });
  }, []);

  return [settings, update];
}
