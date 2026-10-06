/**
 * Your own sayings for the landing page, in place of the built-in proverbs.
 *
 * Kept in chrome.storage.local rather than with the synced settings: a long list
 * would blow through chrome.storage.sync's 8KB item cap.
 */

export interface Saying {
  text: string;
  /** Attribution shown under the text. Optional. */
  ref: string;
}

export interface SayingsState {
  sayings: Saying[];
  /** Name of the file they came from, for the settings page. */
  source: string;
}

export const MAX_SAYINGS = 1000;
export const MAX_SAYING_LENGTH = 1000;

const KEY = 'sayings';

/** `text — ref`, `text -- ref` or `text | ref`; the attribution is optional. */
const REF_SEPARATOR = /\s+(?:—|--|\|)\s+/;

function clean(text: unknown, ref: unknown): Saying | null {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim().slice(0, MAX_SAYING_LENGTH);
  if (!trimmed) return null;
  return { text: trimmed, ref: typeof ref === 'string' ? ref.trim().slice(0, 200) : '' };
}

function fromLine(line: string): Saying | null {
  const at = line.search(REF_SEPARATOR);
  if (at === -1) return clean(line, '');
  const separator = line.slice(at).match(REF_SEPARATOR)![0];
  return clean(line.slice(0, at), line.slice(at + separator.length));
}

/**
 * Plain text takes one saying per line; JSON takes an array of strings or of
 * `{ text, ref }` objects, bare or under a `sayings` key.
 */
export function parseSayings(raw: string): Saying[] {
  const trimmed = raw.replace(/^﻿/, '').trim();
  let parsed: (Saying | null)[];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    const data: unknown = JSON.parse(trimmed);
    const list = Array.isArray(data) ? data : (data as { sayings?: unknown })?.sayings;
    if (!Array.isArray(list)) throw new Error('expected a list of sayings');
    parsed = list.map((item) =>
      typeof item === 'string'
        ? fromLine(item)
        : clean((item as Partial<Saying>)?.text, (item as Partial<Saying>)?.ref),
    );
  } else {
    parsed = trimmed.split(/\r?\n/).map(fromLine);
  }

  const sayings = parsed.filter((item): item is Saying => item !== null).slice(0, MAX_SAYINGS);
  if (sayings.length === 0) throw new Error('no sayings in that file');
  return sayings;
}

function normalize(raw: unknown): SayingsState | null {
  const value = (raw ?? {}) as Partial<SayingsState>;
  if (!Array.isArray(value.sayings)) return null;
  const sayings = value.sayings
    .map((item) => clean(item?.text, item?.ref))
    .filter((item): item is Saying => item !== null);
  if (sayings.length === 0) return null;
  return { sayings, source: typeof value.source === 'string' ? value.source : '' };
}

/** Null means the built-in proverbs are in use. */
export async function loadSayings(): Promise<SayingsState | null> {
  const stored = await chrome.storage.local.get(KEY);
  return normalize(stored[KEY]);
}

export async function saveSayings(state: SayingsState): Promise<void> {
  await chrome.storage.local.set({ [KEY]: state });
}

export async function clearSayings(): Promise<void> {
  await chrome.storage.local.remove(KEY);
}

export function onSayingsChanged(cb: (state: SayingsState | null) => void): () => void {
  const listener = (changes: Record<string, chrome.storage.StorageChange>, areaName: string) => {
    if (areaName === 'local' && changes[KEY]) cb(normalize(changes[KEY].newValue));
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}
