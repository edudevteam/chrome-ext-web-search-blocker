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
  if (!settings.enabled || settings.redirect.mode === 'off') return;

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
