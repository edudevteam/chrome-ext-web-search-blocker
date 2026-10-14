/**
 * Updates from the Chrome Web Store.
 *
 * Chrome checks the Store every few hours and downloads a new version on its
 * own, but only swaps it in once the service worker goes idle or the browser
 * restarts. The background records a downloaded version under PENDING_KEY so
 * the popup and settings page can offer to apply it straight away; reloading
 * the extension installs it, and the synced rules carry over untouched.
 *
 * An unpacked install has no update channel, so the pages explain that instead.
 */

const PENDING_KEY = 'pendingUpdate';

export type CheckResult =
  | { status: 'downloading'; version: string }
  | { status: 'current' }
  | { status: 'throttled' }
  | { status: 'failed' };

/** The version Chrome has downloaded and is waiting to install, if any. */
export async function loadPendingUpdate(): Promise<string | null> {
  const stored = await chrome.storage.local.get(PENDING_KEY);
  const version = stored[PENDING_KEY];
  return typeof version === 'string' && version !== chrome.runtime.getManifest().version
    ? version
    : null;
}

export async function savePendingUpdate(version: string): Promise<void> {
  await chrome.storage.local.set({ [PENDING_KEY]: version });
}

export async function clearPendingUpdate(): Promise<void> {
  await chrome.storage.local.remove(PENDING_KEY);
}

export function onPendingUpdateChanged(listener: (version: string | null) => void): () => void {
  const handler = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === 'local' && PENDING_KEY in changes) void loadPendingUpdate().then(listener);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

/** True when loaded with Load unpacked, which Chrome never updates. */
export async function isUnpacked(): Promise<boolean> {
  try {
    return (await chrome.management.getSelf()).installType === 'development';
  } catch {
    return false;
  }
}

/**
 * Asks the Store for a newer version now rather than at Chrome's next check.
 * A 'downloading' result is followed by onUpdateAvailable once the download
 * finishes, which is when the background records it as pending.
 */
export async function checkForUpdate(): Promise<CheckResult> {
  try {
    const result = await chrome.runtime.requestUpdateCheck();
    if (result.status === 'update_available') {
      return { status: 'downloading', version: result.version ?? '' };
    }
    return result.status === 'throttled' ? { status: 'throttled' } : { status: 'current' };
  } catch {
    return { status: 'failed' };
  }
}

/** Installs the downloaded version. Every extension page closes as it reloads. */
export function applyUpdate(): void {
  chrome.runtime.reload();
}
