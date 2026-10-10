import { DEFAULT_LANDING_HTML, PROVERBS } from '../landing';
import { compileRules } from '../matcher';
import { loadSayings, type Saying } from '../sayings';
import { loadSettings } from '../storage';
import { applyTabAppearance } from '../tabIcon';
import type { Settings } from '../types';
import './blocked.css';

const ROTATE_MS = 12_000;
const FADE_MS = 600;

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
  if (settings) void applyTabAppearance(settings.tab);
  const html =
    (settings?.redirect.customHtml && settings.redirect.html.trim()) || DEFAULT_LANDING_HTML;

  // Assigning innerHTML on an extension page does not execute <script>, and the
  // page's CSP blocks inline handlers — custom markup is styling only.
  root.innerHTML = html;

  // newtab.html reuses this page as the browser's home: you chose to come here,
  // so the built-in headings ("Not this way", "Where you can go") don't fit.
  const isHome = document.body.dataset.page === 'home';
  if (isHome) {
    root.querySelector('.wcb-landing > .wcb-eyebrow')?.remove();
  }

  const slot = document.getElementById('wcb-quote');
  if (slot) {
    const custom = await loadSayings().catch(() => null);
    startRotation(slot, custom?.sayings ?? PROVERBS);
  }

  if (settings) renderAllowed(root, settings, isHome);
}

/**
 * With the whitelist on, list where you can still go. Fills `#wcb-allowed` when
 * a custom template provides it, otherwise appends below the template.
 */
function renderAllowed(root: HTMLElement, settings: Settings, isHome: boolean): void {
  const rules = compileRules(settings);
  if (!rules.whitelist) return;

  // Hide entries the blocklist would bounce straight back here.
  const sites = rules.whitelist
    .map((rule) => rule.raw)
    .filter((site) => site.includes('*') || !rules.sites.some((rule) => rule.test(site)));
  if (sites.length === 0) return;

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

function startRotation(slot: HTMLElement, quotes: Saying[]): void {
  const order = shuffle([...quotes.keys()]);
  let position = 0;

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

  window.setInterval(() => {
    slot.classList.remove('is-visible');
    window.setTimeout(() => {
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
