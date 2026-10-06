/**
 * The custom favicon for the landing and new tab pages.
 *
 * Kept in chrome.storage.local rather than with the synced settings: even a
 * small image as a data URL eats most of chrome.storage.sync's 8KB item cap.
 */

import type { TabSettings } from './types';

export interface TabIconState {
  /** A `data:image/...` URL — an upload scaled down to ICON_SIZE, or a preset's SVG. */
  dataUrl: string;
  /** Name of the file or preset it came from, for the settings page. */
  source: string;
  /** Set when it is one of TAB_ICON_PRESETS rather than an upload. */
  preset?: string;
}

/** Square edge in pixels — enough for high-DPI tab strips. */
export const ICON_SIZE = 64;

const KEY = 'tabIcon';

function normalize(raw: unknown): TabIconState | null {
  const value = (raw ?? {}) as Partial<TabIconState>;
  if (typeof value.dataUrl !== 'string' || !value.dataUrl.startsWith('data:image/')) return null;
  return {
    dataUrl: value.dataUrl,
    source: typeof value.source === 'string' ? value.source : '',
    ...(typeof value.preset === 'string' ? { preset: value.preset } : {}),
  };
}

/** Null means no icon has been uploaded. */
export async function loadTabIcon(): Promise<TabIconState | null> {
  const stored = await chrome.storage.local.get(KEY);
  return normalize(stored[KEY]);
}

export async function saveTabIcon(state: TabIconState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function clearTabIcon(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

export function onTabIconChanged(cb: (state: TabIconState | null) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[KEY]) cb(normalize(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/**
 * Scale any image the browser can decode (PNG, JPEG, GIF, WebP, SVG, ICO) to a
 * centred ICON_SIZE square PNG, keeping its aspect ratio.
 */
export async function imageFileToIcon(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('not an image the browser can read');
    });

    const width = image.naturalWidth || ICON_SIZE;
    const height = image.naturalHeight || ICON_SIZE;
    const scale = ICON_SIZE / Math.max(width, height);
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('could not draw the image');
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, (ICON_SIZE - w) / 2, (ICON_SIZE - h) / 2, w, h);
    return canvas.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Apply whichever of the custom title and icon are switched on to this page. */
export async function applyTabAppearance(tab: TabSettings): Promise<void> {
  const title = tab.title.trim();
  if (tab.customTitle && title) document.title = title;

  if (!tab.customIcon) return;
  const icon = await loadTabIcon().catch(() => null);
  if (!icon) return;

  for (const existing of document.querySelectorAll('link[rel~="icon"]')) existing.remove();
  const link = document.createElement('link');
  link.rel = 'icon';
  link.href = icon.dataUrl;
  document.head.append(link);
}
