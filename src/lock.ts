/**
 * Password lock for the popup and settings page, plus the optional guard on the
 * browser's extensions page.
 *
 * The lock lives in chrome.storage.local, apart from the synced settings, so a
 * rules import or a sync from another device can never clear it. An unlock is
 * kept in chrome.storage.session: shared by every extension page and the
 * service worker, hidden from content scripts, and gone when the browser quits.
 */

export interface LockState {
  /** PBKDF2-SHA-256 of the password, base64. */
  hash: string;
  /** Random per-password salt, base64. */
  salt: string;
  /** Send tabs opening chrome://extensions to the password prompt first. */
  guardExtensions: boolean;
}

export const UNLOCK_MINUTES = 10;
export const MIN_PASSWORD_LENGTH = 4;

const LOCK_KEY = 'lock';
const UNLOCK_KEY = 'unlockedUntil';
const ITERATIONS = 210_000;

function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array<ArrayBuffer>): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    256,
  );
  return toBase64(new Uint8Array(bits));
}

function normalizeLock(raw: unknown): LockState | null {
  const value = (raw ?? {}) as Partial<LockState>;
  if (typeof value.hash !== 'string' || typeof value.salt !== 'string') return null;
  return { hash: value.hash, salt: value.salt, guardExtensions: value.guardExtensions === true };
}

export async function loadLock(): Promise<LockState | null> {
  const stored = await chrome.storage.local.get(LOCK_KEY);
  return normalizeLock(stored[LOCK_KEY]);
}

export async function verifyPassword(lock: LockState, password: string): Promise<boolean> {
  return (await derive(password, fromBase64(lock.salt))) === lock.hash;
}

/** Sets or replaces the password. The page doing it stays unlocked. */
export async function setPassword(password: string, guardExtensions: boolean): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const lock: LockState = { hash: await derive(password, salt), salt: toBase64(salt), guardExtensions };
  // Unlock first, so pages reacting to the new lock don't flash the prompt.
  await unlock();
  await chrome.storage.local.set({ [LOCK_KEY]: lock });
}

export async function setGuardExtensions(guardExtensions: boolean): Promise<void> {
  const lock = await loadLock();
  if (lock) await chrome.storage.local.set({ [LOCK_KEY]: { ...lock, guardExtensions } });
}

export async function removePassword(): Promise<void> {
  await chrome.storage.local.remove(LOCK_KEY);
}

export async function isUnlocked(): Promise<boolean> {
  const stored = await chrome.storage.session.get(UNLOCK_KEY);
  const until = stored[UNLOCK_KEY];
  return typeof until === 'number' && until > Date.now();
}

export async function unlock(): Promise<void> {
  await chrome.storage.session.set({ [UNLOCK_KEY]: Date.now() + UNLOCK_MINUTES * 60_000 });
}

export async function relock(): Promise<void> {
  await chrome.storage.session.remove(UNLOCK_KEY);
}

/** True when there is no password, or it was entered recently. */
export async function isOpen(): Promise<boolean> {
  return !(await loadLock()) || (await isUnlocked());
}

/** Fires when the password, the guard, or the unlock changes. */
export function onLockChanged(cb: () => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if ((areaName === 'local' && changes[LOCK_KEY]) || (areaName === 'session' && changes[UNLOCK_KEY])) {
      cb();
    }
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** chrome://extensions and its subpages, under any Chromium browser's scheme. */
export function isExtensionsPage(url: string): boolean {
  return /^(chrome|brave|edge|opera|vivaldi):\/\/extensions\b/i.test(url);
}
