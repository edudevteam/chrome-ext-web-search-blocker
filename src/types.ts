export type SearchType = 'all' | 'images' | 'news' | 'videos' | 'maps' | 'goggles';

export const SEARCH_TYPES: SearchType[] = ['all', 'images', 'news', 'videos', 'maps', 'goggles'];

export const SEARCH_TYPE_LABELS: Record<SearchType, string> = {
  all: 'All',
  images: 'Images',
  news: 'News',
  videos: 'Videos',
  maps: 'Maps',
  goggles: 'Goggles',
};

export type EngineId = 'brave' | 'google';

export interface Settings {
  /** Master switch. When off, nothing is hidden anywhere. */
  enabled: boolean;
  /** Per-search-type switches. All on by default. */
  types: Record<SearchType, boolean>;
  /** Keyword rules. Plain text = case-insensitive substring; /re/flags = regex. */
  keywords: string[];
  /** Domains. `example.com` also matches `news.example.com`. */
  sites: string[];
  /** What happens when you navigate to a blocked site, rather than just search it. */
  redirect: RedirectSettings;
  /** Remove the image preview's filmstrip, whose thumbnails cannot be identified. */
  hidePreviewStrip: boolean;
}

export type RedirectMode = 'off' | 'url' | 'landing';

export interface RedirectSettings {
  mode: RedirectMode;
  /** Where to send you when mode is 'url'. */
  url: string;
  /** Landing page markup. Empty means the built-in template. */
  html: string;
}

/** Keeps the whole settings object inside chrome.storage.sync's 8KB item cap. */
export const MAX_LANDING_HTML = 6000;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  types: { all: true, images: true, news: true, videos: true, maps: true, goggles: true },
  keywords: [],
  sites: [],
  redirect: { mode: 'landing', url: '', html: '' },
  hidePreviewStrip: true,
};

/** content script -> popup */
export interface PageStats {
  engine: EngineId;
  searchType: SearchType;
  blocked: number;
  activeForThisType: boolean;
}

export type Message =
  | { type: 'wcb:get-stats' }
  | { type: 'wcb:stats'; stats: PageStats }
  | { type: 'wcb:count'; count: number };
