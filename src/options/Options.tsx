import { Toggle } from '../ui/Toggle';
import { buildStamp } from '../ui/buildStamp';
import { RuleSections, SearchTypeSection } from '../ui/SettingsSections';
import { useSettings } from '../ui/useSettings';
import { Backup } from './Backup';
import { Diagnostics } from './Diagnostics';
import { RedirectSection } from './RedirectSection';

export function Options() {
  const [settings, update] = useSettings();

  if (!settings) return <div className="loading">Loading…</div>;

  const ruleCount = settings.keywords.length + settings.sites.length;

  return (
    <main className={`page${settings.enabled ? '' : ' app--off'}`}>
      <header className="page__head">
        <div className="header__title">
          <span className="header__mark" />
          <div>
            <h1>Web Content Blocker</h1>
            <p>
              {ruleCount === 0 ? 'No rules yet' : `${ruleCount} rules active`} · {buildStamp()}
            </p>
          </div>
        </div>
        <Toggle
          checked={settings.enabled}
          onChange={(enabled) => update({ enabled })}
          label={settings.enabled ? 'Blocking on' : 'Blocking off'}
        />
      </header>

      <Diagnostics />

      <div className="card">
        <SearchTypeSection settings={settings} update={update} />
      </div>

      <div className="card">
        <RuleSections settings={settings} update={update} />
        <section className="section">
          <Backup settings={settings} update={update} />
        </section>
      </div>

      <div className="card">
        <RedirectSection settings={settings} update={update} />
      </div>

      <p className="page__foot">
        Changes save as you make them and apply to open tabs immediately. Rules live in
        <code> chrome.storage.sync</code>, so Chrome and Brave keep separate lists.
      </p>
    </main>
  );
}
