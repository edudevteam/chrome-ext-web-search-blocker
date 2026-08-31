import { normalizeSite } from '../matcher';
import { SEARCH_TYPES, SEARCH_TYPE_LABELS, type SearchType, type Settings } from '../types';
import { RuleList } from './RuleList';
import { Toggle } from './Toggle';

interface SectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

function hintFor(type: SearchType): string | undefined {
  if (type === 'maps') return 'Brave + Google places';
  if (type === 'goggles') return 'Brave only';
  return undefined;
}

export function SearchTypeSection({ settings, update }: SectionProps) {
  return (
    <section className="section">
      <header className="section__head">
        <h2>Search types</h2>
      </header>
      <p className="section__hint">Blocking runs on every tab type unless you switch one off.</p>
      <div className="types">
        {SEARCH_TYPES.map((type) => (
          <Toggle
            key={type}
            checked={settings.types[type]}
            disabled={!settings.enabled}
            label={SEARCH_TYPE_LABELS[type]}
            hint={hintFor(type)}
            onChange={(on) => update({ types: { ...settings.types, [type]: on } })}
          />
        ))}
      </div>

      <div className="section__extra">
        <Toggle
          checked={settings.hidePreviewStrip}
          disabled={!settings.enabled || !settings.types.images}
          label="Hide recommended images in the preview"
          hint="Those thumbnails carry nothing to identify them by"
          onChange={(hidePreviewStrip) => update({ hidePreviewStrip })}
        />
      </div>
    </section>
  );
}

export function RuleSections({ settings, update }: SectionProps) {
  return (
    <>
      <RuleList
        title="Blocked keywords"
        hint="Matches the title, snippet and URL. Wrap in slashes for a regex, e.g. /crypto|nft/i."
        placeholder="keyword or /regex/"
        noun="keyword"
        items={settings.keywords}
        onChange={(keywords) => update({ keywords })}
      />
      <RuleList
        title="Blocked sites"
        hint="Domains include their subdomains. Use * to match part of a host — porn*, *hub.com, *sex*. Paste a full URL and it will be trimmed."
        placeholder="example.com or porn*"
        noun="site"
        items={settings.sites}
        onChange={(sites) => update({ sites })}
        normalize={normalizeSite}
      />
    </>
  );
}
