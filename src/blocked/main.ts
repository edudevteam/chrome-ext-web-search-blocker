import { DEFAULT_LANDING_HTML, PROVERBS } from '../landing';
import { loadSettings } from '../storage';
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
  const html = settings?.redirect.html?.trim() || DEFAULT_LANDING_HTML;

  // Assigning innerHTML on an extension page does not execute <script>, and the
  // page's CSP blocks inline handlers — custom markup is styling only.
  root.innerHTML = html;

  const slot = document.getElementById('wcb-quote');
  if (slot) startRotation(slot);
}

function startRotation(slot: HTMLElement): void {
  const order = shuffle([...PROVERBS.keys()]);
  let position = 0;

  const paint = () => {
    const quote = PROVERBS[order[position % order.length]];
    slot.innerHTML = '';

    const text = document.createElement('p');
    text.className = 'wcb-quote__text';
    text.textContent = quote.text;

    const ref = document.createElement('cite');
    ref.className = 'wcb-quote__ref';
    ref.textContent = quote.ref;

    slot.append(text, ref);
  };

  paint();
  slot.classList.add('is-visible');

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
