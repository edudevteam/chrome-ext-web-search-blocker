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
  /** When on, every site not listed here is treated as blocked. */
  whitelist: WhitelistSettings;
  /** How the landing and new tab pages present themselves in the tab strip. */
  tab: TabSettings;
}

export interface TabSettings {
  /** Replace the page's own title with `title`. */
  customTitle: boolean;
  title: string;
  /** Use the uploaded icon (see tabIcon.ts) as the favicon. */
  customIcon: boolean;
}

export const MAX_TAB_TITLE = 100;

export interface WhitelistSettings {
  enabled: boolean;
  /** Same syntax as `sites`: subdomains included, `*` wildcards allowed. */
  sites: string[];
}

export type RedirectMode = 'off' | 'url' | 'landing';

export interface RedirectSettings {
  mode: RedirectMode;
  /** Where to send you when mode is 'url'. */
  url: string;
  /** Use `html` in place of the built-in landing page. Off keeps `html` saved. */
  customHtml: boolean;
  /** Landing page markup. Empty means the built-in template. */
  html: string;
  /** List the allowed sites in custom HTML even while the whitelist is off. */
  showAllowedSites: boolean;
}

/** Keeps the whole settings object inside chrome.storage.sync's 8KB item cap. */
export const MAX_LANDING_HTML = 6000;

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  types: { all: true, images: true, news: true, videos: true, maps: true, goggles: true },
  keywords: [],
  sites: [],
  redirect: { mode: 'landing', url: '', customHtml: false, html: '', showAllowedSites: false },
  hidePreviewStrip: true,
  whitelist: { enabled: false, sites: [] },
  tab: { customTitle: false, title: '', customIcon: false },
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
