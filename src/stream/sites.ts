import { compileKeyword, type KeywordRule } from '../matcher';
import type { StreamSettings } from '../types';

/** Where a streaming site keeps its results, and what to read off each one. */
export interface StreamSite {
  id: string;
  matches: (host: string) => boolean;
  /** One element per video, channel, playlist or ad result. Hidden whole. */
  cards: string;
  /**
   * Inside a card. Every match is read, not just the first: one layout's
   * element is often present but empty or hidden while another holds the text.
   */
  channel: string;
  title: string;
  /** The description snippet, where the layout shows one. */
  description: string;
  /** The video page, which is left for `home` when the video itself matches. */
  watch: WatchPage;
  home: string;
}

export interface WatchPage {
  /** The video this address is for, or null when it is not a video page. */
  videoId: (url: URL) => string | null;
  /**
   * The video the page is currently showing. YouTube changes the address before
   * it swaps the details in, so nothing is judged until the two agree.
   */
  showing: (doc: Document) => string | null;
  /** The details beneath the player. Same reading rules as a card's. */
  root: string;
  channel: string;
  title: string;
  description: string;
}

export const STREAM_SITES: StreamSite[] = [
  {
    id: 'youtube',
    matches: (host) => host === 'youtube.com' || host === 'www.youtube.com',
    cards: [
      'ytd-video-renderer', // search results
      'ytd-channel-renderer', // channel results
      'ytd-playlist-renderer',
      'ytd-radio-renderer', // mixes
      'ytd-movie-renderer',
      'ytd-rich-item-renderer', // home and subscriptions grid
      'ytd-grid-video-renderer',
      'ytd-compact-video-renderer', // watch-page sidebar
      'ytd-compact-radio-renderer',
      'ytd-compact-playlist-renderer',
      'ytd-reel-item-renderer', // shorts shelf
      'ytd-ad-slot-renderer', // sponsored results
      'yt-lockup-view-model', // newer layout, used in places of the above
      'ytm-shorts-lockup-view-model',
      'ytm-shorts-lockup-view-model-v2',
    ].join(','),
    // YouTube is moving from ids to generated camelCase classes (ytLockupMetadata…,
    // ytContentMetadata…), so both generations are listed.
    channel: [
      '#channel-info',
      '#attributed-channel-name',
      'ytd-channel-name',
      '#channel-title',
      'a[href^="/@"]',
      '[class*="ContentMetadataViewModelMetadataText"]',
      '.yt-content-metadata-view-model__metadata-text',
    ].join(','),
    title: [
      '#video-title',
      'h3',
      '[class*="LockupMetadataViewModelTitle"]',
      '[class*="TextsStyleCompactHeadline"]', // ads
    ].join(','),
    description: [
      '.metadata-snippet-container',
      '#description-text',
      '[class*="TextsStyleCompactDescription"]', // ads
    ].join(','),
    watch: {
      videoId: (url) => (url.pathname === '/watch' ? url.searchParams.get('v') : null),
      showing: (doc) => doc.querySelector('ytd-watch-flexy')?.getAttribute('video-id') ?? null,
      root: 'ytd-watch-metadata',
      channel: '#owner ytd-channel-name, #owner #channel-name',
      title: '#title h1, h1',
      // The collapsed description still holds its full text.
      description: '#description-inline-expander, ytd-text-inline-expander, #description',
    },
    home: 'https://www.youtube.com/',
  },
];

/** The text a card shows for each field. */
export interface CardText {
  channel: string;
  title: string;
  description: string;
}

function allText(card: Element, selector: string): string {
  const parts = new Set<string>();
  for (const el of card.querySelectorAll(selector)) {
    const text = el.textContent?.replace(/\s+/g, ' ').trim();
    if (text) parts.add(text);
  }
  return [...parts].join('\n');
}

/**
 * Avatars and channel links carry the name only in `aria-label`
 * ("Go to channel Watermelon Music"), and ads carry it nowhere else.
 */
function channelLabels(card: Element): string {
  const labels: string[] = [];
  for (const el of card.querySelectorAll('[aria-label]')) {
    const label = el.getAttribute('aria-label') ?? '';
    const name = /^Go to channel (.+)$/.exec(label)?.[1];
    if (name) labels.push(name);
    else if (el.matches('[class*="AvatarShape"]') && label) labels.push(label);
  }
  return labels.join('\n');
}

export function readCard(card: Element, site: StreamSite): CardText {
  return {
    channel: [allText(card, site.channel), channelLabels(card)].filter(Boolean).join('\n'),
    title: allText(card, site.title),
    description: allText(card, site.description),
  };
}

/**
 * The details of the video this page is for, or null while the page has not
 * loaded them — or is not a video page at all.
 */
export function readWatchPage(doc: Document, url: URL, site: StreamSite): CardText | null {
  const { watch } = site;
  const id = watch.videoId(url);
  if (!id || watch.showing(doc) !== id) return null;
  const root = doc.querySelector(watch.root);
  if (!root) return null;
  return {
    channel: allText(root, watch.channel),
    title: allText(root, watch.title),
    description: allText(root, watch.description),
  };
}

export function streamSiteFor(host: string): StreamSite | null {
  return STREAM_SITES.find((site) => site.matches(host)) ?? null;
}

export interface StreamRules {
  channels: KeywordRule[];
  keywords: KeywordRule[];
  empty: boolean;
}

function compileAll(raw: string[]): KeywordRule[] {
  return raw.map(compileKeyword).filter((rule): rule is KeywordRule => rule !== null);
}

/** Plain channel rules lose their spaces too, so `vmx gaming` matches `VMXGaming`. */
function compileChannel(raw: string): KeywordRule | null {
  const trimmed = raw.trim();
  if (trimmed.startsWith('/')) return compileKeyword(trimmed);
  const rule = compileKeyword(trimmed.replace(/\s+/g, ''));
  return rule && { ...rule, raw: trimmed };
}

export function compileStreamRules(stream: StreamSettings): StreamRules {
  const channels = stream.channels
    .map(compileChannel)
    .filter((rule): rule is KeywordRule => rule !== null);
  const keywords = compileAll(stream.keywords);
  return { channels, keywords, empty: channels.length + keywords.length === 0 };
}

/**
 * Channel names are compared with their spaces removed as well, so `vmx` still
 * catches a channel YouTube lays out as `V M X`. Each name is squashed on its
 * own, so a rule never matches across two of them.
 */
export function matchStream(
  channel: string,
  title: string,
  description: string,
  rules: StreamRules,
): string | null {
  const name = channel.toLowerCase().trim();
  const squashed = name
    .split('\n')
    .map((line) => line.replace(/\s+/g, ''))
    .join('\n');
  for (const rule of rules.channels) {
    if (rule.test(name) || rule.test(squashed)) return `channel: ${rule.raw}`;
  }
  const heading = title.toLowerCase().trim();
  const snippet = description.toLowerCase().trim();
  for (const rule of rules.keywords) {
    if (rule.test(heading)) return `title: ${rule.raw}`;
    if (rule.test(snippet)) return `description: ${rule.raw}`;
  }
  return null;
}

/** Where a streaming site puts the search, and where to send a blocked one. */
export interface StreamSearch {
  id: string;
  matches: (host: string) => boolean;
  /** The search typed on this page, or null when the page is not a search. */
  query: (url: URL) => string | null;
  home: string;
}

export const STREAM_SEARCHES: StreamSearch[] = [
  {
    id: 'youtube',
    matches: (host) => host === 'youtube.com' || host.endsWith('.youtube.com'),
    // /results?search_query=… — and the older ?q= that still redirects there.
    query: (url) =>
      url.pathname === '/results'
        ? (url.searchParams.get('search_query') ?? url.searchParams.get('q'))
        : null,
    home: 'https://www.youtube.com/',
  },
  {
    id: 'vimeo',
    matches: (host) => host === 'vimeo.com' || host === 'www.vimeo.com',
    query: (url) => (url.pathname.startsWith('/search') ? url.searchParams.get('q') : null),
    home: 'https://vimeo.com/',
  },
];

/**
 * Where to send a search that matches a stream rule, or null to let it through.
 * The query is checked against both lists, so searching a blocked channel's
 * name is caught as well as a blocked keyword.
 */
export function blockedSearchTarget(url: URL, rules: StreamRules): string | null {
  if (rules.empty) return null;
  const search = STREAM_SEARCHES.find((site) => site.matches(url.hostname));
  const query = search?.query(url)?.trim();
  if (!search || !query) return null;
  return matchStream(query, query, '', rules) ? search.home : null;
}
