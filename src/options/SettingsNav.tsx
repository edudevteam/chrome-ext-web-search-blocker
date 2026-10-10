import type { ReactNode } from 'react';

export type SettingsPane = 'diagnostics' | 'search' | 'redirect' | 'tab' | 'password' | 'backup';

// Stroke icons on a 24px grid; they inherit currentColor from the button.
const ICONS: Record<SettingsPane, ReactNode> = {
  diagnostics: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  redirect: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m5.6 5.6 12.8 12.8" />
    </>
  ),
  tab: (
    <>
      <rect x="3" y="5" width="18" height="15" rx="2" />
      <path d="M3 10h18M8 5v5" />
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
};

export const SETTINGS_PANES: { id: SettingsPane; label: string }[] = [
  { id: 'diagnostics', label: 'Diagnostics' },
  { id: 'search', label: 'Search types' },
  { id: 'redirect', label: 'Opening a blocked site' },
  { id: 'tab', label: 'Browser tab' },
  { id: 'password', label: 'Password' },
  { id: 'backup', label: 'Backup' },
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
