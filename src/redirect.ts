import { engineFor } from './engines';
import type { CompiledRules } from './matcher';
import type { Settings } from './types';

export const LANDING_PAGE = 'blocked.html';

/**
 * Whether navigating to this URL should be intercepted.
 *
 * Search engines are never redirected: a rule like `google.com` is meant to
 * strip results, and hijacking the search page itself would take the blocker
 * out with it.
 */
export function shouldRedirect(url: URL, rules: CompiledRules): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  if (engineFor(url)) return false;
  const host = url.hostname.toLowerCase();
  return rules.sites.some((rule) => rule.test(host));
}

/**
 * Where to send a blocked navigation, or null to leave it alone. Falls back to
 * the landing page when the configured URL is itself blocked, which would
 * otherwise bounce the tab between two blocked addresses forever.
 */
export function redirectTarget(settings: Settings, rules: CompiledRules): string | null {
  const { mode, url } = settings.redirect;
  if (mode === 'off') return null;

  const landing = chrome.runtime.getURL(LANDING_PAGE);
  if (mode === 'landing') return landing;

  const trimmed = url.trim();
  if (!trimmed) return landing;

  let target: URL;
  try {
    target = new URL(/^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return landing;
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') return landing;
  if (shouldRedirect(target, rules)) return landing;

  return target.href;
}
