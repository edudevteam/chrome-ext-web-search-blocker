import type { EngineId, SearchType } from './types';

export interface Engine {
  id: EngineId;
  label: string;
  matches: (url: URL) => boolean;
  /** Which result tab we are on, or null if this page is not a result page. */
  detect: (url: URL) => SearchType | null;
  /** Where results live — we only observe/scan inside this. */
  roots: string[];
  /**
   * Held hidden until the first scan finishes, so blocked results are never
   * painted. Must be the results area only — never `body`, or a slow scan
   * would blank the page.
   */
  gate: string[];
  /**
   * Tab types whose results can render outside the results container — Brave's
   * image preview mounts its filmstrip elsewhere in the page — so candidates
   * are collected from the whole document instead.
   */
  scanWholePage: SearchType[];
  /**
   * A thumbnail inside the image preview's filmstrip. Its parent is the strip,
   * which can be removed wholesale — those thumbnails carry no caption or link,
   * so one that cannot be tied back to a blocked result cannot be judged at all.
   */
  previewStrip: string[];
  /** Candidate "one result" containers, per search type. Outermost match wins. */
  selectors: Record<SearchType, string[]>;
}

// Brave keeps rewriting its markup, so every list is intentionally redundant:
// stale selectors cost nothing, and a single surviving one keeps blocking alive.
const brave: Engine = {
  id: 'brave',
  label: 'Brave Search',
  matches: (url) => url.hostname === 'search.brave.com',
  detect: (url) => {
    const path = url.pathname.replace(/\/+$/, '');
    if (path === '/search') return 'all';
    if (path === '/images') return 'images';
    if (path === '/news') return 'news';
    if (path === '/videos') return 'videos';
    if (path === '/maps' || path.startsWith('/maps/')) return 'maps';
    if (path === '/goggles' || path.startsWith('/goggles/')) return 'goggles';
    return null;
  },
  roots: ['#results', '#side-right-results', 'main', 'body'],
  gate: ['#results'],
  scanWholePage: ['images'],
  previewStrip: ['button.images-grid-image', '.images-grid-image'],
  selectors: {
    all: [
      '.snippet[data-type]',
      '#results > .snippet',
      '.snippet',
      '[data-type="web"]',
      '[data-type="news"]',
      '[data-type="video"]',
      '[data-type="faq"]',
      '.video-card',
      '.news-card',
    ],
    images: [
      // Brave renders each image result as a <button> with no anchor at all —
      // the caption and source name live inside it, so the button is the tile.
      'button.image-result',
      // The filmstrip inside the image preview is a separate component.
      'button.images-grid-image',
      '.images-grid-image',
      '#results button[data-index]',
      '#results [data-index]:has(img)',
      '.image-wrapper',
      '.tile--image',
      '.image-tile',
      '#results .image',
      '[data-type="image"]',
      '#results a[href]:has(img)', // generic tile fallback
    ],
    news: ['.snippet[data-type]', '.news-card', '#results > .snippet', '.snippet'],
    videos: ['.snippet[data-type]', '.video-card', '#results > .snippet', '.snippet'],
    maps: ['.location-result', '.entity-card', '#results > div[data-pos]', '.snippet'],
    goggles: ['.goggle', '.goggle-card', '#results > .snippet', '.snippet'],
  },
};

const google: Engine = {
  id: 'google',
  label: 'Google',
  matches: (url) => /(^|\.)google\.[a-z.]+$/.test(url.hostname),
  detect: (url) => {
    if (url.pathname.startsWith('/maps')) return 'maps';
    if (!/^\/(search|imgres)/.test(url.pathname)) return null;
    const udm = url.searchParams.get('udm');
    const tbm = url.searchParams.get('tbm');
    if (udm === '2' || tbm === 'isch') return 'images';
    if (udm === '12' || tbm === 'nws') return 'news';
    if (udm === '7' || tbm === 'vid') return 'videos';
    if (tbm === 'lcl') return 'maps';
    return 'all';
  },
  roots: ['#search', '#rso', '#center_col', '#main', 'body'],
  gate: ['#search', '#rso'],
  scanWholePage: [],
  previewStrip: [],
  selectors: {
    all: ['#rso > div', '#search .MjjYud', '#search .g', 'div[data-hveid] > div[data-ved]'],
    images: ['#search [data-ri]', '.isv-r', 'div[data-id][jsaction]', '#search a[href]:has(img)'],
    news: ['.SoaBEf', '#rso > div', '#search .MjjYud'],
    videos: ['#rso > div', '#search .MjjYud', '#search .g'],
    maps: ['div[role="feed"] > div', '#rso > div', '.VkpGBb'],
    goggles: [], // Google has no Goggles tab.
  },
};

export const ENGINES: Engine[] = [brave, google];

export function engineFor(url: URL): Engine | null {
  return ENGINES.find((engine) => engine.matches(url)) ?? null;
}
