import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import {
  DEFAULT_LANDING_HTML,
  SAMPLE_SITES,
  SITE_PLACEHOLDERS,
  SITE_TEMPLATE_ID,
} from '../landing';
import { LANDING_PAGE } from '../redirect';
import {
  isImageUrl,
  loadSiteImages,
  loadSiteLabels,
  MAX_IMAGE_URL,
  MAX_SITE_LABEL,
  normalizeSiteImages,
  normalizeSiteLabels,
  saveSiteImages,
  saveSiteLabels,
  type SiteImages,
  type SiteLabels,
} from '../siteImages';
import { MAX_LANDING_HTML, type Settings } from '../types';
import { Toggle } from '../ui/Toggle';
import { useSettings } from '../ui/useSettings';
import { BLOCKS, LAYOUTS, type Snippet } from './snippets';

const PREVIEW_MS = 120;
const INDENT = '  ';

const savedHtml = (settings: Settings) => settings.redirect.html || DEFAULT_LANDING_HTML;

/**
 * Full-window editor for the custom landing page: markup on the left, the real
 * landing page on the right, rendered live from the draft. Nothing is stored
 * until Save, so the live landing page only changes when you mean it to.
 */
export function Editor() {
  const [settings, update] = useSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const [savedImages, setSavedImages] = useState<SiteImages | null>(null);
  const [images, setImages] = useState<SiteImages>({});
  const [savedLabels, setSavedLabels] = useState<SiteLabels | null>(null);
  const [labels, setLabels] = useState<SiteLabels>({});
  const [tab, setTab] = useState<'html' | 'images'>('html');
  const latest = useRef<{
    settings: Settings | null;
    draft: string | null;
    images: SiteImages;
    savedImages: SiteImages | null;
    labels: SiteLabels;
    savedLabels: SiteLabels | null;
  }>({ settings: null, draft: null, images: {}, savedImages: null, labels: {}, savedLabels: null });
  const frame = useRef<HTMLIFrameElement>(null);
  const code = useRef<HTMLTextAreaElement>(null);

  latest.current = { settings, draft, images, savedImages, labels, savedLabels };
  const htmlDirty = settings !== null && draft !== null && draft !== savedHtml(settings);
  const imagesDirty = savedImages !== null && !sameImages(images, savedImages);
  const labelsDirty = savedLabels !== null && !sameLabels(labels, savedLabels);
  const dirty = htmlDirty || imagesDirty || labelsDirty;

  // Take the saved markup once; after that the draft is the source of truth.
  useEffect(() => {
    if (settings && draft === null) setDraft(savedHtml(settings));
  }, [settings, draft]);

  useEffect(() => {
    void loadSiteImages().then((stored) => {
      setSavedImages(stored);
      setImages(stored);
    });
    void loadSiteLabels().then((stored) => {
      setSavedLabels(stored);
      setLabels(stored);
    });
  }, []);

  const save = () => {
    const {
      settings: current,
      draft: html,
      images: nextImages,
      savedImages: stored,
      labels: nextLabels,
      savedLabels: storedLabels,
    } = latest.current;
    if (current && html !== null) {
      // An empty value means "the built-in template", as on the settings page.
      const value = html === DEFAULT_LANDING_HTML ? '' : html;
      if (value !== current.redirect.html) update({ redirect: { ...current.redirect, html: value } });
    }
    if (stored && !sameImages(nextImages, stored)) {
      const valid = normalizeSiteImages(nextImages);
      void saveSiteImages(valid).then(() => setSavedImages(valid));
    }
    if (storedLabels && !sameLabels(nextLabels, storedLabels)) {
      const valid = normalizeSiteLabels(nextLabels);
      void saveSiteLabels(valid).then(() => setSavedLabels(valid));
    }
  };

  const postPreview = () => {
    const { draft: html, images: previewImages, labels: previewLabels } = latest.current;
    if (html === null) return;
    frame.current?.contentWindow?.postMessage(
      { previewHtml: html, previewImages, previewLabels },
      location.origin,
    );
  };

  // The preview asks for markup once it has loaded.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin === location.origin && event.data?.previewReady) postPreview();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (draft === null) return;
    const timer = window.setTimeout(postPreview, PREVIEW_MS);
    return () => window.clearTimeout(timer);
  }, [draft, images, labels]);

  // Ask before closing the tab on unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ⌘S / Ctrl+S saves from anywhere on the page, instead of saving the page itself.
  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() !== 's' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      save();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (!settings || draft === null) return <div className="loading">Loading…</div>;

  const { redirect } = settings;

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Tab' || event.shiftKey || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    // insertText keeps the browser's undo history, unlike setting the value.
    document.execCommand('insertText', false, INDENT);
  };

  /** Types the snippet at the cursor, replacing any selection, so ⌘Z undoes it. */
  const insert = (html: string) => {
    code.current?.focus();
    document.execCommand('insertText', false, html);
  };

  // The whitelist's on/off switch doesn't matter here: designing for your sites does.
  const hasAllowedSites = settings.whitelist.sites.length > 0;
  // The same sites the preview shows, so an image can be tried out before saving.
  const previewSites = hasAllowedSites ? settings.whitelist.sites : SAMPLE_SITES;

  return (
    <div className="editor">
      <header className="editor__head">
        <div className="editor__title">
          <h1>Landing page HTML</h1>
          <p>
            Use the buttons below to drop in the rotating phrase or a layout for your allowed
            sites. A <code>&lt;template id="{SITE_TEMPLATE_ID}"&gt;</code> repeats once per site.{' '}
            <code>&lt;style&gt;</code> works, <code>&lt;script&gt;</code> does not run.
          </p>
        </div>
        <div className="editor__actions">
          <Toggle
            checked={redirect.customHtml}
            onChange={(customHtml) => update({ redirect: { ...redirect, customHtml } })}
            label="Use custom HTML"
          />
          <button
            type="button"
            className="editor__button"
            onClick={() => setDraft(DEFAULT_LANDING_HTML)}
          >
            Reset to default
          </button>
          <span className="editor__status" aria-live="polite">
            {dirty ? 'Unsaved changes' : 'Saved'}
          </span>
          <button
            type="button"
            className="editor__button editor__button--primary"
            disabled={!dirty}
            title="Save (⌘S / Ctrl+S)"
            onClick={save}
          >
            Save
          </button>
        </div>
      </header>

      {redirect.customHtml ? null : (
        <p className="editor__notice">
          Custom HTML is off, so blocked sites still show the built-in page. Turn it on to use
          this markup.
        </p>
      )}

      <div className="editor__panes">
        <section className="editor__pane">
          <div className="editor__pane-head editor__pane-head--tabs" role="tablist">
            <span>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'html'}
                className="editor__tab"
                onClick={() => setTab('html')}
              >
                HTML
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'images'}
                className="editor__tab"
                onClick={() => setTab('images')}
              >
                Site images
              </button>
            </span>
            {tab === 'html' ? (
              <span>
                {draft.length} / {MAX_LANDING_HTML}
              </span>
            ) : null}
          </div>
          {tab === 'images' ? (
            <SiteImagesPanel
              sites={previewSites}
              samples={!hasAllowedSites}
              images={images}
              onChange={setImages}
              labels={labels}
              onLabelsChange={setLabels}
            />
          ) : null}
          {/* Hidden rather than unmounted, so the textarea keeps its undo history. */}
          <div className="editor__inserts" hidden={tab !== 'html'}>
            <PillGroup label="Insert" snippets={BLOCKS} onInsert={insert} />
            <PillGroup label="Site layout" snippets={LAYOUTS} onInsert={insert} />
            <div className="editor__pill-group">
              <span className="editor__pill-label">In a site layout</span>
              {SITE_PLACEHOLDERS.map(({ key, hint }) => (
                <button
                  key={key}
                  type="button"
                  className="editor__pill editor__pill--code"
                  title={hint}
                  onClick={() => insert(`{{${key}}}`)}
                >
                  {`{{${key}}}`}
                </button>
              ))}
            </div>
            {!hasAllowedSites ? (
              <p className="editor__inserts-note">
                Your allowed list is empty, so the preview uses sample sites (
                {SAMPLE_SITES.join(', ')}).
              </p>
            ) : !settings.whitelist.enabled && !redirect.showAllowedSites ? (
              <p className="editor__inserts-note">
                The preview shows your allowed sites, but blocked pages only list them with
                whitelist mode on, or with &ldquo;Show allowed sites with whitelist mode
                off&rdquo; turned on in settings.
              </p>
            ) : null}
          </div>
          <textarea
            ref={code}
            hidden={tab !== 'html'}
            className="editor__code"
            spellCheck={false}
            autoFocus
            value={draft}
            maxLength={MAX_LANDING_HTML}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKeyDown}
          />
        </section>

        <section className="editor__pane">
          <div className="editor__pane-head">
            <span>Preview</span>
            {hasAllowedSites ? null : <span>Sample sites</span>}
          </div>
          <iframe
            ref={frame}
            className="editor__preview"
            title="Landing page preview"
            src={`${LANDING_PAGE}#preview`}
          />
        </section>
      </div>
    </div>
  );
}

function sameImages(a: SiteImages, b: SiteImages): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? '').trim() === (b[key] ?? '').trim());
}

/** A label switched to custom text but left empty still shows the address. */
function sameLabels(a: SiteLabels, b: SiteLabels): boolean {
  return sameImages(normalizeSiteLabels(a), normalizeSiteLabels(b));
}

interface SiteImagesPanelProps {
  sites: string[];
  samples: boolean;
  images: SiteImages;
  onChange: (images: SiteImages) => void;
  labels: SiteLabels;
  onLabelsChange: (labels: SiteLabels) => void;
}

/**
 * One image address per allowed site, for `{{image}}`, and a choice of showing
 * the address or your own text as `{{site}}`.
 */
function SiteImagesPanel({
  sites,
  samples,
  images,
  onChange,
  labels,
  onLabelsChange,
}: SiteImagesPanelProps) {
  const set = (site: string, url: string) => {
    const next = { ...images };
    if (url.trim()) next[site] = url;
    else delete next[site];
    onChange(next);
  };

  // An entry in `labels`, even an empty one, means custom text is chosen.
  const setLabel = (site: string, label: string | null) => {
    const next = { ...labels };
    if (label === null) delete next[site];
    else next[site] = label;
    onLabelsChange(next);
  };

  return (
    <div className="site-images">
      <p className="editor__inserts-note">
        Each address fills <code>{'{{image}}'}</code> for that site in a site layout. Images
        load from anywhere — the whitelist only checks pages you open, not images on this one.
        {samples
          ? ' These are the sample sites, since your allowed list is empty; images set here only show in the preview.'
          : ''}
      </p>
      <ul className="site-images__list">
        {sites.map((site) => {
          const url = (images[site] ?? '').trim();
          const invalid = url !== '' && !isImageUrl(url);
          const label = labels[site];
          return (
            <li key={site} className="site-images__row">
              <span className="site-images__thumb" aria-hidden="true">
                {url && !invalid ? <img src={url} alt="" /> : null}
              </span>
              <div className="site-images__field">
                <label className="site-images__field">
                  <span className="site-images__site">{site}</span>
                  <input
                    className="text-input"
                    type="url"
                    value={images[site] ?? ''}
                    placeholder="https://example.com/logo.png"
                    spellCheck={false}
                    autoComplete="off"
                    maxLength={MAX_IMAGE_URL}
                    aria-invalid={invalid}
                    onChange={(event) => set(site, event.target.value)}
                  />
                  {invalid ? (
                    <span className="site-images__error">
                      Use an http:// or https:// address. This one won't be saved.
                    </span>
                  ) : null}
                </label>
                <fieldset className="site-images__label">
                  <legend>Show as</legend>
                  <label>
                    <input
                      type="radio"
                      name={`label-${site}`}
                      checked={label === undefined}
                      onChange={() => setLabel(site, null)}
                    />
                    Full address
                  </label>
                  <label>
                    <input
                      type="radio"
                      name={`label-${site}`}
                      checked={label !== undefined}
                      onChange={() => setLabel(site, suggestLabel(site))}
                    />
                    Custom text
                  </label>
                  {label !== undefined ? (
                    <input
                      className="text-input"
                      type="text"
                      value={label}
                      placeholder={suggestLabel(site)}
                      aria-label={`Text shown for ${site}`}
                      spellCheck={false}
                      autoComplete="off"
                      maxLength={MAX_SITE_LABEL}
                      onChange={(event) => setLabel(site, event.target.value)}
                    />
                  ) : null}
                </fieldset>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * A starting point for custom text: a channel's handle (`youtube.com/@name` ->
 * `@name`), or the entry itself for a whole site.
 */
function suggestLabel(site: string): string {
  return site.split('/').filter(Boolean).slice(1).pop() ?? site;
}

interface PillGroupProps {
  label: string;
  snippets: Snippet[];
  onInsert: (html: string) => void;
}

function PillGroup({ label, snippets, onInsert }: PillGroupProps) {
  return (
    <div className="editor__pill-group">
      <span className="editor__pill-label">{label}</span>
      {snippets.map((snippet) => (
        <button
          key={snippet.label}
          type="button"
          className="editor__pill"
          title={snippet.hint}
          onClick={() => onInsert(snippet.html)}
        >
          + {snippet.label}
        </button>
      ))}
    </div>
  );
}
