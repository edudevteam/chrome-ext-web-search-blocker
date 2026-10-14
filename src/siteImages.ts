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

/**
 * Text shown in place of an allowed entry's address, so a channel such as
 * `youtube.com/@name` can read `@name`.
 */
export type SiteLabels = Record<string, string>;

const LABELS_KEY = 'siteLabels';
export const MAX_SITE_LABEL = 60;

export function normalizeSiteLabels(raw: unknown): SiteLabels {
  const labels: SiteLabels = {};
  if (!raw || typeof raw !== 'object') return labels;
  for (const [site, label] of Object.entries(raw)) {
    if (typeof label !== 'string') continue;
    const text = label.trim().slice(0, MAX_SITE_LABEL);
    if (text) labels[site] = text;
  }
  return labels;
}

export async function loadSiteLabels(): Promise<SiteLabels> {
  try {
    const stored = await chrome.storage.local.get(LABELS_KEY);
    return normalizeSiteLabels(stored[LABELS_KEY]);
  } catch {
    return {};
  }
}

export async function saveSiteLabels(labels: SiteLabels): Promise<void> {
  await chrome.storage.local.set({ [LABELS_KEY]: normalizeSiteLabels(labels) });
}
