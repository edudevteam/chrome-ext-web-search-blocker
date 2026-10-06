import { normalizeSite } from '../matcher';
import type { Settings } from '../types';
import { RuleList } from '../ui/RuleList';

interface WhitelistSectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

export function WhitelistSection({ settings, update }: WhitelistSectionProps) {
  const { whitelist } = settings;

  return (
    <>
      <section className="section">
        <header className="section__head">
          <h2>Allowed sites only</h2>
        </header>
        <p className="section__hint">
          With the whitelist switched on at the top, every site not on this list is treated as
          blocked and sent wherever &ldquo;Opening a blocked site&rdquo; says — the landing
          page if that is set to do nothing. Search engines are not exempt: add{' '}
          <code>google.com</code> or <code>search.brave.com</code> to keep searching. Your
          blocked lists still apply on top.
        </p>
        {whitelist.enabled && whitelist.sites.length === 0 ? (
          <p className="backup__note backup__note--error">
            No sites are allowed yet, so every website is blocked.
          </p>
        ) : null}
      </section>
      <RuleList
        title="Allowed sites"
        hint="Domains include their subdomains, and * matches part of a host, as with blocked sites. Sites a page signs in or loads through (accounts.google.com, for one) may need adding too."
        placeholder="example.com or *.edu"
        noun="site"
        items={whitelist.sites}
        onChange={(sites) => update({ whitelist: { ...whitelist, sites } })}
        normalize={normalizeSite}
      />
    </>
  );
}
