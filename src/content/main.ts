import { engineFor, type Engine } from '../engines';
import { compileRules, matchResult, type CompiledRules } from '../matcher';
import { loadSettings, onSettingsChanged } from '../storage';
import { DEFAULT_SETTINGS, type Message, type PageStats, type SearchType, type Settings } from '../types';
import {
  collectCandidates,
  extractFacts,
  findOverlayThumbnails,
  findRoot,
  findTile,
  imageFacts,
  looksLikeContainer,
  sourceKeys,
} from './collect';
import { CONTENT_CSS } from './styles';

const BLOCKED_ATTR = 'data-wcb-blocked';
const BLANKED_ATTR = 'data-wcb-blanked';
const GATE_CLASS = 'wcb-gate';
/** Longest the results area is ever held back waiting for a first scan. */
const GATE_MAX_MS = 1500;
/** 1x1 white GIF. */
const BLANK_SRC =
  'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

interface BlankedImage {
  src: string | null;
  srcset: string | null;
  style: string | null;
}

/**
 * Originals for blanked images, held in JS rather than in data attributes so the
 * source URL is not left sitting in the markup. Only read when rules change or
 * the blocker is switched off — never to reveal an image in place.
 */
const blanked = new Map<HTMLImageElement, BlankedImage>();

let settings: Settings = DEFAULT_SETTINGS;
let rules: CompiledRules = compileRules(DEFAULT_SETTINGS);
let engine: Engine | null = engineFor(new URL(location.href));
let searchType: SearchType | null = engine?.detect(new URL(location.href)) ?? null;
let currentHref = location.href;
let blockedCount = 0;
let scheduled = 0;
let applying = false;

/**
 * Image sources belonging to results we have already blocked.
 *
 * Brave's preview filmstrip repeats the grid's thumbnails as bare <img> tags
 * with no caption or link to match against, so the only thing tying them back
 * to a blocked result is the image itself.
 */
const blockedSources = new Set<string>();

function isActive(): boolean {
  return (
    engine !== null &&
    searchType !== null &&
    settings.enabled &&
    settings.types[searchType] &&
    !rules.empty
  );
}

function injectStyles(): void {
  if (document.getElementById('wcb-style')) return;
  const style = document.createElement('style');
  style.id = 'wcb-style';
  const gateRule = engine
    ? `${engine.gate.map((sel) => `html.${GATE_CLASS} ${sel}`).join(',')}{visibility:hidden!important}`
    : '';
  style.textContent = CONTENT_CSS + gateRule;
  (document.head ?? document.documentElement).appendChild(style);
}

/**
 * Holds the results area back until the first scan has run, so a blocked result
 * is never painted and then yanked away. Released by the first completed pass,
 * or by a failsafe timer if anything goes wrong — the page must never be left
 * hidden because of this.
 */
function gate(): void {
  if (!engine || !searchType) return;
  document.documentElement.classList.add(GATE_CLASS);
  window.setTimeout(ungate, GATE_MAX_MS);
}

function ungate(): void {
  document.documentElement.classList.remove(GATE_CLASS);
}

/**
 * A blocked result is hidden outright and left with no marker, no stub and no
 * way to reveal it from the page. The attribute is what we hide on, and the
 * reason it carries is only there for debugging via `__wcb`.
 */
function hide(el: HTMLElement, reason: string): void {
  el.setAttribute(BLOCKED_ATTR, reason || '1');
}

function block(el: HTMLElement, reason: string): void {
  hide(el, reason);
  blockedCount += 1;
  // Remember the pictures this result used, so the same ones are recognised
  // wherever the page shows them again.
  for (const img of el.querySelectorAll('img')) {
    for (const key of sourceKeys(img)) blockedSources.add(key);
  }
}

function isKnownBlockedImage(img: HTMLImageElement): boolean {
  return sourceKeys(img).some((key) => blockedSources.has(key));
}

/**
 * Replaces an image with a white block of the same size. Used only when a
 * matching image could not be removed as part of a tile — the pixels are
 * dropped at the source, so there is nothing left in the page to reveal.
 */
function blankImage(img: HTMLImageElement, reason: string): void {
  if (!blanked.has(img)) {
    for (const key of sourceKeys(img)) blockedSources.add(key);
    const rect = img.getBoundingClientRect();
    blanked.set(img, {
      src: img.getAttribute('src'),
      srcset: img.getAttribute('srcset'),
      style: img.getAttribute('style'),
    });
    // Freeze the footprint so the grid does not reflow around a 1x1 image.
    if (rect.width > 1) img.style.setProperty('width', `${Math.round(rect.width)}px`, 'important');
    if (rect.height > 1) img.style.setProperty('height', `${Math.round(rect.height)}px`, 'important');
    blockedCount += 1;
  }
  img.setAttribute(BLANKED_ATTR, reason || '1');
  img.removeAttribute('srcset');
  img.setAttribute('src', BLANK_SRC);
}

/**
 * Removes the preview filmstrip outright.
 *
 * Its thumbnails are bare images with no caption and no link, so one that does
 * not repeat an image we already blocked cannot be identified at all. Since the
 * strip only exists to offer more pictures, dropping it is the one way to be
 * sure nothing blocked appears there.
 */
function hidePreviewStrip(): void {
  if (!settings.hidePreviewStrip || !engine) return;

  // Brave uses the same component for the grid and the preview's suggestions,
  // so this is scoped to thumbnails outside the results container. Anything in
  // the grid is a real result and stays exactly as it is — visible, clickable,
  // and only ever removed by an actual rule match.
  const thumbnails = findOverlayThumbnails(engine.previewStrip, engine.gate);
  if (thumbnails.length === 0) return;

  const strip = thumbnails[0].parentElement;
  // Collapse the container only when it holds the thumbnails and little else.
  // One spare child is allowed for a heading or a scroll button; beyond that
  // this is the preview itself, which must not disappear.
  const spare = strip
    ? [...strip.children].filter((child) => !thumbnails.includes(child as HTMLElement)).length
    : Infinity;

  // `hide`, not `block`: a surface, not a result, so it is not counted.
  if (strip && spare <= 1) {
    if (!strip.hasAttribute(BLOCKED_ATTR)) hide(strip, 'recommended images');
    return;
  }
  for (const thumbnail of thumbnails) {
    if (!thumbnail.hasAttribute(BLOCKED_ATTR)) hide(thumbnail, 'recommended images');
  }
}

/**
 * Second pass over image tabs, for tiles the selectors did not recognise.
 *
 * A matching image is not hidden on its own — that would leave its caption and
 * source link sitting in the grid. We climb to the element holding the whole
 * tile and remove that, falling back to blanking the image only when no tile
 * can be isolated. Lazy-loading engines re-point `src` on nodes we already
 * handled, so blanked images are re-checked rather than skipped.
 */
function sweepImages(root: Element): void {
  for (const img of root.querySelectorAll('img')) {
    if (img.closest(`[${BLOCKED_ATTR}]`)) continue; // the whole tile is already gone
    if (blanked.has(img)) {
      if (img.getAttribute('src') !== BLANK_SRC) blankImage(img, img.getAttribute(BLANKED_ATTR) ?? '');
      continue;
    }

    // Either this image matches on its own, or it is one we have already
    // blocked elsewhere on the page and is simply being shown again.
    const known = isKnownBlockedImage(img);
    const { blocked, reason } = known
      ? { blocked: true, reason: 'repeat of a blocked image' }
      : matchResult(imageFacts(img), rules);
    if (!blocked) continue;

    const tile = findTile(img, root);
    if (tile !== img) block(tile, reason);
    else blankImage(img, reason);
  }
}

/** Only used when the rules change or the blocker is switched off. */
function restoreAll(): void {
  for (const el of document.querySelectorAll<HTMLElement>(`[${BLOCKED_ATTR}]`)) {
    el.removeAttribute(BLOCKED_ATTR);
  }
  for (const [img, original] of blanked) {
    img.removeAttribute(BLANKED_ATTR);
    if (original.src === null) img.removeAttribute('src');
    else img.setAttribute('src', original.src);
    if (original.srcset !== null) img.setAttribute('srcset', original.srcset);
    if (original.style === null) img.removeAttribute('style');
    else img.setAttribute('style', original.style);
  }
  blanked.clear();
  blockedSources.clear();
  blockedCount = 0;
}

function apply(): void {
  if (!engine || !searchType) {
    ungate();
    return;
  }

  if (!isActive()) {
    if (blockedCount > 0) restoreAll();
    ungate(); // nothing to filter — never hold results back
    report();
    return;
  }

  const root = findRoot(engine.roots);
  if (!root) return; // results have not rendered yet; stay gated until they do

  // The image preview mounts its filmstrip outside the results container, so
  // for those tabs the whole document is in scope.
  const scanRoot = engine.scanWholePage.includes(searchType)
    ? (document.body ?? root)
    : root;

  applying = true;
  const candidates = collectCandidates(scanRoot, engine.selectors[searchType]);
  try {
    for (const el of candidates) {
      if (el.hasAttribute(BLOCKED_ATTR)) continue;
      const facts = extractFacts(el);
      if (looksLikeContainer(facts)) continue;
      const { blocked, reason } = matchResult(facts, rules);
      if (blocked) block(el, reason);
    }

    if (searchType === 'images') {
      hidePreviewStrip();
      sweepImages(scanRoot);
    }
  } finally {
    applying = false;
  }

  // Keep holding while the results container exists but is still empty —
  // Brave renders its grid after hydration. The failsafe releases regardless.
  if (candidates.length > 0) ungate();
  report();
}

function report(): void {
  try {
    const message: Message = { type: 'wcb:count', count: blockedCount };
    void chrome.runtime.sendMessage(message).catch(() => undefined);
  } catch {
    /* extension was reloaded — the next page load reconnects */
  }
}

function schedule(delay = 80): void {
  if (scheduled) return;
  scheduled = window.setTimeout(() => {
    scheduled = 0;
    if (location.href !== currentHref) onNavigate();
    apply();
  }, delay);
}

function onNavigate(): void {
  currentHref = location.href;
  const url = new URL(currentHref);
  engine = engineFor(url);
  searchType = engine?.detect(url) ?? null;
  restoreAll();
  // A tab switch re-renders the whole grid: hold it back for the fresh scan.
  if (isActive()) gate();
}

function watchDom(): void {
  const observer = new MutationObserver(() => {
    if (applying) return; // blanking an image writes src; do not chase our own edits
    schedule();
  });
  // `src` is observed because lazy grids assign it to nodes that already exist,
  // which produces no childList record at all — the single biggest reason a
  // thumbnail could survive a scan that ran a moment too early.
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  });

  // Image grids lazy-load by re-pointing `src` on nodes that already exist,
  // which produces no childList record — so sweep again as things scroll.
  // Captured, because scroll does not bubble: the preview filmstrip scrolls
  // inside its own container and would otherwise never reach us.
  const onScroll = () => schedule(250);
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
  window.addEventListener('resize', onScroll, { passive: true });
}

function watchNavigation(): void {
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method];
    history[method] = function patched(this: History, ...args: Parameters<History['pushState']>) {
      const result = original.apply(this, args);
      schedule();
      return result;
    };
  }
  window.addEventListener('popstate', () => schedule());
  window.addEventListener('pageshow', () => schedule());
}

function answerStatsRequests(): void {
  chrome.runtime.onMessage.addListener((message: Message, _sender, sendResponse) => {
    if (message?.type !== 'wcb:get-stats') return undefined;
    if (!engine || !searchType) {
      sendResponse(null);
      return undefined;
    }
    const stats: PageStats = {
      engine: engine.id,
      searchType,
      blocked: blockedCount,
      activeForThisType: isActive(),
    };
    sendResponse({ type: 'wcb:stats', stats } satisfies Message);
    return undefined;
  });
}

/**
 * Handle for tuning selectors live in developer mode: open DevTools on a
 * results page and switch the console context to "Web Content Blocker".
 *   __wcb.state         — what the blocker thinks this page is
 *   __wcb.candidates()  — every element it considers a single result
 *   __wcb.rescan()      — re-evaluate the page from scratch
 */
function exposeDebugHandle(): void {
  Object.defineProperty(window, '__wcb', {
    configurable: true,
    value: {
      get state() {
        return {
          engine: engine?.id ?? null,
          searchType,
          active: isActive(),
          blocked: blockedCount,
          keywords: rules.keywords.map((rule) => rule.raw),
          sites: rules.sites.map((rule) => rule.raw),
        };
      },
      candidates() {
        if (!engine || !searchType) return [];
        const root = findRoot(engine.roots);
        if (!root) return [];
        return collectCandidates(root, engine.selectors[searchType]).map((el) => ({
          el,
          facts: extractFacts(el),
          container: looksLikeContainer(extractFacts(el)),
        }));
      },
      rescan() {
        restoreAll();
        apply();
        return blockedCount;
      },
    },
  });
}

async function init(): Promise<void> {
  injectStyles();
  answerStatsRequests();
  exposeDebugHandle();
  // Before the first await: nothing should be painted ahead of the first scan.
  gate();

  settings = await loadSettings();
  rules = compileRules(settings);

  onSettingsChanged((next) => {
    settings = next;
    rules = compileRules(next);
    restoreAll(); // rules changed: re-evaluate everything from scratch
    apply();
  });

  watchDom();
  watchNavigation();
  apply();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => schedule());
  }
  window.addEventListener('load', () => schedule());
}

void init();
