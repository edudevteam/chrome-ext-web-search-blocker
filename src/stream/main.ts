import { compileRules, type CompiledRules } from '../matcher';
import { redirectTarget } from '../redirect';
import { loadSettings, onSettingsChanged } from '../storage';
import { DEFAULT_SETTINGS, type Settings } from '../types';
import {
  channelAllowed,
  compileStreamRules,
  matchStream,
  readCard,
  readVideoChannel,
  readWatchPage,
  streamSiteFor,
  videoAwaitingChannel,
  type StreamRules,
} from './sites';

const BLOCKED_ATTR = 'data-wcb-stream-blocked';
/** On <html> while the player waits for its channel to be checked against the whitelist. */
const HOLD_ATTR = 'data-wcb-video-pending';
/** What a card held when it was last judged. YouTube reuses cards for new results. */
const KEY_PROP = '__wcbStreamKey';

type Card = HTMLElement & { [KEY_PROP]?: string };

const site = streamSiteFor(location.hostname);

let settings: Settings = DEFAULT_SETTINGS;
let rules: StreamRules = compileStreamRules(DEFAULT_SETTINGS.stream);
/** The site rules, for the whitelist. */
let siteRules: CompiledRules = compileRules(DEFAULT_SETTINGS);
let frame = 0;
let held = false;
/** Whether the hold stopped the player, so releasing it should start it again. */
let resumeOnRelease = false;

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
  style.textContent =
    `[${BLOCKED_ATTR}]{display:none!important}` +
    `[${HOLD_ATTR}] #movie_player{visibility:hidden!important}`;
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
  if (leaveUnlistedChannel()) return;
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

/**
 * Hides and pauses the player while on. YouTube starts playback itself, so a
 * play while held is stopped as it happens (see init).
 */
function hold(on: boolean): void {
  if (held === on) return;
  held = on;
  document.documentElement.toggleAttribute(HOLD_ATTR, on);
  const player = document.querySelectorAll<HTMLVideoElement>('#movie_player video');
  if (on) {
    for (const video of player) {
      if (video.paused) continue;
      video.pause();
      resumeOnRelease = true;
    }
  } else if (resumeOnRelease) {
    resumeOnRelease = false;
    for (const video of player) void video.play().catch(() => undefined);
  }
}

/**
 * The background lets a video through when a channel is whitelisted, since
 * its address does not say whose it is. It plays once the page shows it is a
 * whitelisted channel's; any other goes where a blocked site would. Judged
 * again on every change, so a channel link YouTube has not yet swapped for the
 * new video's cannot keep the wrong video playing.
 */
function leaveUnlistedChannel(): boolean {
  const url = new URL(location.href);
  if (!site || !settings.enabled || !videoAwaitingChannel(url, siteRules)) {
    hold(false);
    return false;
  }
  hold(true);
  const channel = readVideoChannel(document, url, site);
  if (channel === null) return false; // not loaded yet
  if (channelAllowed(channel, site, siteRules)) {
    hold(false);
    return false;
  }
  location.replace(redirectTarget(settings, siteRules) ?? site.home);
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
  // Media events do not bubble, so this listens in the capture phase.
  document.addEventListener(
    'play',
    (event) => {
      if (!held || !(event.target instanceof HTMLVideoElement)) return;
      if (!event.target.closest('#movie_player')) return;
      event.target.pause();
      resumeOnRelease = true;
    },
    true,
  );

  settings = await loadSettings();
  rules = compileStreamRules(settings.stream);
  siteRules = compileRules(settings);

  onSettingsChanged((next) => {
    settings = next;
    rules = compileStreamRules(next.stream);
    siteRules = compileRules(next);
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
