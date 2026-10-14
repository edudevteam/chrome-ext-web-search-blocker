import { describe, expect, it } from 'vitest';
import {
  isImageUrl,
  MAX_IMAGE_URL,
  MAX_SITE_LABEL,
  normalizeSiteImages,
  normalizeSiteLabels,
} from './siteImages';

describe('isImageUrl', () => {
  it('accepts http and https addresses', () => {
    expect(isImageUrl('https://example.com/logo.png')).toBe(true);
    expect(isImageUrl('http://example.com/logo.png')).toBe(true);
  });

  it('rejects other schemes, bare text and overlong addresses', () => {
    expect(isImageUrl('javascript:alert(1)')).toBe(false);
    expect(isImageUrl('data:image/png;base64,AAAA')).toBe(false);
    expect(isImageUrl('example.com/logo.png')).toBe(false);
    expect(isImageUrl(`https://example.com/${'a'.repeat(MAX_IMAGE_URL)}`)).toBe(false);
  });
});

describe('normalizeSiteImages', () => {
  it('keeps valid entries, trimmed, and drops the rest', () => {
    expect(
      normalizeSiteImages({
        'github.com': '  https://example.com/gh.png ',
        'khanacademy.org': 'not a url',
        'wikipedia.org': 42,
      }),
    ).toEqual({ 'github.com': 'https://example.com/gh.png' });
  });

  it('treats anything that is not an object as empty', () => {
    expect(normalizeSiteImages(undefined)).toEqual({});
    expect(normalizeSiteImages('https://example.com')).toEqual({});
  });
});

describe('normalizeSiteLabels', () => {
  it('keeps non-empty text, trimmed and capped, and drops the rest', () => {
    expect(
      normalizeSiteLabels({
        'youtube.com/@a': '  @a ',
        'youtube.com/@b': '   ',
        'youtube.com/@c': 7,
        'youtube.com/@d': 'x'.repeat(MAX_SITE_LABEL + 5),
      }),
    ).toEqual({ 'youtube.com/@a': '@a', 'youtube.com/@d': 'x'.repeat(MAX_SITE_LABEL) });
  });

  it('treats anything that is not an object as empty', () => {
    expect(normalizeSiteLabels(null)).toEqual({});
  });
});
