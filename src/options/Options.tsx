import { useState } from 'react';
import { Toggle } from '../ui/Toggle';
import { buildStamp } from '../ui/buildStamp';
import { RuleSections, SearchTypeSection } from '../ui/SettingsSections';
import { useSettings } from '../ui/useSettings';
import { Backup } from './Backup';
import { Diagnostics } from './Diagnostics';
import { PasswordSection } from './PasswordSection';
import { RedirectSection } from './RedirectSection';
import { SettingsNav, type SettingsPane } from './SettingsNav';
import { TabSection } from './TabSection';
import { WhitelistSection } from './WhitelistSection';

type Tab = 'blocked' | 'whitelisted' | 'settings';

const TAB_LABELS: Record<Tab, string> = {
  blocked: 'Blocked',
  whitelisted: 'Whitelisted',
  settings: 'Settings',
};

export function Options() {
  const [settings, update] = useSettings();
  const [chosen, setChosen] = useState<Tab | null>(null);
  const [pane, setPane] = useState<SettingsPane>('diagnostics');

  if (!settings) return <div className="loading">Loading…</div>;

  const whitelisting = settings.whitelist.enabled;
  // The whitelist replaces the blocked lists as what you manage, so their tab goes.
  const tabs: Tab[] = whitelisting ? ['whitelisted', 'settings'] : ['blocked', 'whitelisted', 'settings'];
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0];

  const ruleCount = settings.keywords.length + settings.sites.length;
  const allowedCount = settings.whitelist.sites.length;
  const summary = whitelisting
    ? `${allowedCount} allowed site${allowedCount === 1 ? '' : 's'}`
    : ruleCount === 0
      ? 'No rules yet'
      : `${ruleCount} rules active`;

  return (
    <main className={`page${settings.enabled ? '' : ' app--off'}`}>
      <header className="page__head">
        <div className="header__title">
          <span className="header__mark" />
          <div>
            <h1>Web Content Blocker</h1>
            <p>
              {summary} · {buildStamp()}
            </p>
          </div>
        </div>
        <div className="page__toggles">
          <Toggle
            checked={settings.enabled}
            onChange={(enabled) => update({ enabled })}
            label={settings.enabled ? 'Blocking on' : 'Blocking off'}
          />
          <Toggle
            checked={whitelisting}
            disabled={!settings.enabled}
            onChange={(enabled) => update({ whitelist: { ...settings.whitelist, enabled } })}
            label={whitelisting ? 'Whitelist on' : 'Whitelist off'}
          />
        </div>
      </header>

      <nav className="page-tabs" role="tablist">
        {tabs.map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`page-tabs__tab${tab === id ? ' page-tabs__tab--active' : ''}`}
            onClick={() => setChosen(id)}
          >
            {TAB_LABELS[id]}
          </button>
        ))}
      </nav>

      {tab === 'blocked' ? (
        <div className="card">
          <RuleSections settings={settings} update={update} />
        </div>
      ) : null}

      {tab === 'whitelisted' ? (
        <div className="card">
          <WhitelistSection settings={settings} update={update} />
        </div>
      ) : null}

      {tab === 'settings' ? (
        <div className="settings">
          <SettingsNav active={pane} onSelect={setPane} />
          <div className="settings__pane">
            {pane === 'diagnostics' ? <Diagnostics /> : null}
            {pane === 'search' ? (
              <div className="card">
                <SearchTypeSection settings={settings} update={update} />
              </div>
            ) : null}
            {pane === 'redirect' ? (
              <div className="card">
                <RedirectSection settings={settings} update={update} />
              </div>
            ) : null}
            {pane === 'tab' ? (
              <div className="card">
                <TabSection settings={settings} update={update} />
              </div>
            ) : null}
            {pane === 'password' ? (
              <div className="card">
                <PasswordSection />
              </div>
            ) : null}
            {pane === 'backup' ? (
              <div className="card">
                <section className="section">
                  <Backup settings={settings} update={update} />
                </section>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <p className="page__foot">
        Changes save as you make them and apply to open tabs immediately. Rules live in
        <code> chrome.storage.sync</code>, so Chrome and Brave keep separate lists.
      </p>
    </main>
  );
}
