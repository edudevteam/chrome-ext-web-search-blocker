import {
  DEFAULT_LANDING_HTML,
  PROVERBS,
  SAMPLE_SITES,
  SITE_TEMPLATE_ID,
  type SitePlaceholder,
} from '../landing';
import { compileRules } from '../matcher';
import { loadSayings, type Saying } from '../sayings';
import { loadSiteImages, normalizeSiteImages, type SiteImages } from '../siteImages';
import { loadSettings } from '../storage';
import { applyTabAppearance } from '../tabIcon';
import type { Settings } from '../types';
import './blocked.css';

const ROTATE_MS = 12_000;
const FADE_MS = 600;

/** Set by the HTML editor, which embeds this page and posts its draft markup. */
const PREVIEW = location.hash === '#preview';

/**
 * The landing page shown instead of a blocked site.
 *
 * It deliberately never names the site that was blocked: being told what you
 * were about to open is the reminder this whole page exists to avoid.
 */
async function render(): Promise<void> {
  const root = document.getElementById('root');
  if (!root) return;

  const settings = await loadSettings().catch(() => null);
  if (settings && !PREVIEW) void applyTabAppearance(settings.tab);
  const html =
    (settings?.redirect.customHtml && settings.redirect.html.trim()) || DEFAULT_LANDING_HTML;

  const loadQuotes = async () => (await loadSayings().catch(() => null))?.sayings ?? PROVERBS;
  // The preview repaints on every edit, so it loads the phrases once up front.
  let sayings: Saying[] | null = PREVIEW ? await loadQuotes() : null;
  let images = await loadSiteImages();

  const paint = async (markup: string) => {
    // Assigning innerHTML on an extension page does not execute <script>, and the
    // page's CSP blocks inline handlers — custom markup is styling only.
    root.innerHTML = markup;

    // newtab.html reuses this page as the browser's home: you chose to come here,
    // so the built-in headings ("Not this way", "Where you can go") don't fit.
    const isHome = document.body.dataset.page === 'home';
    if (isHome) {
      root.querySelector('.wcb-landing > .wcb-eyebrow')?.remove();
    }

    const slot = document.getElementById('wcb-quote');
    if (slot) {
      sayings ??= await loadQuotes();
      startRotation(slot, sayings);
    } else {
      stopRotation();
    }

    renderAllowed(root, settings, images, isHome);
  };

  if (!PREVIEW) {
    await paint(html);
    return;
  }

  // Only the editor, an extension page of the same origin, may drive the preview.
  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin || typeof event.data?.previewHtml !== 'string') return;
    images = normalizeSiteImages(event.data.previewImages);
    void paint(event.data.previewHtml.trim() || DEFAULT_LANDING_HTML);
  });
  window.parent.postMessage({ previewReady: true }, location.origin);
}

/**
 * With the whitelist on, list where you can still go. Fills `#wcb-allowed` when
 * a custom template provides it, otherwise appends below the template.
 */
function renderAllowed(
  root: HTMLElement,
  settings: Settings | null,
  images: SiteImages,
  isHome: boolean,
): void {
  let sites = settings ? allowedSites(settings) : [];
  // The editor's preview always has something for a site layout to show.
  // Your own list comes first, even while the whitelist is switched off.
  if (PREVIEW && sites.length === 0) {
    sites = settings?.whitelist.sites.length ? settings.whitelist.sites : SAMPLE_SITES;
  }
  if (sites.length === 0) return;

  const template = root.querySelector<HTMLTemplateElement>(`template#${SITE_TEMPLATE_ID}`);
  if (template) {
    renderTemplate(template, sites, images);
    return;
  }

  const section =
    document.getElementById('wcb-allowed') ?? root.appendChild(document.createElement('section'));
  section.classList.add('wcb-allowed');
  section.innerHTML = '';

  if (!isHome) {
    const heading = document.createElement('p');
    heading.className = 'wcb-eyebrow';
    heading.textContent = 'Where you can go';
    section.append(heading);
  }

  const grid = document.createElement('ul');
  grid.className = 'wcb-allowed__grid';
  for (const site of sites) grid.append(siteCard(site));

  section.append(grid);
}

function allowedSites(settings: Settings): string[] {
  const { redirect, whitelist } = settings;
  // Custom HTML can list the sites as shortcuts without the whitelist enforcing them.
  const listAnyway = redirect.customHtml && redirect.html.trim() && redirect.showAllowedSites;
  const rules = compileRules(
    listAnyway ? { ...settings, whitelist: { ...whitelist, enabled: true } } : settings,
  );
  if (!rules.whitelist) return [];

  // Hide entries the blocklist would bounce straight back here.
  return rules.whitelist
    .map((rule) => rule.raw)
    .filter((site) => site.includes('*') || !rules.sites.some((rule) => rule.testUrl(siteUrl(site))));
}

/** An allowed entry as an address: `example.com/path` -> https://example.com/path. */
function siteUrl(site: string): URL {
  return new URL(`https://${site}`);
}

/**
 * A custom template owns the layout: it is stamped out once per site, in its own
 * place, with `{{placeholders}}` filled into text and attributes.
 */
function renderTemplate(template: HTMLTemplateElement, sites: string[], images: SiteImages): void {
  const stamps = sites.map((site) => {
    const isPattern = site.includes('*');
    const host = site.replace(/^[*.]+/, '');
    const values: Record<SitePlaceholder, string> = {
      site,
      url: isPattern ? '' : `https://${site}`,
      image: images[site] ?? '',
      initial: (host[0] ?? '*').toUpperCase(),
      favicon: faviconUrl(`https://${host}`),
    };

    const fragment = template.content.cloneNode(true) as DocumentFragment;
    fillPlaceholders(fragment, values);
    for (const element of fragment.querySelectorAll('*')) {
      // A pattern has no single address, so its links go inert rather than nowhere.
      if (element.getAttribute('href') === '') element.removeAttribute('href');
      // A site with no image set: no broken-image icon, and CSS can hide the <img>.
      if (element.getAttribute('src') === '') element.removeAttribute('src');
    }
    for (const element of fragment.children) {
      element.setAttribute('data-site', site);
      if (isPattern) element.setAttribute('data-pattern', '');
      if (!values.image) element.setAttribute('data-no-image', '');
    }
    return fragment;
  });
  template.replaceWith(...stamps);
}

function fillPlaceholders(fragment: DocumentFragment, values: Record<SitePlaceholder, string>): void {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) =>
      key in values ? values[key as SitePlaceholder] : match,
    );

  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Text) {
      node.data = fill(node.data);
    } else if (node instanceof Element) {
      for (const attr of node.attributes) attr.value = fill(attr.value);
    }
  }
}

/** Chrome's local favicon cache: no request leaves the browser. */
function faviconUrl(pageUrl: string): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '64');
  return url.toString();
}

function siteCard(site: string): HTMLLIElement {
  const item = document.createElement('li');
  const isPattern = site.includes('*');

  // A pattern has no single address to open, so it is shown but not linked.
  const card = document.createElement(isPattern ? 'div' : 'a');
  card.className = 'wcb-card';
  if (card instanceof HTMLAnchorElement) card.href = `https://${site}`;

  const mark = document.createElement('span');
  mark.className = 'wcb-card__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = (site.replace(/^[*.]+/, '')[0] ?? '*').toUpperCase();

  const name = document.createElement('span');
  name.className = 'wcb-card__name';
  name.textContent = site;

  card.append(mark, name);
  if (isPattern) {
    const note = document.createElement('span');
    note.className = 'wcb-card__note';
    note.textContent = 'Any matching site';
    card.append(note);
  }

  item.append(card);
  return item;
}

// Kept across repaints so a live preview holds the current phrase while typing.
let order: number[] = [];
let position = 0;
let interval: number | undefined;
let fade: number | undefined;

function stopRotation(): void {
  window.clearInterval(interval);
  window.clearTimeout(fade);
}

function startRotation(slot: HTMLElement, quotes: Saying[]): void {
  stopRotation();
  if (order.length !== quotes.length) {
    order = shuffle([...quotes.keys()]);
    position = 0;
  }

  const paint = () => {
    const quote = quotes[order[position % order.length]];
    slot.innerHTML = '';

    const text = document.createElement('p');
    text.className = 'wcb-quote__text';
    text.textContent = quote.text;
    slot.append(text);

    if (quote.ref) {
      const ref = document.createElement('cite');
      ref.className = 'wcb-quote__ref';
      ref.textContent = quote.ref;
      slot.append(ref);
    }
  };

  paint();
  slot.classList.add('is-visible');

  // Nothing to rotate to.
  if (quotes.length < 2) return;

  interval = window.setInterval(() => {
    slot.classList.remove('is-visible');
    fade = window.setTimeout(() => {
      position += 1;
      paint();
      slot.classList.add('is-visible');
    }, FADE_MS);
  }, ROTATE_MS);
}

function shuffle<T>(items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

void render();
