import type { Settings } from '../types';
import { RuleList } from '../ui/RuleList';
import { Toggle } from '../ui/Toggle';

interface StreamSectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** The settings pane switch that turns the feature, and its tab, on. */
export function StreamToggleSection({ settings, update }: StreamSectionProps) {
  const { stream } = settings;
  return (
    <section className="section">
      <header className="section__head">
        <h2>Streams</h2>
      </header>
      <p className="section__hint">
        Searching YouTube or Vimeo for anything on your stream lists sends you back to the
        site&rsquo;s home page. On YouTube, videos whose channel, title or description match
        are hidden wherever they appear, and opening one sends you to the home page too. Switching this on adds a Streams tab for those
        rules.
      </p>
      <Toggle
        checked={stream.enabled}
        disabled={!settings.enabled}
        label="Block streams"
        hint="YouTube and Vimeo"
        onChange={(enabled) => update({ stream: { ...stream, enabled } })}
      />
    </section>
  );
}

/** The Streams tab: what to hide on streaming sites. */
export function StreamRulesSection({ settings, update }: StreamSectionProps) {
  const { stream } = settings;
  return (
    <>
      <RuleList
        title="Blocked channels"
        hint="Matches the channel name shown on each result, and searches, ignoring case and spaces. Wrap in slashes for a regex, e.g. /^vmx/."
        placeholder="channel name or /regex/"
        noun="channel"
        items={stream.channels}
        onChange={(channels) => update({ stream: { ...stream, channels } })}
      />
      <RuleList
        title="Blocked keywords"
        hint="Matches searches, the video title, and the description shown under search results. Wrap in slashes for a regex, e.g. /prank|reaction/i."
        placeholder="keyword or /regex/"
        noun="keyword"
        items={stream.keywords}
        onChange={(keywords) => update({ stream: { ...stream, keywords } })}
      />
    </>
  );
}
