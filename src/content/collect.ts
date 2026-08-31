import type { ResultFacts } from '../matcher';

const MAX_CANDIDATES = 600;
/** An element holding this many other candidates is a container, not a result. */
const CONTAINER_THRESHOLD = 2;
/**
 * A single result links to one site plus a handful of deep links. Anything
 * pointing at more distinct hosts than this is a grid or a sidebar, and hiding
 * it would take out the whole page — so we skip it and under-block instead.
 */
export const MAX_DISTINCT_HOSTS = 5;

export function findRoot(rootSelectors: string[]): Element | null {
  for (const selector of rootSelectors) {
    const el = document.querySelector(selector);
    if (el) return el;
  }
  return null;
}

/**
 * Turn a redundant selector list into a flat list of individual results:
 * containers are dropped in favour of their children, and nested duplicates
 * collapse to the outermost surviving element.
 */
export function collectCandidates(root: Element, selectors: string[]): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const selector of selectors) {
    let matches: NodeListOf<HTMLElement>;
    try {
      // Queried against the document, then narrowed to `root`: the selectors are
      // already anchored (`#results > div`), and element-scoped queries treat
      // such prefixes inconsistently.
      matches = document.querySelectorAll<HTMLElement>(selector);
    } catch {
      continue; // an invalid selector must not take the whole pass down
    }
    for (const el of matches) {
      if (found.size >= MAX_CANDIDATES) break;
      if (el !== root && root.contains(el) && isResultLike(el)) found.add(el);
    }
  }

  const all = [...found];
  const leaves = all.filter((el) => {
    let contained = 0;
    for (const other of all) {
      if (other !== el && el.contains(other) && ++contained >= CONTAINER_THRESHOLD) return false;
    }
    return true;
  });

  const kept = new Set(leaves);
  return leaves.filter((el) => {
    for (let p = el.parentElement; p; p = p.parentElement) {
      if (kept.has(p)) return false;
    }
    return true;
  });
}

/**
 * Identifiers for the image behind an <img>, used to recognise the same picture
 * where it appears again without any caption or link to match on.
 *
 * The full URL is the strong key. The last path segment is kept as well when it
 * is long enough to be a content hash, because engines proxy the same image at
 * different sizes through URLs that differ only in their size parameters.
 */
export function sourceKeys(img: HTMLImageElement): string[] {
  const keys: string[] = [];
  for (const attr of ['src', 'data-src', 'data-lazy-src']) {
    const raw = img.getAttribute(attr);
    if (!raw || raw.startsWith('data:')) continue;

    let url: URL;
    try {
      url = new URL(raw, location.href);
    } catch {
      continue;
    }
    keys.push(url.href);

    const segment = url.pathname.split('/').filter(Boolean).pop();
    if (segment && segment.length >= 16) keys.push(segment);
  }
  return keys;
}

/**
 * Thumbnails belonging to an overlay rather than to the results grid.
 *
 * The same component class is used for both, so the only thing separating the
 * preview's recommendations from the live grid is where they sit: anything
 * inside the results container is a real result and must be left alone,
 * clickable and intact.
 */
export function findOverlayThumbnails(
  selectors: string[],
  resultsSelectors: string[],
): HTMLElement[] {
  const found = new Set<HTMLElement>();
  for (const selector of selectors) {
    let matches: NodeListOf<HTMLElement>;
    try {
      matches = document.querySelectorAll<HTMLElement>(selector);
    } catch {
      continue;
    }
    for (const el of matches) {
      if (resultsSelectors.some((results) => el.closest(results))) continue;
      found.add(el);
    }
  }
  return [...found];
}

/** Guards against hiding a whole results grid that matched a loose selector. */
export function looksLikeContainer(facts: ResultFacts): boolean {
  return new Set(facts.hosts).size > MAX_DISTINCT_HOSTS;
}

/** How far above a matched image we will look for its tile. */
const TILE_MAX_CLIMB = 8;
/** Below this, an image is chrome — a favicon or a badge — not a result thumbnail. */
const THUMBNAIL_MIN_PX = 40;

function isThumbnail(img: HTMLImageElement): boolean {
  const rect = img.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return rect.width >= THUMBNAIL_MIN_PX || rect.height >= THUMBNAIL_MIN_PX;
  }
  // Not laid out yet — a favicon that has not loaded must not be mistaken for a
  // second result, which would stop the climb at the image and strand its caption.
  const declared = Math.max(
    img.naturalWidth,
    img.naturalHeight,
    Number(img.getAttribute('width')) || 0,
    Number(img.getAttribute('height')) || 0,
  );
  if (declared > 0) return declared >= THUMBNAIL_MIN_PX;
  return true; // nothing to go on: count it and stop early rather than over-reach
}

function countThumbnails(el: Element): number {
  let count = 0;
  for (const img of el.querySelectorAll('img')) {
    if (isThumbnail(img)) count += 1;
  }
  return count;
}

/**
 * Walks up from a matched image to the element holding the whole result — the
 * thumbnail plus its caption and source link — so all of it can be removed
 * together rather than leaving orphaned text behind.
 *
 * The climb stops at the first ancestor that reaches a second thumbnail or
 * spans too many hosts, because that ancestor is the grid rather than the tile.
 * Returns the image itself when no tile can be isolated.
 */
export function findTile(img: HTMLElement, root: Element): HTMLElement {
  let tile = img;
  let node = img.parentElement;

  for (let depth = 0; node && node !== root && depth < TILE_MAX_CLIMB; depth += 1) {
    if (countThumbnails(node) > 1) break;
    if (looksLikeContainer(extractFacts(node))) break;
    tile = node;
    node = node.parentElement;
  }
  return tile;
}

/** Cheap sanity check: a result links somewhere or shows an image. */
function isResultLike(el: HTMLElement): boolean {
  if (el.matches('a[href]') || el.querySelector('a[href]')) return true;
  return el.querySelector('img') !== null;
}

/** Attributes engines use to stash a tile's real source URL. */
const URL_ATTRS = ['data-url', 'data-href', 'data-source', 'data-context-url', 'data-domain'];

const DOMAIN_IN_TEXT = /\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b/gi;
/** Endings that look like a domain but are a filename. */
const FILE_ENDINGS = new Set([
  'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico',
  'html', 'htm', 'php', 'aspx', 'json', 'xml', 'txt', 'pdf',
  'mp4', 'webm', 'mp3', 'css', 'js', 'zip',
]);

/**
 * Last resort for results that name their source in visible text but never
 * link to it — Brave's image tiles are <button> elements with no anchor, so
 * without this a site rule has nothing to match against.
 */
function hostsFromText(text: string): string[] {
  const hosts: string[] = [];
  for (const match of text.matchAll(DOMAIN_IN_TEXT)) {
    const candidate = match[0].toLowerCase();
    if (FILE_ENDINGS.has(candidate.slice(candidate.lastIndexOf('.') + 1))) continue;
    hosts.push(candidate);
  }
  return hosts;
}

/**
 * Text content with a separator between elements. `textContent` runs adjacent
 * nodes together — a caption span followed by a source span yields
 * "recipepinterest.com" — which invents both keyword and domain matches.
 */
export function visibleText(el: HTMLElement): string {
  const parts: string[] = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const value = walker.currentNode.nodeValue?.trim();
    if (value) parts.push(value);
  }
  return parts.join(' ');
}

function pushUrl(raw: string | null, hosts: string[], urls: string[]): void {
  const url = resolveHref(raw);
  if (!url) return;
  urls.push(url.href);
  hosts.push(url.hostname.toLowerCase());
}

export function extractFacts(el: HTMLElement): ResultFacts {
  const hosts: string[] = [];
  const urls: string[] = [];

  const anchors: HTMLAnchorElement[] = [];
  if (el instanceof HTMLAnchorElement) anchors.push(el);
  anchors.push(...el.querySelectorAll<HTMLAnchorElement>('a[href]'));
  for (const anchor of anchors) pushUrl(anchor.getAttribute('href'), hosts, urls);

  // Image tiles often carry the source page in a data attribute rather than an
  // href, so a site rule would never fire without this.
  for (const node of [el, ...el.querySelectorAll<HTMLElement>('[data-url],[data-domain]')]) {
    for (const attr of URL_ATTRS) pushUrl(node.getAttribute(attr), hosts, urls);
  }

  const alt: string[] = [];
  for (const img of el.querySelectorAll('img')) {
    if (img.alt) alt.push(img.alt);
    if (img.title) alt.push(img.title);
  }

  const text = `${visibleText(el)} ${alt.join(' ')}`.replace(/\s+/g, ' ').trim().toLowerCase();
  // Only when there is no link at all, so a snippet that merely mentions a
  // domain is never treated as coming from it.
  if (hosts.length === 0) hosts.push(...hostsFromText(text));

  return { text, hosts, urls };
}

/**
 * Facts for a single <img>, used by the image-blanking safety net when no tile
 * container could be identified. Deliberately narrow: the image's own sources,
 * its alt text, and the tile-scoped anchor around it — never a wider ancestor,
 * which on a grid would be every result at once.
 */
export function imageFacts(img: HTMLImageElement): ResultFacts {
  const hosts: string[] = [];
  const urls: string[] = [];
  const text: string[] = [img.alt, img.title, img.getAttribute('aria-label') ?? ''];

  for (const attr of ['src', 'data-src', 'data-lazy-src', ...URL_ATTRS]) {
    pushUrl(img.getAttribute(attr), hosts, urls);
  }

  const anchor = img.closest('a[href]');
  if (anchor) {
    pushUrl(anchor.getAttribute('href'), hosts, urls);
    text.push(anchor.getAttribute('title') ?? '', visibleText(anchor as HTMLElement));
  }

  const tile = img.closest<HTMLElement>('[data-url],[data-domain],[data-ri]');
  if (tile) for (const attr of URL_ATTRS) pushUrl(tile.getAttribute(attr), hosts, urls);

  return { text: text.join(' ').replace(/\s+/g, ' ').trim().toLowerCase(), hosts, urls };
}

/** Resolves relative hrefs and unwraps Google's `/url?q=` redirector. */
function resolveHref(raw: string | null): URL | null {
  if (!raw || raw.startsWith('#') || raw.startsWith('javascript:')) return null;
  let url: URL;
  try {
    url = new URL(raw, location.href);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;

  if (url.pathname === '/url' || url.pathname === '/imgres') {
    // imgrefurl is the page hosting the image — that is what a site rule means.
    const target =
      url.searchParams.get('q') ??
      url.searchParams.get('imgrefurl') ??
      url.searchParams.get('imgurl');
    if (target) {
      try {
        return new URL(target);
      } catch {
        /* keep the wrapper URL */
      }
    }
  }
  return url;
}
