import { useRef, useState } from 'react';
import { normalizeSite } from '../matcher';
import type { Settings } from '../types';

interface BackupProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

interface RuleFile {
  keywords: string[];
  sites: string[];
  allowedSites: string[];
}

/** Accepts a full settings export or a bare `{ keywords, sites, allowedSites }` file. */
function parseRuleFile(raw: string): RuleFile {
  const data: unknown = JSON.parse(raw);
  if (typeof data !== 'object' || data === null) throw new Error('not a rules file');
  const value = data as Partial<Settings> & { allowedSites?: unknown };
  const strings = (input: unknown) =>
    Array.isArray(input) ? input.filter((item): item is string => typeof item === 'string') : [];
  const keywords = strings(value.keywords);
  const sites = strings(value.sites);
  const allowedSites = strings(value.allowedSites ?? value.whitelist?.sites);
  if (keywords.length + sites.length + allowedSites.length === 0) {
    throw new Error('no rules in that file');
  }
  return { keywords, sites, allowedSites };
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

  const exportRules = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      version: chrome.runtime.getManifest().version,
      keywords: settings.keywords,
      sites: settings.sites,
      allowedSites: settings.whitelist.sites,
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
        `Exported ${settings.keywords.length} keywords, ${settings.sites.length} blocked sites ` +
        `and ${settings.whitelist.sites.length} allowed sites.`,
    });
  };

  const importRules = async (file: File) => {
    try {
      const parsed = parseRuleFile(await file.text());
      const keywords = merge(settings.keywords, parsed.keywords);
      const sites = merge(settings.sites, parsed.sites.map(normalizeSite).filter(Boolean));
      const allowed = merge(
        settings.whitelist.sites,
        parsed.allowedSites.map(normalizeSite).filter(Boolean),
      );
      // Importing never switches the whitelist on — it only fills the list.
      update({
        keywords: keywords.merged,
        sites: sites.merged,
        whitelist: { ...settings.whitelist, sites: allowed.merged },
      });
      setNote({
        kind: 'ok',
        text:
          keywords.added + sites.added + allowed.added === 0
            ? 'Nothing new — every rule in that file was already here.'
            : `Added ${keywords.added} keywords, ${sites.added} blocked sites and ` +
              `${allowed.added} allowed sites. Nothing was removed.`,
      });
    } catch (error) {
      setNote({ kind: 'error', text: `Could not read that file: ${(error as Error).message}` });
    }
  };

  return (
    <div className="field">
      <strong>Back up your rules</strong>
      <p className="section__hint">
        Rules survive rebuilding and reloading the extension, but they are tied to the
        extension&rsquo;s identity — removing it and adding it back from a different folder
        starts you empty. Keep an export before you do anything like that.
      </p>
      <div className="backup__actions">
        <button type="button" onClick={exportRules}>
          Export rules
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>
          Import rules
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void importRules(file);
            event.target.value = ''; // let the same file be picked twice
          }}
        />
      </div>
      <p className="section__hint">Importing merges — it only ever adds rules, never removes.</p>
      {note ? <p className={`backup__note backup__note--${note.kind}`}>{note.text}</p> : null}
    </div>
  );
}
