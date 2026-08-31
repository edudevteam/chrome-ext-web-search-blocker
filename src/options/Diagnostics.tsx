import { useCallback, useEffect, useState } from 'react';
import { engineFor, ENGINES } from '../engines';
import { SEARCH_TYPE_LABELS, type Message, type PageStats } from '../types';

type Access = 'checking' | 'allowed' | 'blocked' | 'unknown';

interface TabReport {
  id: number;
  label: string;
  incognito: boolean;
  reachable: boolean;
  stats: PageStats | null;
}

const DETAILS_URL = `chrome://extensions/?id=${chrome.runtime.id}`;

/**
 * Reports every open tab the blocker should be running on. A tab that is
 * supported but unreachable has no content script in it — normally because it
 * was open before the extension was loaded or last rebuilt.
 */
async function probeTabs(): Promise<TabReport[]> {
  const tabs = await chrome.tabs.query({});
  const reports: TabReport[] = [];

  for (const tab of tabs) {
    // `url` is only populated for tabs we hold host permissions for.
    if (tab.id === undefined || !tab.url) continue;
    let url: URL;
    try {
      url = new URL(tab.url);
    } catch {
      continue;
    }
    if (!engineFor(url)) continue;

    let reachable = false;
    let stats: PageStats | null = null;
    try {
      const request: Message = { type: 'wcb:get-stats' };
      const response = (await chrome.tabs.sendMessage(tab.id, request)) as Message | null;
      reachable = true;
      if (response?.type === 'wcb:stats') stats = response.stats;
    } catch {
      reachable = false;
    }

    reports.push({
      id: tab.id,
      label: `${url.host}${url.pathname}${url.search.slice(0, 40)}`,
      incognito: tab.incognito,
      reachable,
      stats,
    });
  }
  return reports;
}

export function Diagnostics() {
  const [access, setAccess] = useState<Access>('checking');
  const [tabs, setTabs] = useState<TabReport[] | null>(null);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    chrome.extension
      .isAllowedIncognitoAccess()
      .then((allowed) => setAccess(allowed ? 'allowed' : 'blocked'))
      .catch(() => setAccess('unknown'));
  }, []);

  const scan = useCallback(() => {
    setScanning(true);
    void probeTabs()
      .then(setTabs)
      .finally(() => setScanning(false));
  }, []);

  useEffect(scan, [scan]);

  const matches = chrome.runtime.getManifest().content_scripts?.[0]?.matches ?? [];

  return (
    <section className="section card">
      <header className="section__head">
        <h2>Diagnostics</h2>
      </header>

      <div className={`check check--${access}`}>
        <div className="check__row">
          <span className="check__icon" aria-hidden="true">
            {access === 'allowed' ? '✓' : access === 'checking' ? '…' : '✕'}
          </span>
          <div>
            <strong>Private windows</strong>
            <p>
              {access === 'allowed'
                ? 'Allowed. Blocking runs in private windows too — reload any private tab that was already open.'
                : access === 'checking'
                  ? 'Checking…'
                  : access === 'unknown'
                    ? 'Could not determine. Check the extension details page.'
                    : 'Not allowed. Chrome and Brave keep extensions out of private windows until you opt in, so nothing is blocked there.'}
            </p>
            {access === 'blocked' || access === 'unknown' ? (
              <p className="check__how">
                Open the details page below, then turn on <strong>Allow in Incognito</strong>{' '}
                (Brave calls it <strong>Allow in Private</strong>) and open a fresh private
                window. In Brave, <em>Private window with Tor</em> is a separate mode with the
                same switch.
              </p>
            ) : null}
          </div>
        </div>
        <button type="button" onClick={() => void chrome.tabs.create({ url: DETAILS_URL })}>
          Open extension details
        </button>
        <p className="check__url">
          If that does not open, paste <code>{DETAILS_URL}</code> into the address bar.
        </p>
      </div>

      <div className="field">
        <strong>Runs on</strong>
        <ul className="plain">
          {matches.map((pattern) => (
            <li key={pattern}>
              <code>{pattern}</code>
            </li>
          ))}
        </ul>
        <p className="section__hint">
          {ENGINES.map((engine) => engine.label).join(' and ')}. Other domains, including
          country-specific Google sites, need adding to the manifest.
        </p>
      </div>

      <div className="field">
        <div className="field__head">
          <strong>Search tabs open now</strong>
          <button type="button" className="link" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Rescan'}
          </button>
        </div>

        {tabs === null ? (
          <p className="section__hint">Scanning…</p>
        ) : tabs.length === 0 ? (
          <p className="section__hint">
            No supported search tabs are open. Open one — in a private window too, if you are
            testing that — then rescan.
          </p>
        ) : (
          <ul className="tabs">
            {tabs.map((tab) => (
              <li key={tab.id} className={tab.reachable ? '' : 'tabs__row--dead'}>
                <span className="tabs__url" title={tab.label}>
                  {tab.label}
                </span>
                {tab.incognito ? <span className="tabs__tag">Private</span> : null}
                <span className="tabs__state">
                  {!tab.reachable
                    ? 'not running — reload this tab'
                    : !tab.stats
                      ? 'running, not a results page'
                      : tab.stats.activeForThisType
                        ? `${SEARCH_TYPE_LABELS[tab.stats.searchType]} · ${tab.stats.blocked} blocked`
                        : `${SEARCH_TYPE_LABELS[tab.stats.searchType]} · paused`}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="section__hint">
          Private tabs only appear here once private access is allowed — an empty list while a
          private search tab is open is itself the answer.
        </p>
      </div>
    </section>
  );
}
