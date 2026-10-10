/**
 * Your own image for each allowed site, filled into `{{image}}` in a custom
 * landing page's site template.
 *
 * Kept in chrome.storage.local rather than with the synced settings: the custom
 * HTML already takes most of chrome.storage.sync's 8KB item cap.
 */

/** Allowed-list entry as written -> image URL. */
export type SiteImages = Record<string, string>;

const KEY = 'siteImages';
export const MAX_IMAGE_URL = 2048;

/** http(s) addresses only; anything else would just render a broken image. */
export function isImageUrl(value: string): boolean {
  if (value.length > MAX_IMAGE_URL) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

export function normalizeSiteImages(raw: unknown): SiteImages {
  const images: SiteImages = {};
  if (!raw || typeof raw !== 'object') return images;
  for (const [site, url] of Object.entries(raw)) {
    if (typeof url === 'string' && isImageUrl(url.trim())) images[site] = url.trim();
  }
  return images;
}

export async function loadSiteImages(): Promise<SiteImages> {
  try {
    const stored = await chrome.storage.local.get(KEY);
    return normalizeSiteImages(stored[KEY]);
  } catch {
    return {};
  }
}

export async function saveSiteImages(images: SiteImages): Promise<void> {
  await chrome.storage.local.set({ [KEY]: normalizeSiteImages(images) });
}
