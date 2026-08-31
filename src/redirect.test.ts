import { beforeAll, describe, expect, it } from 'vitest';
import { compileRules } from './matcher';
import { redirectTarget, shouldRedirect } from './redirect';
import { DEFAULT_SETTINGS, type RedirectMode, type Settings } from './types';

const LANDING = 'chrome-extension://testid/blocked.html';

beforeAll(() => {
  // The page APIs the redirect helpers touch; no browser here.
  (globalThis as { chrome?: unknown }).chrome = {
    runtime: { getURL: (path: string) => `chrome-extension://testid/${path}` },
  };
});

function settings(sites: string[], mode: RedirectMode, url = ''): Settings {
  return { ...DEFAULT_SETTINGS, sites, redirect: { mode, url, html: '' } };
}

const rulesFor = (sites: string[]) => compileRules(settings(sites, 'landing'));

describe('shouldRedirect', () => {
  it('catches a blocked host and its subdomains', () => {
    const rules = rulesFor(['example.com']);
    expect(shouldRedirect(new URL('https://example.com/page'), rules)).toBe(true);
    expect(shouldRedirect(new URL('https://news.example.com/'), rules)).toBe(true);
    expect(shouldRedirect(new URL('https://notexample.com/'), rules)).toBe(false);
  });

  it('honours wildcards exactly as the search rules do', () => {
    const rules = rulesFor(['porn*']);
    expect(shouldRedirect(new URL('https://pornhub.com/'), rules)).toBe(true);
    expect(shouldRedirect(new URL('https://popcorn.com/'), rules)).toBe(false);
  });

  it('never redirects a search engine, even when its domain is blocked', () => {
    const rules = rulesFor(['google.com', 'brave.com']);
    expect(shouldRedirect(new URL('https://www.google.com/search?q=x'), rules)).toBe(false);
    expect(shouldRedirect(new URL('https://search.brave.com/images?q=x'), rules)).toBe(false);
  });

  it('leaves non-web schemes alone', () => {
    const rules = rulesFor(['example.com']);
    expect(shouldRedirect(new URL('ftp://example.com/file'), rules)).toBe(false);
  });
});

describe('redirectTarget', () => {
  it('does nothing when switched off', () => {
    expect(redirectTarget(settings(['a.com'], 'off'), rulesFor(['a.com']))).toBeNull();
  });

  it('returns the landing page in landing mode', () => {
    expect(redirectTarget(settings(['a.com'], 'landing'), rulesFor(['a.com']))).toBe(LANDING);
  });

  it('accepts a bare domain and gives it a scheme', () => {
    expect(redirectTarget(settings(['a.com'], 'url', 'example.org/read'), rulesFor(['a.com']))).toBe(
      'https://example.org/read',
    );
  });

  it('falls back to the landing page when the target is itself blocked', () => {
    // Without this the tab would bounce between two blocked addresses forever.
    const rules = rulesFor(['a.com', 'example.org']);
    expect(redirectTarget(settings(['a.com', 'example.org'], 'url', 'example.org'), rules)).toBe(
      LANDING,
    );
  });

  it('falls back to the landing page for an empty or unusable target', () => {
    const rules = rulesFor(['a.com']);
    expect(redirectTarget(settings(['a.com'], 'url', '   '), rules)).toBe(LANDING);
    expect(redirectTarget(settings(['a.com'], 'url', 'javascript:alert(1)'), rules)).toBe(LANDING);
  });
});
