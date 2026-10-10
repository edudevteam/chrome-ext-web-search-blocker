import type { Saying } from './sayings';

/** King James Version — public domain. Replaced by any sayings you upload. */
export const PROVERBS: Saying[] = [
  {
    text: 'Trust in the LORD with all thine heart; and lean not unto thine own understanding.',
    ref: 'Proverbs 3:5',
  },
  {
    text: 'Keep thy heart with all diligence; for out of it are the issues of life.',
    ref: 'Proverbs 4:23',
  },
  {
    text: 'Can a man take fire in his bosom, and his clothes not be burned?',
    ref: 'Proverbs 6:27',
  },
  {
    text: 'The way of a fool is right in his own eyes: but he that hearkeneth unto counsel is wise.',
    ref: 'Proverbs 12:15',
  },
  {
    text:
      'He that is slow to anger is better than the mighty; and he that ruleth his spirit ' +
      'than he that taketh a city.',
    ref: 'Proverbs 16:32',
  },
  {
    text: 'The name of the LORD is a strong tower: the righteous runneth into it, and is safe.',
    ref: 'Proverbs 18:10',
  },
  {
    text: 'Whoso keepeth his mouth and his tongue keepeth his soul from troubles.',
    ref: 'Proverbs 21:23',
  },
  {
    text:
      'He that hath no rule over his own spirit is like a city that is broken down, ' +
      'and without walls.',
    ref: 'Proverbs 25:28',
  },
];

/**
 * The built-in landing page. Anything with `id="wcb-quote"` is taken over by the
 * page's quote cycler, so a custom template can keep the rotation by including
 * that element — or drop it entirely and stay static.
 */
export const DEFAULT_LANDING_HTML = `<main class="wcb-landing">
  <p class="wcb-eyebrow">Not this way</p>
  <blockquote id="wcb-quote"></blockquote>
</main>`;

/**
 * A `<template>` with this id is repeated once per allowed site, in place of the
 * built-in cards, so custom markup can lay the list out however it likes.
 */
export const SITE_TEMPLATE_ID = 'wcb-site';

/**
 * Stand-ins the editor's preview lists when the allowed list is off or empty,
 * so a site layout can be designed before any sites are allowed. The wildcard
 * shows how a rule with no single address renders.
 */
export const SAMPLE_SITES = ['wikipedia.org', 'khanacademy.org', 'github.com', '*.edu'];

export type SitePlaceholder = 'site' | 'url' | 'image' | 'initial' | 'favicon';

export const SITE_PLACEHOLDERS: { key: SitePlaceholder; hint: string }[] = [
  { key: 'url', hint: 'https:// address to link to (empty for a wildcard rule)' },
  { key: 'site', hint: 'The allowed-list entry as written' },
  { key: 'image', hint: 'The image you set for the site under Site images' },
  { key: 'favicon', hint: 'The site’s icon, from the browser’s own cache' },
  { key: 'initial', hint: 'First letter of the site' },
];

export const LANDING_HELP = `Any element with id="wcb-quote" is filled with a rotating
saying. With the whitelist on, allowed sites are listed in id="wcb-allowed", or
below your markup if it has none. Styles are up to you — inline <style> works.
Scripts do not run.`;
