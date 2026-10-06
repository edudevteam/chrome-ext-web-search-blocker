import { useEffect, useRef, useState } from 'react';
import {
  clearTabIcon,
  imageFileToIcon,
  loadTabIcon,
  onTabIconChanged,
  saveTabIcon,
  type TabIconState,
} from '../tabIcon';
import { TAB_ICON_PRESETS } from '../tabIconPresets';
import { MAX_TAB_TITLE, type Settings } from '../types';
import { Toggle } from '../ui/Toggle';

interface TabSectionProps {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
}

/** A custom title and favicon for the landing and new tab pages. */
export function TabSection({ settings, update }: TabSectionProps) {
  const { tab } = settings;
  const fileInput = useRef<HTMLInputElement>(null);
  const [icon, setIcon] = useState<TabIconState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadTabIcon().then(setIcon);
    return onTabIconChanged(setIcon);
  }, []);

  const patch = (next: Partial<Settings['tab']>) => update({ tab: { ...tab, ...next } });

  const upload = async (file: File) => {
    try {
      await saveTabIcon({ dataUrl: await imageFileToIcon(file), source: file.name });
      setError(null);
    } catch (err) {
      setError(`Could not use that file: ${(err as Error).message}`);
    }
  };

  return (
    <section className="section">
      <header className="section__head">
        <h2>Browser tab</h2>
      </header>
      <p className="section__hint">
        How the landing page and the new tab page look in the tab strip. Both are off by
        default, which keeps the page's own title and the extension's icon.
      </p>

      <div className="field">
        <Toggle
          checked={tab.customTitle}
          onChange={(customTitle) => patch({ customTitle })}
          label="Custom tab title"
          hint="Shown in place of “Not this way” and “New Tab”."
        />
        {tab.customTitle ? (
          <input
            className="text-input"
            value={tab.title}
            placeholder="Tab title"
            maxLength={MAX_TAB_TITLE}
            autoComplete="off"
            onChange={(event) => patch({ title: event.target.value })}
          />
        ) : null}
      </div>

      <div className="field">
        <Toggle
          checked={tab.customIcon}
          onChange={(customIcon) => patch({ customIcon })}
          label="Custom tab icon"
          hint="Pick one of the icons below, or upload any image — it is scaled down to a small square."
        />
        {tab.customIcon ? (
          <>
            <div className="tab-icon-grid" role="radiogroup" aria-label="Built-in icons">
              {TAB_ICON_PRESETS.map((preset) => {
                const chosen = icon?.preset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    role="radio"
                    aria-checked={chosen}
                    title={preset.label}
                    className={`tab-icon-grid__item${chosen ? ' tab-icon-grid__item--chosen' : ''}`}
                    onClick={() => {
                      setError(null);
                      void saveTabIcon({
                        dataUrl: preset.dataUrl,
                        source: preset.label,
                        preset: preset.id,
                      });
                    }}
                  >
                    <img src={preset.dataUrl} alt={preset.label} />
                  </button>
                );
              })}
            </div>
            <div className="tab-icon">
              {icon ? (
                <img className="tab-icon__preview" src={icon.dataUrl} alt="" />
              ) : null}
              <span className="section__hint">
                {icon
                  ? icon.source || 'Uploaded image'
                  : 'Nothing chosen yet — the extension icon is used.'}
              </span>
            </div>
            <div className="backup__actions">
              <button type="button" onClick={() => fileInput.current?.click()}>
                Upload image
              </button>
              {icon ? (
                <button type="button" onClick={() => void clearTabIcon()}>
                  Clear icon
                </button>
              ) : null}
              <input
                ref={fileInput}
                type="file"
                accept="image/*,.ico"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                  event.target.value = ''; // let the same file be picked twice
                }}
              />
            </div>
            {error ? <p className="backup__note backup__note--error">{error}</p> : null}
          </>
        ) : null}
      </div>
    </section>
  );
}
