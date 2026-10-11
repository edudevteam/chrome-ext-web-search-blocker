import { describe, expect, it } from 'vitest';
import { compileRules, hostMatches, isPageRule, matchResult, normalizePage, normalizeSite } from './matcher';
import { DEFAULT_SETTINGS, type Settings } from './types';

function settings(patch: Partial<Settings>): Settings {
  return { ...DEFAULT_SETTINGS, ...patch };
}

const facts = (text: string, hosts: string[] = [], urls: string[] = []) => ({ text, hosts, urls });

describe('normalizeSite', () => {
  it('reduces a pasted URL to a bare domain', () => {
    expect(normalizeSite('https://www.Example.com/some/path?q=1')).toBe('example.com');
    expect(normalizeSite('  pinterest.com  ')).toBe('pinterest.com');
    expect(normalizeSite('http://sub.example.co.uk:8080/')).toBe('sub.example.co.uk');
  });
});

describe('hostMatches', () => {
  it('covers subdomains but not lookalike domains', () => {
    expect(hostMatches('news.example.com', 'example.com')).toBe(true);
    expect(hostMatches('www.example.com', 'example.com')).toBe(true);
    expect(hostMatches('example.com', 'example.com')).toBe(true);
    expect(hostMatches('notexample.com', 'example.com')).toBe(false);
    expect(hostMatches('example.com.evil.net', 'example.com')).toBe(false);
  });
});

describe('matchResult', () => {
  it('blocks on a plain keyword regardless of case', () => {
    const rules = compileRules(settings({ keywords: ['Crypto'] }));
    expect(matchResult(facts('the best crypto wallets'), rules)).toEqual({
      blocked: true,
      reason: 'Crypto',
    });
    expect(matchResult(facts('the best wallets'), rules).blocked).toBe(false);
  });

  it('supports /regex/ syntax and survives a malformed one', () => {
    const rules = compileRules(settings({ keywords: ['/\\bnft\\b/', '/(unclosed/'] }));
    expect(matchResult(facts('an nft drop'), rules).blocked).toBe(true);
    expect(matchResult(facts('nfts and giftware'), rules).blocked).toBe(false);
    expect(rules.keywords).toHaveLength(1); // the broken pattern is dropped, not thrown
  });

  it('matches keywords against the URL as well as the text', () => {
    const rules = compileRules(settings({ keywords: ['listicle'] }));
    expect(
      matchResult(facts('ten great things', [], ['https://example.com/listicle/ten']), rules).blocked,
    ).toBe(true);
  });

  it('does not reuse regex lastIndex between calls', () => {
    const rules = compileRules(settings({ keywords: ['/spam/g'] }));
    expect(matchResult(facts('spam one'), rules).blocked).toBe(true);
    expect(matchResult(facts('spam two'), rules).blocked).toBe(true);
  });

  it('matches a * prefix pattern against the whole host', () => {
    const rules = compileRules(settings({ sites: ['porn*'] }));
    expect(matchResult(facts('x', ['pornhub.com']), rules)).toEqual({
      blocked: true,
      reason: 'porn*',
    });
    expect(matchResult(facts('x', ['www.pornhub.com']), rules).blocked).toBe(true);
    expect(matchResult(facts('x', ['popcorn.com']), rules).blocked).toBe(false);
  });

  it('matches * as a suffix and in the middle', () => {
    const rules = compileRules(settings({ sites: ['*hub.com', '*sex*'] }));
    expect(matchResult(facts('x', ['videohub.com']), rules).blocked).toBe(true);
    expect(matchResult(facts('x', ['hub.com.other.net']), rules).blocked).toBe(false);
    expect(matchResult(facts('x', ['mysexysite.org']), rules).blocked).toBe(true);
  });

  it('treats dots literally so * cannot leak across a label', () => {
    const rules = compileRules(settings({ sites: ['news.*'] }));
    expect(matchResult(facts('x', ['news.example.com']), rules).blocked).toBe(true);
    expect(matchResult(facts('x', ['newsexample.com']), rules).blocked).toBe(false);
  });

  it('drops a pattern that would block everything', () => {
    const rules = compileRules(settings({ sites: ['*', '**'] }));
    expect(rules.sites).toHaveLength(0);
    expect(rules.empty).toBe(true);
  });

  it('keeps a wildcard host exactly as typed rather than stripping www.', () => {
    expect(normalizeSite('www.*.example.com')).toBe('www.*.example.com');
    expect(normalizeSite('https://porn*/path')).toBe('porn*');
  });

  it('blocks a site by any link inside the result and reports the rule', () => {
    // A stored path would make this a page-only rule; a bare trailing slash does not.
    const rules = compileRules(settings({ sites: ['https://www.pinterest.com/'] }));
    expect(matchResult(facts('a recipe', ['fr.pinterest.com']), rules)).toEqual({
      blocked: true,
      reason: 'pinterest.com',
    });
  });

  it('is inert with no rules', () => {
    const rules = compileRules(DEFAULT_SETTINGS);
    expect(rules.empty).toBe(true);
    expect(matchResult(facts('anything at all', ['example.com']), rules).blocked).toBe(false);
  });
});

describe('page-scoped site rules', () => {
  const url = (href: string) => new URL(href);

  it('keeps the path only when asked', () => {
    expect(normalizeSite('https://www.youtube.com/@MKBHD/videos')).toBe('youtube.com');
    expect(normalizeSite('https://www.youtube.com/@MKBHD/', true)).toBe('youtube.com/@mkbhd');
    expect(normalizeSite('youtube.com/watch?v=abc#t=1', true)).toBe('youtube.com/watch?v=abc');
    expect(normalizeSite('https://example.com/', true)).toBe('example.com');
  });

  it('sorts entries into sites and sub pages', () => {
    expect(normalizePage('https://www.youtube.com/@mkbhd')).toBe('youtube.com/@mkbhd');
    expect(normalizePage('youtube.com')).toBe('');
    expect(isPageRule('youtube.com/@mkbhd')).toBe(true);
    expect(isPageRule('youtube.com/watch?v=abc')).toBe(true);
    expect(isPageRule('*.youtube.com')).toBe(false);
  });

  it('covers the page and those below it, not the rest of the site', () => {
    const [rule] = compileRules(settings({ sites: ['youtube.com/@mkbhd'] })).sites;
    expect(rule.testUrl(url('https://www.youtube.com/@mkbhd'))).toBe(true);
    expect(rule.testUrl(url('https://www.youtube.com/@MKBHD/videos'))).toBe(true);
    expect(rule.testUrl(url('https://m.youtube.com/@mkbhd'))).toBe(true);
    expect(rule.testUrl(url('https://www.youtube.com/@mkbhdclips'))).toBe(false);
    expect(rule.testUrl(url('https://www.youtube.com/'))).toBe(false);
    expect(rule.test('youtube.com')).toBe(false);
  });

  it('requires the query parameters a rule names', () => {
    const [rule] = compileRules(settings({ sites: ['youtube.com/watch?v=abc'] })).sites;
    expect(rule.testUrl(url('https://www.youtube.com/watch?v=abc&t=10'))).toBe(true);
    expect(rule.testUrl(url('https://www.youtube.com/watch?v=xyz'))).toBe(false);
  });

  it('hides search results that link under the path', () => {
    const rules = compileRules(settings({ sites: ['youtube.com/@mkbhd'] }));
    expect(
      matchResult(facts('mkbhd', ['www.youtube.com'], ['https://www.youtube.com/@mkbhd']), rules)
        .blocked,
    ).toBe(true);
    expect(
      matchResult(facts('other', ['www.youtube.com'], ['https://www.youtube.com/watch?v=1']), rules)
        .blocked,
    ).toBe(false);
  });
});
