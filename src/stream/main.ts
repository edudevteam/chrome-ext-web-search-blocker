import { loadSettings, onSettingsChanged } from '../storage';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import {
  compileStreamRules,
  matchStream,
  readCard,
  readWatchPage,
  streamSiteFor,
  type StreamRules,
} from './sites';

const BLOCKED_ATTR = 'data-wcb-stream-blocked';
/** What a card held when it was last judged. YouTube reuses cards for new results. */
const KEY_PROP = '__wcbStreamKey';

type Card = HTMLElement & { [KEY_PROP]?: string };

const site = streamSiteFor(location.hostname);

let settings: Settings = DEFAULT_SETTINGS;
let rules: StreamRules = compileStreamRules(DEFAULT_SETTINGS.stream);
let frame = 0;

function isActive(): boolean {
  return site !== null && settings.enabled && settings.stream.enabled && !rules.empty;
}

/**
 * A stylesheet rule rather than inline styles, which YouTube resets when it
 * re-renders a card. Cards are hidden, never removed: YouTube recycles them for
 * later results, and a removed one leaves gaps or stops infinite scroll.
 */
function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `[${BLOCKED_ATTR}]{display:none!important}`;
  (document.head ?? document.documentElement).appendChild(style);
}

function judge(card: Card): void {
  if (!site) return;
  const { channel, title, description } = readCard(card, site);
  const key = `${channel}\u0000${title}\u0000${description}`;
  if (card[KEY_PROP] === key) return;
  card[KEY_PROP] = key;

  const reason = matchStream(channel, title, description, rules);
  if (reason) card.setAttribute(BLOCKED_ATTR, reason);
  else card.removeAttribute(BLOCKED_ATTR);
}

function scan(): void {
  frame = 0;
  if (!site || !isActive()) return;
  if (leaveBlockedVideo()) return;
  for (const card of document.querySelectorAll<Card>(site.cards)) {
    // A lockup inside a rich item is the same result; judge the outer one.
    if (card.parentElement?.closest(site.cards)) continue;
    judge(card);
  }
}

/**
 * A video whose own title, description or channel matches is not watched at
 * all: playback stops and the tab goes to the site's home page. `replace`, so
 * Back does not return to it.
 */
function leaveBlockedVideo(): boolean {
  if (!site) return false;
  const details = readWatchPage(document, new URL(location.href), site);
  if (!details) return false;
  if (!matchStream(details.channel, details.title, details.description, rules)) return false;
  for (const video of document.querySelectorAll('video')) video.pause();
  location.replace(site.home);
  return true;
}

/** Only used when the rules change or the filter is switched off. */
function restoreAll(): void {
  for (const card of document.querySelectorAll<Card>(`[${BLOCKED_ATTR}]`)) {
    card.removeAttribute(BLOCKED_ATTR);
  }
  if (!site) return;
  for (const card of document.querySelectorAll<Card>(site.cards)) delete card[KEY_PROP];
}

/** Batches a burst of mutations into one scan, before the next paint. */
function schedule(): void {
  if (!frame) frame = requestAnimationFrame(scan);
}

async function init(): Promise<void> {
  if (!site) return;
  injectStyles();

  settings = await loadSettings();
  rules = compileStreamRules(settings.stream);

  onSettingsChanged((next) => {
    settings = next;
    rules = compileStreamRules(next.stream);
    restoreAll(); // rules changed: re-evaluate everything from scratch
    schedule();
  });

  // characterData: YouTube swaps a recycled card's text in place.
  new MutationObserver(schedule).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
  window.addEventListener('yt-navigate-finish', schedule);
  schedule();
}

void init();
