import { DEFAULT_LANDING_HTML } from '../landing';
import { LANDING_PAGE } from '../redirect';
import { MAX_LANDING_HTML, type RedirectMode, type Settings } from '../types';
import { Toggle } from '../ui/Toggle';
import { SayingsField } from './SayingsField';

interface RedirectSectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const MODES: { value: RedirectMode; label: string; hint: string }[] = [
  { value: 'landing', label: 'Show a landing page', hint: 'A quiet page with a rotating phrase' },
  { value: 'url', label: 'Send me somewhere else', hint: 'Any address you choose' },
  { value: 'off', label: 'Do nothing', hint: 'Only filter search results' },
];

export function RedirectSection({ settings, update }: RedirectSectionProps) {
  const { redirect } = settings;
  const custom = redirect.customHtml && redirect.html.trim().length > 0;

  const patch = (next: Partial<Settings['redirect']>) =>
    update({ redirect: { ...redirect, ...next } });

  return (
    <section className="section">
      <header className="section__head">
        <h2>Opening a blocked site</h2>
      </header>
      <p className="section__hint">
        Applies to the sites in your blocked list, with the same wildcards, and to every
        site off the allowed list when that is on. Search engines are never redirected for
        a blocked-list rule, so one that names an engine still just filters its results.
      </p>

      <div className="modes">
        {MODES.map((mode) => (
          <label key={mode.value} className="mode">
            <input
              type="radio"
              name="redirect-mode"
              checked={redirect.mode === mode.value}
              onChange={() => patch({ mode: mode.value })}
            />
            <span className="mode__body">
              <span className="mode__label">{mode.label}</span>
              <span className="mode__hint">{mode.hint}</span>
            </span>
          </label>
        ))}
      </div>

      {redirect.mode === 'url' ? (
        <div className="field">
          <input
            className="text-input"
            value={redirect.url}
            placeholder="example.com or https://example.com/page"
            spellCheck={false}
            autoComplete="off"
            onChange={(event) => patch({ url: event.target.value })}
          />
          <p className="section__hint">
            Falls back to the landing page if this is left empty or is itself blocked.
          </p>
        </div>
      ) : null}

      {redirect.mode === 'landing' ? (
        <>
          <div className="subsection">
            <h3 className="subsection__title">Landing Page Format</h3>
            <div className="field__head">
              <strong>{custom ? 'Custom landing page' : 'Built-in landing page'}</strong>
            </div>
            <p className="section__hint">
              {custom
                ? 'Your own markup is in use.'
                : 'One phrase at a time, rotating every twelve seconds.'}
            </p>
            <button
              type="button"
              className="preview"
              onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL(LANDING_PAGE) })}
            >
              Preview landing page
            </button>
          </div>

          <div className="subsection">
            <h3 className="subsection__title">Rotating Phrases</h3>
            <SayingsField />
          </div>

          <div className="subsection">
            <h3 className="subsection__title">Custom HTML</h3>
            <Toggle
              checked={redirect.customHtml}
              onChange={(customHtml) => patch({ customHtml })}
              label="Use custom HTML"
              hint="Replaces the built-in landing page's look and feel with your own markup."
            />

            {redirect.customHtml ? (
              <>
                <textarea
                  className="html-input"
                  rows={12}
                  spellCheck={false}
                  value={redirect.html || DEFAULT_LANDING_HTML}
                  maxLength={MAX_LANDING_HTML}
                  onChange={(event) => patch({ html: event.target.value })}
                />
                <div className="field__head">
                  <span className="section__hint">
                    {(redirect.html || DEFAULT_LANDING_HTML).length} / {MAX_LANDING_HTML} characters
                  </span>
                  <button type="button" className="link" onClick={() => patch({ html: '' })}>
                    Reset to default
                  </button>
                </div>
                <button
                  type="button"
                  className="preview"
                  onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL('editor.html') })}
                >
                  Open editor with live preview
                </button>
                <Toggle
                  checked={redirect.showAllowedSites}
                  onChange={(showAllowedSites) => patch({ showAllowedSites })}
                  label="Show allowed sites with whitelist mode off"
                  hint={
                    settings.whitelist.enabled
                      ? 'Whitelist mode is on, so your allowed sites are already listed.'
                      : 'Lists your allowed sites as shortcuts on the landing and new tab pages, without blocking anything else.'
                  }
                />
                <p className="section__hint">
                  An element with <code>id="wcb-quote"</code> is filled with a rotating phrase;
                  leave it out for a static page. <code>&lt;style&gt;</code> works,
                  <code>&lt;script&gt;</code> does not run.
                </p>
              </>
            ) : redirect.html.trim() ? (
              <p className="section__hint">
                Your HTML is saved and comes back when this is turned on again.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
