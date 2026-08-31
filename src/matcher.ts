import type { Settings } from './types';

export interface KeywordRule {
  raw: string;
  test: (lowerText: string) => boolean;
}

export interface SiteRule {
  raw: string;
  test: (host: string) => boolean;
}

export interface CompiledRules {
  keywords: KeywordRule[];
  sites: SiteRule[];
  empty: boolean;
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

/** `https://www.Example.com/path` -> `example.com`, keeping any `*` intact. */
export function normalizeSite(raw: string): string {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, '')
    .replace(/[/?#].*$/, '')
    .replace(/:\d+$/, '')
    .replace(/\.+$/, '');

  // A plain domain already covers its `www.`; a pattern is left exactly as typed.
  return value.includes('*') ? value : value.replace(/^www\./, '');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Plain entries match a domain and its subdomains. Entries containing `*` are
 * matched as a pattern against the whole hostname, so `porn*` catches
 * `pornhub.com`, `*hub.com` catches `videohub.com`, and `*sex*` catches either.
 */
function compileSite(raw: string): SiteRule | null {
  const value = normalizeSite(raw);
  if (!value) return null;

  if (!value.includes('*')) {
    return { raw: value, test: (host) => hostMatches(host, value) };
  }

  // A pattern of nothing but wildcards would block every result on the page.
  if (value.replace(/\*/g, '') === '') return null;

  const source = `^${value.split('*').map(escapeRegExp).join('.*')}$`;
  let pattern: RegExp;
  try {
    pattern = new RegExp(source, 'i');
  } catch {
    return null;
  }
  return { raw: value, test: (host) => pattern.test(host.replace(/^www\./, '')) };
}

export function compileRules(settings: Settings): CompiledRules {
  const keywords = settings.keywords
    .map(compileKeyword)
    .filter((rule): rule is KeywordRule => rule !== null);
  const sites = [...new Set(settings.sites.map(normalizeSite).filter(Boolean))]
    .map(compileSite)
    .filter((rule): rule is SiteRule => rule !== null);
  return { keywords, sites, empty: keywords.length === 0 && sites.length === 0 };
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
    if (facts.hosts.some((host) => site.test(host))) {
      return { blocked: true, reason: site.raw };
    }
  }

  if (rules.keywords.length > 0) {
    const haystack = `${facts.text} ${facts.urls.join(' ').toLowerCase()}`;
    for (const rule of rules.keywords) {
      if (rule.test(haystack)) return { blocked: true, reason: rule.raw };
    }
  }

  return NO_MATCH;
}
