import { useRef, useState } from 'react';
import { normalizeSite } from '../matcher';
import { clearSayings, loadSayings, normalizeSayings, saveSayings, type SayingsState } from '../sayings';
import {
  loadSiteImages,
  loadSiteLabels,
  normalizeSiteImages,
  normalizeSiteLabels,
  saveSiteImages,
  saveSiteLabels,
  type SiteImages,
  type SiteLabels,
} from '../siteImages';
import { normalizeSettings } from '../storage';
import { clearTabIcon, loadTabIcon, normalizeTabIcon, saveTabIcon, type TabIconState } from '../tabIcon';
import type { Settings } from '../types';

interface BackupProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

const STARTER_LISTS = [
  {
    name: 'Adult content starter',
    hint: 'Blocks common adult keywords and sites.',
    url: 'https://raw.githubusercontent.com/edudevteam/chrome-ext-web-search-blocker/refs/heads/main/templates/adult-content-starter.json',
  },
  {
    name: 'STEM whitelist sample',
    hint: 'Fills the allowed-sites list with a few STEM sites. Turn the whitelist on to use it.',
    url: 'https://raw.githubusercontent.com/edudevteam/chrome-ext-web-search-blocker/refs/heads/main/templates/whitelist-stem-sample.json',
  },
];

interface RuleFile {
  keywords: string[];
  sites: string[];
  allowedSites: string[];
  /** Every toggle, the custom HTML and the tab title. Null for a bare rules file. */
  settings: Settings | null;
  /** Null when the file has none of its own. */
  siteImages: SiteImages | null;
  siteLabels: SiteLabels | null;
  /** Undefined when the file doesn't say; null when the export had none. */
  tabIcon: TabIconState | null | undefined;
  sayings: SayingsState | null | undefined;
}

/**
 * Accepts a full backup (rules plus `settings`, site images, tab icon and
 * sayings), an older rules-only export, or a bare `{ keywords, sites, allowedSites }` file.
 */
function parseRuleFile(raw: string): RuleFile {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) throw new Error('not a rules file');
  const value = data as Partial<Settings> & {
    allowedSites?: unknown;
    settings?: unknown;
    siteImages?: unknown;
    siteLabels?: unknown;
    tabIcon?: unknown;
    sayings?: unknown;
  };
  const settings =
    typeof value.settings === 'object' && value.settings !== null
      ? normalizeSettings(value.settings)
      : null;
  const strings = (input: unknown) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [];
  const keywords = value.keywords ? strings(value.keywords) : (settings?.keywords ?? []);
  const sites = value.sites ? strings(value.sites) : (settings?.sites ?? []);
  const allowedSites =
    value.allowedSites || value.whitelist
      ? strings(value.allowedSites ?? value.whitelist?.sites)
      : (settings?.whitelist.sites ?? []);
  if (keywords.length + sites.length + allowedSites.length === 0 && !settings) {
    throw new Error('no rules in that file');
  }
  return {
    keywords,
    sites,
    allowedSites,
    settings,
    siteImages: 'siteImages' in value ? normalizeSiteImages(value.siteImages) : null,
    siteLabels: 'siteLabels' in value ? normalizeSiteLabels(value.siteLabels) : null,
    tabIcon: 'tabIcon' in value ? normalizeTabIcon(value.tabIcon) : undefined,
    sayings: 'sayings' in value ? normalizeSayings(value.sayings) : undefined,
  };
}

/** Restores the tab icon or sayings from a backup: set, clear, or leave alone. */
async function restoreLocal<T>(
  incoming: T | null | undefined,
  save: (value: T) => Promise<void>,
  clear: () => Promise<void>,
): Promise<void> {
  if (incoming === undefined) return;
  await (incoming === null ? clear() : save(incoming));
}

/** Case-insensitive union that keeps the existing entries and their order. */
function merge(current: string[], incoming: string[]): { merged: string[]; added: number } {
  const seen = new Set(current.map((item) => item.toLowerCase()));
  const additions: string[] = [];
  for (const entry of incoming) {
    const key = entry.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    additions.push(entry);
  }
  return { merged: [...current, ...additions], added: additions.length };
}

export function Backup({ settings, update }: BackupProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [mode, setMode] = useState<'append' | 'replace'>('append');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const exportRules = async () => {
    const [siteImages, siteLabels, tabIcon, sayings] = await Promise.all([
      loadSiteImages(),
      loadSiteLabels(),
      loadTabIcon().catch(() => null),
      loadSayings().catch(() => null),
    ]);
    // The password lock is left out on purpose: a backup must never carry it.
    const payload = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      // Kept at the top level so older versions can still import the rules.
      keywords: settings.keywords,
      sites: settings.sites,
      allowedSites: settings.whitelist.sites,
      settings,
      siteImages,
      siteLabels,
      tabIcon,
      sayings,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `content-blocker-rules-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNote({
      kind: 'ok',
      text:
        `Exported ${settings.keywords.length} keywords, ${settings.sites.length} blocked sites, ` +
        `${settings.whitelist.sites.length} allowed sites, ${Object.keys(siteImages).length} ` +
        `site images and all of your settings.`,
    });
  };

  const applyRules = async (raw: string, source: string) => {
    const parsed = parseRuleFile(raw);
    // Paths are kept: an export carries any page-only rules as they were saved.
    const incomingSites = parsed.sites.map((site) => normalizeSite(site, true)).filter(Boolean);
    const incomingAllowed = parsed.allowedSites.map((site) => normalizeSite(site, true)).filter(Boolean);

    if (mode === 'replace') {
      const keywords = merge([], parsed.keywords).merged;
      const sites = merge([], incomingSites).merged;
      const allowed = merge([], incomingAllowed).merged;
      const ok = window.confirm(
        `Replace all of your rules with the ${keywords.length} keywords, ${sites.length} ` +
          `blocked sites and ${allowed.length} allowed sites from ${source}?\n\n` +
          `Your current ${settings.keywords.length} keywords, ${settings.sites.length} blocked ` +
          `sites and ${settings.whitelist.sites.length} allowed sites will be removed.` +
          (parsed.settings
            ? `\n\nThis is a full backup: every toggle, the custom HTML, site images, tab ` +
              `title and icon will be restored from it too.`
            : ''),
      );
      if (!ok) {
        setNote(null);
        return;
      }
      if (parsed.settings) {
        update({
          ...parsed.settings,
          keywords,
          sites,
          whitelist: { ...parsed.settings.whitelist, sites: allowed },
        });
      } else {
        update({ keywords, sites, whitelist: { ...settings.whitelist, sites: allowed } });
      }
      if (parsed.siteImages) await saveSiteImages(parsed.siteImages);
      if (parsed.siteLabels) await saveSiteLabels(parsed.siteLabels);
      await restoreLocal(parsed.tabIcon, saveTabIcon, clearTabIcon);
      await restoreLocal(parsed.sayings, saveSayings, clearSayings);
      setNote({
        kind: 'ok',
        text:
          `Replaced your rules with ${keywords.length} keywords, ${sites.length} blocked sites ` +
          `and ${allowed.length} allowed sites.` +
          (parsed.settings ? ' Your settings, custom HTML and site images were restored.' : ''),
      });
      return;
    }

    const keywords = merge(settings.keywords, parsed.keywords);
    const sites = merge(settings.sites, incomingSites);
    const allowed = merge(settings.whitelist.sites, incomingAllowed);
    const channels = merge(settings.stream.channels, parsed.settings?.stream.channels ?? []);
    const streamKeywords = merge(settings.stream.keywords, parsed.settings?.stream.keywords ?? []);
    // Appending never changes a toggle or the custom HTML — it only fills the lists.
    update({
      keywords: keywords.merged,
      sites: sites.merged,
      whitelist: { ...settings.whitelist, sites: allowed.merged },
      stream: { ...settings.stream, channels: channels.merged, keywords: streamKeywords.merged },
    });

    // Images and labels you already set win over the file's.
    let imagesAdded = 0;
    if (parsed.siteImages) {
      const current = await loadSiteImages();
      imagesAdded = Object.keys(parsed.siteImages).filter((site) => !(site in current)).length;
      await saveSiteImages({ ...parsed.siteImages, ...current });
    }
    if (parsed.siteLabels) {
      await saveSiteLabels({ ...parsed.siteLabels, ...(await loadSiteLabels()) });
    }

    const added =
      keywords.added + sites.added + allowed.added + channels.added + streamKeywords.added;
    const settingsHint = parsed.settings
      ? ' Settings and custom HTML in the file were not applied — use “Import (replace all)” to restore them.'
      : '';
    setNote({
      kind: 'ok',
      text:
        added + imagesAdded === 0
          ? `Nothing new — every rule in ${source} was already here.${settingsHint}`
          : `Added ${keywords.added} keywords, ${sites.added} blocked sites, ` +
            `${allowed.added} allowed sites and ${imagesAdded} site images. ` +
            `Nothing was removed.${settingsHint}`,
    });
  };

  const importFile = async (file: File) => {
    try {
      await applyRules(await file.text(), 'that file');
    } catch (error) {
      setNote({ kind: 'error', text: `Could not read that file: ${(error as Error).message}` });
    }
  };

  const importUrl = (address: string) => {
    let target: URL;
    try {
      target = new URL(address.trim());
      if (target.protocol !== 'https:' && target.protocol !== 'http:') throw new Error();
    } catch {
      setNote({ kind: 'error', text: 'Enter a full http:// or https:// address.' });
      return;
    }
    // Ask for access to just this host. This must run inside the click, before any await.
    chrome.permissions.request({ origins: [`${target.origin}/*`] }, (granted) => {
      if (!granted) {
        setNote({ kind: 'error', text: `Permission to read ${target.host} was not given.` });
        return;
      }
      void (async () => {
        setLoading(true);
        setNote(null);
        try {
          const response = await fetch(target, {
            cache: 'no-store',
            credentials: 'omit',
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error(`the server answered ${response.status}`);
          await applyRules(await response.text(), target.host);
        } catch (error) {
          const message =
            error instanceof SyntaxError ? 'that is not a JSON rules file' : (error as Error).message;
          setNote({ kind: 'error', text: `Could not import from that URL: ${message}` });
        } finally {
          setLoading(false);
        }
      })();
    });
  };

  return (
    <div className="field">
      <strong className="backup__heading backup__heading--export">Back up your rules</strong>
      <p className="section__hint">
        Rules survive rebuilding and reloading the extension, but they are tied to the
        extension&rsquo;s identity — removing it and adding it back from a different folder
        starts you empty. Keep an export before you do anything like that. The export holds your
        rules, every toggle, the custom landing page HTML, site images and labels, the tab title
        and icon, and your sayings — but never your password.
      </p>
      <div className="backup__actions">
        <button type="button" onClick={() => void exportRules()}>
          Export rules &amp; settings
        </button>
      </div>

      <hr className="backup__rule" />

      <strong className="backup__heading backup__heading--import">Import rules</strong>
      <p className="section__hint">Choose how imported rules combine with the ones you have.</p>
      <div className="modes backup__modes">
        <label className="mode">
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'append'}
            onChange={() => setMode('append')}
          />
          <span className="mode__body">
            <span className="mode__label">Import (append to existing)</span>
            <span className="mode__hint">
              Adds new rules and site images. Nothing you already have is removed, and your
              toggles and custom HTML stay as they are.
            </span>
          </span>
        </label>
        <label className="mode">
          <input
            type="radio"
            name="import-mode"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
          />
          <span className="mode__body">
            <span className="mode__label">Import (replace all)</span>
            <span className="mode__hint">
              Your keywords, blocked sites and allowed sites become exactly what is imported.
              A full backup also restores every toggle, the custom HTML, site images and the tab
              title and icon.
            </span>
          </span>
        </label>
      </div>

      <span className="backup__label">From a file</span>
      <div className="backup__actions">
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import from file
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importFile(file);
            event.target.value = ''; // let the same file be picked twice
          }}
        />
      </div>

      <span className="backup__label">From a URL</span>
      <form
        className="backup__actions backup__url"
        onSubmit={(event) => {
          event.preventDefault();
          importUrl(url);
        }}
      >
        <input
          className="text-input"
          type="url"
          value={url}
          placeholder="https://example.com/rules.json"
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => setUrl(event.target.value)}
        />
        <button type="submit" disabled={loading || url.trim() === ''}>
          {loading ? 'Importing…' : 'Import from URL'}
        </button>
      </form>
      <p className="section__hint">
        The URL must point to a JSON export. Chrome will ask once for permission to read that site.
      </p>

      <hr className="backup__rule" />

      <strong className="backup__heading backup__heading--starter">Starter lists</strong>
      <p className="section__hint">
        Ready-made lists to get you going. They use the import choice above.
      </p>
      <ul className="backup__starters">
        {STARTER_LISTS.map((list) => (
          <li key={list.url} className="backup__starter">
            <span className="mode__body">
              <span className="mode__label">{list.name}</span>
              <span className="mode__hint">{list.hint}</span>
            </span>
            <span className="backup__actions">
              <button type="button" disabled={loading} onClick={() => importUrl(list.url)}>
                {mode === 'replace' ? 'Replace with this' : 'Add these'}
              </button>
            </span>
          </li>
        ))}
      </ul>
      {note ? <p className={`backup__note backup__note--${note.kind}`}>{note.text}</p> : null}
    </div>
  );
}
