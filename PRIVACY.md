# Privacy Policy — Web Content Blocker

_Last updated: October 6, 2026_

Web Content Blocker does not collect, transmit, sell or share any personal data.
It has no servers, no analytics, no tracking and no advertising. Everything the
extension does happens inside your browser.

## What the extension stores

All data is kept in your browser's built-in extension storage and never leaves
your device through the extension.

| Data | Where it is stored | Why |
| --- | --- | --- |
| Your blocked keywords, blocked sites, allowed sites, redirect choice and on/off switches | `chrome.storage.sync` | So your rules persist. If you have turned on browser sync, your browser (not this extension) may sync these settings between your own devices through your browser account. |
| Optional password | `chrome.storage.local` | Stored only as a salted PBKDF2-SHA-256 hash. The password itself is never saved. |
| Temporary "unlocked" status | `chrome.storage.session` | Cleared automatically when the browser closes. |
| Custom sayings and custom tab icon you upload | `chrome.storage.local` | Shown on the blocked page and the new tab page. |

## Web pages and browsing activity

- On Google and Brave Search result pages, the extension reads the results on the
  page to hide any that match your rules. Those results are not stored or sent
  anywhere.
- When you open a page, the extension checks its address against your block list
  so it can redirect blocked sites. Addresses are compared in memory and are not
  logged, stored or sent anywhere.
- If you turn on password protection, the extension checks whether a tab is
  showing the browser's extensions page, so it can ask for your password there.

## Third parties

The extension does not send data to the developer or to any third party, and it
does not load any code from remote sources.

## Removing your data

Uninstalling the extension deletes all of its stored data. You can also clear
your rules, password, sayings and tab icon at any time from the extension's
settings page.

## Changes

Any changes to this policy will be posted in this file, with the date above
updated.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/drjonesy/chrome-ext-web-search-blocker/issues>.
