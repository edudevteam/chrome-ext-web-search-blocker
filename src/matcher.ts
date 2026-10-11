import type { Settings } from './types';

export interface KeywordRule {
  raw: string;
  test: (lowerText: string) => boolean;
}

export interface SiteRule {
  raw: string;
  /**
   * Whether this rule covers the whole host. Always false for a rule scoped to
   * a path, which only `testUrl` can judge.
   */
  test: (host: string) => boolean;
  /** Whether this rule covers the address: its host, and its path if it has one. */
  testUrl: (url: URL) => boolean;
  /** The part after the host (`/@channel`, `/watch?v=id`), or null for a whole site. */
  scope: string | null;
}

export interface CompiledRules {
  keywords: KeywordRule[];
  sites: SiteRule[];
  /** Covers the blocklist only — the whitelist never hides search results. */
  empty: boolean;
  /** Allowed sites, or null when whitelisting is off. Empty means nothing is allowed. */
  whitelist: SiteRule[] | null;
}

const REGEX_SYNTAX = /^\/(.+)\/([gimsuy]*)$/;

function compileKeyword(raw: string): KeywordRule | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const asRegex = REGEX_SYNTAX.exec(trimmed);
  if (asRegex) {
    try {
      // Drop `g`: lastIndex state would make repeated .test() calls alternate.
      const re = new RegExp(asRegex[1], asRegex[2].replace(/g/g, '') || 'i');
      return { raw: trimmed, test: (text) => re.test(text) };
    } catch {
      return null; // malformed regex — fall through to literal matching
    }
  }

  const needle = trimmed.toLowerCase();
  return { raw: trimmed, test: (text) => text.includes(needle) };
}

/**
 * `https://www.Example.com/path` -> `example.com`, keeping any `*` intact.
 *
 * With `keepPath`, the path and query stay (`example.com/path`) and the rule
 * covers only that page and the ones below it. Without it a pasted URL is cut
 * back to its domain — what the sites lists want.
 */
export function normalizeSite(raw: string, keepPath = false): string {
  const trimmed = raw.trim().replace(/^[a-z]+:\/\//i, '');
  const split = /^([^/?#]*)([^#]*)/.exec(trimmed);
  const host = (split?.[1] ?? '')
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');
  if (!host) return '';

  // A plain domain already covers its `www.`; a pattern is left exactly as typed.
  const site = host.includes('*') ? host : host.replace(/^www\./, '');
  if (!keepPath) return site;

  const scope = normalizeScope(split?.[2] ?? '');
  return scope ? `${site}${scope}` : site;
}

/** Whether a stored entry covers only part of a site (`example.com/path`). */
export function isPageRule(site: string): boolean {
  return /[/?]/.test(site);
}

/** For the sub-pages list: keeps the path, and refuses an entry without one. */
export function normalizePage(raw: string): string {
  const value = normalizeSite(raw, true);
  return isPageRule(value) ? value : '';
}

function decode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** `/Path/?b=2&a=1` -> `/path?b=2&a=1`; a bare `/` is no scope at all. */
function normalizeScope(rest: string): string {
  const [rawPath, rawQuery = ''] = rest.split('?', 2);
  const path = decode(rawPath).toLowerCase().replace(/\/+$/, '');
  const query = rawQuery.replace(/^&+|&+$/g, '');
  if (!path && !query) return '';
  return `${path || '/'}${query ? `?${query}` : ''}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Whether `url` falls under a path scope: the same path or one below it
 * (`/@name` covers `/@name/videos` but not `/@namesake`), carrying every query
 * parameter the scope names (`/watch?v=id` is that one video).
 */
function scopeMatches(scope: string, url: URL): boolean {
  const [path, query = ''] = scope.split('?', 2);
  const actual = decode(url.pathname).toLowerCase().replace(/\/+$/, '');
  if (path !== '/' && actual !== path && !actual.startsWith(`${path}/`)) return false;

  for (const pair of query.split('&').filter(Boolean)) {
    const [key, value] = pair.split('=', 2).map((part) => decode(part).toLowerCase());
    const found = [...url.searchParams].some(
      ([k, v]) => k.toLowerCase() === key && (value === undefined || v.toLowerCase() === value),
    );
    if (!found) return false;
  }
  return true;
}

/**
 * Plain entries match a domain and its subdomains. Entries containing `*` are
 * matched as a pattern against the whole hostname, so `porn*` catches
 * `pornhub.com`, `*hub.com` catches `videohub.com`, and `*sex*` catches either.
 * Anything after the host narrows the rule to that path — see `scopeMatches`.
 */
function compileSite(raw: string): SiteRule | null {
  const value = normalizeSite(raw, true);
  if (!value) return null;

  const cut = value.search(/[/?]/);
  const host = cut === -1 ? value : value.slice(0, cut);
  const scope = cut === -1 ? null : value.slice(cut);

  let hostTest: (host: string) => boolean;
  if (!host.includes('*')) {
    hostTest = (h) => hostMatches(h, host);
  } else {
    // A pattern of nothing but wildcards would block every result on the page.
    if (host.replace(/\*/g, '') === '') return null;
    let pattern: RegExp;
    try {
      pattern = new RegExp(`^${host.split('*').map(escapeRegExp).join('.*')}$`, 'i');
    } catch {
      return null;
    }
    hostTest = (h) => pattern.test(h.replace(/^www\./, ''));
  }

  return {
    raw: value,
    scope,
    test: (h) => scope === null && hostTest(h),
    testUrl: (url) =>
      hostTest(url.hostname.toLowerCase()) && (scope === null || scopeMatches(scope, url)),
  };
}

function compileSites(raw: string[]): SiteRule[] {
  // Stored entries are already in their final form, path included.
  return [...new Set(raw.map((site) => normalizeSite(site, true)).filter(Boolean))]
    .map(compileSite)
    .filter((rule): rule is SiteRule => rule !== null);
}

export function compileRules(settings: Settings): CompiledRules {
  const keywords = settings.keywords
    .map(compileKeyword)
    .filter((rule): rule is KeywordRule => rule !== null);
  const sites = compileSites(settings.sites);
  const whitelist = settings.whitelist.enabled ? compileSites(settings.whitelist.sites) : null;
  return { keywords, sites, empty: keywords.length === 0 && sites.length === 0, whitelist };
}

/** `news.example.com` matches the rule `example.com`, `notexample.com` does not. */
export function hostMatches(host: string, site: string): boolean {
  const h = host.replace(/^www\./, '');
  return h === site || h.endsWith(`.${site}`);
}

export interface ResultFacts {
  /** Visible text of the result, already lowercased. */
  text: string;
  /** Hostnames of every link inside the result. */
  hosts: string[];
  /** Full hrefs, for keyword matching against slugs. */
  urls: string[];
}

export interface MatchResult {
  blocked: boolean;
  reason: string;
}

const NO_MATCH: MatchResult = { blocked: false, reason: '' };

export function matchResult(facts: ResultFacts, rules: CompiledRules): MatchResult {
  for (const site of rules.sites) {
    const hit =
      site.scope === null
        ? facts.hosts.some((host) => site.test(host))
        : facts.urls.some((href) => {
            const url = parseUrl(href);
            return url !== null && site.testUrl(url);
          });
    if (hit) return { blocked: true, reason: site.raw };
  }

  if (rules.keywords.length > 0) {
    const haystack = `${facts.text} ${facts.urls.join(' ').toLowerCase()}`;
    for (const rule of rules.keywords) {
      if (rule.test(haystack)) return { blocked: true, reason: rule.raw };
    }
  }

  return NO_MATCH;
}

function parseUrl(href: string): URL | null {
  try {
    return new URL(href);
  } catch {
    return null;
  }
}
