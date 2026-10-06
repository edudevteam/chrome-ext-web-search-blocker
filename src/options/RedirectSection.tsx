import { useState } from 'react';
import { DEFAULT_LANDING_HTML } from '../landing';
import { LANDING_PAGE } from '../redirect';
import { MAX_LANDING_HTML, type RedirectMode, type Settings } from '../types';

interface RedirectSectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const MODES: { value: RedirectMode; label: string; hint: string }[] = [
  { value: 'landing', label: 'Show a landing page', hint: 'A quiet page with a rotating proverb' },
  { value: 'url', label: 'Send me somewhere else', hint: 'Any address you choose' },
  { value: 'off', label: 'Do nothing', hint: 'Only filter search results' },
];

export function RedirectSection({ settings, update }: RedirectSectionProps) {
  const { redirect } = settings;
  const [editing, setEditing] = useState(false);
  const custom = redirect.html.trim().length > 0;

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
        <div className="field">
          <div className="field__head">
            <strong>{custom ? 'Custom landing page' : 'Built-in landing page'}</strong>
            <button type="button" className="link" onClick={() => setEditing((open) => !open)}>
              {editing ? 'Done' : custom ? 'Edit HTML' : 'Customise HTML'}
            </button>
          </div>

          {editing ? (
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
              <p className="section__hint">
                An element with <code>id="wcb-quote"</code> is filled with a rotating proverb;
                leave it out for a static page. <code>&lt;style&gt;</code> works,
                <code>&lt;script&gt;</code> does not run.
              </p>
            </>
          ) : (
            <p className="section__hint">
              {custom
                ? 'Your own markup is in use.'
                : 'Eight proverbs, one at a time, rotating every twelve seconds.'}
            </p>
          )}

          <button
            type="button"
            className="preview"
            onClick={() => void chrome.tabs.create({ url: chrome.runtime.getURL(LANDING_PAGE) })}
          >
            Preview landing page
          </button>
        </div>
      ) : null}
    </section>
  );
}
