import type { Saying } from './sayings';

/**
 * English Standard Version. Replaced by any sayings you upload.
 *
 * Crossway permits quoting up to 500 verses without written permission, provided
 * the ESV is credited — hence "(ESV)" on every reference and the full copyright
 * notice in the README.
 */
export const PROVERBS: Saying[] = [
  {
    text: 'Keep your heart with all vigilance, for from it flow the springs of life.',
    ref: 'Proverbs 4:23 (ESV)',
  },
  {
    text: 'Can a man carry fire next to his chest and his clothes not be burned?',
    ref: 'Proverbs 6:27 (ESV)',
  },
  {
    text: 'The way of a fool is right in his own eyes, but a wise man listens to advice.',
    ref: 'Proverbs 12:15 (ESV)',
  },
  {
    text:
      'Whoever is slow to anger is better than the mighty, and he who rules his spirit ' +
      'than he who takes a city.',
    ref: 'Proverbs 16:32 (ESV)',
  },
  {
    text: 'Whoever keeps his mouth and his tongue keeps himself out of trouble.',
    ref: 'Proverbs 21:23 (ESV)',
  },
  {
    text: 'A man without self-control is like a city broken into and left without walls.',
    ref: 'Proverbs 25:28 (ESV)',
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
