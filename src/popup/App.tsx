import { useEffect, useState } from 'react';
import { ENGINES } from '../engines';
import { SEARCH_TYPE_LABELS, type Message, type PageStats } from '../types';
import { RuleSections } from '../ui/SettingsSections';
import { buildStamp } from '../ui/buildStamp';
import { useSettings } from '../ui/useSettings';

/** undefined = still checking, null = not a supported search page. */
type Stats = PageStats | null | undefined;

async function fetchStats(): Promise<PageStats | null> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const request: Message = { type: 'wcb:get-stats' };
    const response = (await chrome.tabs.sendMessage(tab.id, request)) as Message | null;
    return response?.type === 'wcb:stats' ? response.stats : null;
  } catch {
    return null; // no content script on this page
  }
}

export function App() {
  const [settings, update] = useSettings();
  const [stats, setStats] = useState<Stats>(undefined);

  useEffect(() => {
    let alive = true;
    const poll = () => void fetchStats().then((next) => alive && setStats(next));
    poll();
    const timer = window.setInterval(poll, 1000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!settings) return <div className="loading">Loading…</div>;

  const ruleCount = settings.keywords.length + settings.sites.length;
  const engineLabel = stats ? ENGINES.find((e) => e.id === stats.engine)?.label : null;

  return (
    <div className={`app${settings.enabled ? '' : ' app--off'}`}>
      <header className="header">
        <div className="header__title">
          <span className="header__mark" />
          <div>
            <h1>Content Blocker</h1>
            <p>
              {ruleCount === 0 ? 'No rules yet' : `${ruleCount} rules`} · {buildStamp()}
            </p>
          </div>
        </div>
      </header>

      <div className="popup-settings">
        <button type="button" onClick={() => chrome.runtime.openOptionsPage()}>
          Settings &amp; diagnostics ↗
        </button>
      </div>

      <div className="status">
        {stats === undefined ? (
          <span className="status__muted">Checking this tab…</span>
        ) : stats === null ? (
          <span className="status__muted">Not a supported search page</span>
        ) : (
          <>
            <span className="status__badge">{engineLabel}</span>
            <span className="status__badge status__badge--soft">
              {SEARCH_TYPE_LABELS[stats.searchType]}
            </span>
            <span className="status__count">
              {stats.activeForThisType
                ? `${stats.blocked} blocked`
                : settings.enabled
                  ? 'paused for this tab'
                  : 'blocker off'}
            </span>
          </>
        )}
      </div>

      <RuleSections settings={settings} update={update} />
    </div>
  );
}
