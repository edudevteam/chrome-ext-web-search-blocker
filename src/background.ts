import { isExtensionsPage, isUnlocked, loadLock, onLockChanged } from './lock';
import { compileRules, type CompiledRules } from './matcher';
import { redirectTarget, shouldRedirect } from './redirect';
import { loadSettings, onSettingsChanged, saveSettings } from './storage';
import { DEFAULT_SETTINGS, type Message, type Settings } from './types';

const BADGE_COLOR = '#ef4444';

let settings: Settings = DEFAULT_SETTINGS;
let rules: CompiledRules = compileRules(DEFAULT_SETTINGS);
let ready: Promise<void> | null = null;

/**
 * The service worker is torn down when idle, so the first navigation after a
 * wake-up has to wait on storage. Every later one is answered from memory.
 */
function whenReady(): Promise<void> {
  ready ??= loadSettings().then((loaded) => {
    settings = loaded;
    rules = compileRules(loaded);
  });
  return ready;
}

onSettingsChanged((next) => {
  settings = next;
  rules = compileRules(next);
  ready = Promise.resolve();
});

chrome.runtime.onInstalled.addListener(() => {
  // Materialise the defaults so the pages and content script agree from day one.
  void loadSettings().then(saveSettings);
});

// ---------------------------------------------------------------- badge counts

chrome.runtime.onMessage.addListener((message: Message, sender) => {
  const tabId = sender.tab?.id;
  if (message?.type !== 'wcb:count' || tabId === undefined) return undefined;

  const text = message.count > 0 ? String(Math.min(message.count, 999)) : '';
  void chrome.action.setBadgeText({ tabId, text }).catch(() => undefined);
  void chrome.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }).catch(() => undefined);
  return undefined;
});

// A fresh navigation starts from zero until the content script reports again.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    void chrome.action.setBadgeText({ tabId, text: '' }).catch(() => undefined);
  }
});

// ------------------------------------------------------------------- redirects

/** The fields both onBeforeNavigate and onCommitted carry. */
interface NavigationDetails {
  tabId: number;
  frameId: number;
  url: string;
}

async function handleNavigation(details: NavigationDetails) {
  if (details.frameId !== 0) return; // top-level navigations only
  await whenReady();
  if (!settings.enabled) return;
  if (settings.redirect.mode === 'off' && !rules.whitelist) return;

  let url: URL;
  try {
    url = new URL(details.url);
  } catch {
    return;
  }
  if (!shouldRedirect(url, rules)) return;

  const target = redirectTarget(settings, rules);
  if (!target) return;

  try {
    await chrome.tabs.update(details.tabId, { url: target });
  } catch {
    /* tab closed mid-navigation */
  }
}

chrome.webNavigation.onBeforeNavigate.addListener((details) => void handleNavigation(details));
// Server-side redirects can land on a blocked host without a fresh navigation.
chrome.webNavigation.onCommitted.addListener((details) => void handleNavigation(details));

// ------------------------------------------------------- extensions-page guard

/**
 * While the password is set, the guard is on and nobody has unlocked recently,
 * a tab showing chrome://extensions is sent to the password prompt instead.
 * webNavigation never fires for chrome:// pages, so this watches tab URLs.
 */
async function guardTab(tabId: number, url: string | undefined) {
  if (!url || !isExtensionsPage(url)) return;
  const lock = await loadLock();
  if (!lock?.guardExtensions || (await isUnlocked())) return;
  const prompt = chrome.runtime.getURL(`options.html#return=${encodeURIComponent(url)}`);
  try {
    await chrome.tabs.update(tabId, { url: prompt });
  } catch {
    /* tab closed */
  }
}

async function guardOpenTabs() {
  for (const tab of await chrome.tabs.query({})) {
    if (tab.id !== undefined) void guardTab(tab.id, tab.url);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => void guardTab(tabId, changeInfo.url));
// Catches extensions pages already open when the guard goes on or "Lock now" is pressed.
onLockChanged(() => void guardOpenTabs());
chrome.runtime.onStartup.addListener(() => void guardOpenTabs());
