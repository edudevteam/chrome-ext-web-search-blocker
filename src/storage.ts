import {
  DEFAULT_SETTINGS,
  MAX_LANDING_HTML,
  SEARCH_TYPES,
  type RedirectMode,
  type RedirectSettings,
  type Settings,
  type WhitelistSettings,
} from './types';

const REDIRECT_MODES: RedirectMode[] = ['off', 'url', 'landing'];

function normalizeRedirect(raw: unknown): RedirectSettings {
  const value = (raw ?? {}) as Partial<RedirectSettings>;
  return {
    mode: REDIRECT_MODES.includes(value.mode as RedirectMode)
      ? (value.mode as RedirectMode)
      : DEFAULT_SETTINGS.redirect.mode,
    url: typeof value.url === 'string' ? value.url : '',
    html: typeof value.html === 'string' ? value.html.slice(0, MAX_LANDING_HTML) : '',
  };
}

function normalizeWhitelist(raw: unknown): WhitelistSettings {
  const value = (raw ?? {}) as Partial<WhitelistSettings>;
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.whitelist.enabled,
    sites: Array.isArray(value.sites) ? value.sites.filter((s) => typeof s === 'string') : [],
  };
}

const KEY = 'settings';
const area = chrome.storage.sync;

/** Merge stored values over the defaults so new fields survive upgrades. */
function normalize(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Settings>;
  const types = { ...DEFAULT_SETTINGS.types };
  for (const t of SEARCH_TYPES) {
    if (typeof value.types?.[t] === 'boolean') types[t] = value.types[t];
  }
  return {
    enabled: typeof value.enabled === 'boolean' ? value.enabled : DEFAULT_SETTINGS.enabled,
    types,
    keywords: Array.isArray(value.keywords) ? value.keywords.filter((k) => typeof k === 'string') : [],
    sites: Array.isArray(value.sites) ? value.sites.filter((s) => typeof s === 'string') : [],
    redirect: normalizeRedirect(value.redirect),
    hidePreviewStrip:
      typeof value.hidePreviewStrip === 'boolean'
        ? value.hidePreviewStrip
        : DEFAULT_SETTINGS.hidePreviewStrip,
    whitelist: normalizeWhitelist(value.whitelist),
  };
}

export async function loadSettings(): Promise<Settings> {
  try {
    const stored = await area.get(KEY);
    return normalize(stored[KEY]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings: Settings): Promise<void> {
  await area.set({ [KEY]: settings });
}

export function onSettingsChanged(cb: (settings: Settings) => void): () => void {
  const listener = (
    changes: Record<string, chrome.storage.StorageChange>,
    areaName: string,
  ) => {
    if (areaName !== 'sync' || !changes[KEY]) return;
    cb(normalize(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
