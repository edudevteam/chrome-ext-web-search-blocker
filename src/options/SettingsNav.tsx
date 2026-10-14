import type { ReactNode } from 'react';

export type SettingsPane =
  | 'diagnostics'
  | 'search'
  | 'stream'
  | 'redirect'
  | 'tab'
  | 'password'
  | 'backup'
  | 'update';

// Stroke icons on a 24px grid; they inherit currentColor from the button.
const ICONS: Record<SettingsPane, ReactNode> = {
  diagnostics: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  // A video player: a screen with a play triangle.
  stream: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m10 9 5 3-5 3Z" />
    </>
  ),
  redirect: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 10h18M8 5v5" />
    </>
  ),
  // A favicon-style badge: a rounded tile with a sparkle mark.
  tab: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8c.4 2.6 1.4 3.6 4 4-2.6.4-3.6 1.4-4 4-.4-2.6-1.4-3.6-4-4 2.6-.4 3.6-1.4 4-4Z" />
    </>
  ),
  password: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  backup: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </>
  ),
  // Two arrows chasing each other round: refresh.
  update: (
    <>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4" />
    </>
  ),
};

export const SETTINGS_PANES: { id: SettingsPane; label: string }[] = [
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'search', label: 'Search types' },
  { id: 'stream', label: 'Streams' },
  { id: 'redirect', label: 'Opening a blocked site' },
  { id: 'tab', label: 'Browser tab' },
  { id: 'password', label: 'Password' },
  { id: 'backup', label: 'Backup' },
  { id: 'update', label: 'Updates' },
];

interface Props {
  active: SettingsPane;
  onSelect: (pane: SettingsPane) => void;
}

export function SettingsNav({ active, onSelect }: Props) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {SETTINGS_PANES.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          aria-current={active === id ? 'page' : undefined}
          data-hint={label}
          className={`settings-nav__item${active === id ? ' settings-nav__item--active' : ''}`}
          onClick={() => onSelect(id)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            {ICONS[id]}
          </svg>
        </button>
      ))}
    </nav>
  );
}
