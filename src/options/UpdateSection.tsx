import { useEffect, useState } from 'react';
import { usePendingUpdate } from '../ui/usePendingUpdate';
import { applyUpdate, checkForUpdate, isUnpacked, type CheckResult } from '../update';

type Check = CheckResult | { status: 'idle' } | { status: 'checking' };

export function UpdateSection() {
  const pending = usePendingUpdate();
  const [unpacked, setUnpacked] = useState(false);
  const [check, setCheck] = useState<Check>({ status: 'idle' });
  const version = chrome.runtime.getManifest().version;

  useEffect(() => {
    void isUnpacked().then(setUnpacked);
  }, []);

  const runCheck = () => {
    setCheck({ status: 'checking' });
    void checkForUpdate().then(setCheck);
  };

  return (
    <section className="section">
      <header className="section__head">
        <h2>Updates</h2>
      </header>
      <p className="section__hint">
        Chrome installs new versions from the Web Store on its own, usually within a few
        hours. Updating keeps your rules, whitelist, password and images.
      </p>

      {unpacked ? (
        <div className="check check--unknown">
          <div className="check__row">
            <span className="check__icon" aria-hidden="true">
              !
            </span>
            <div>
              <strong>Loaded unpacked · v{version}</strong>
              <p>
                Chrome never updates an unpacked extension. Replace the files in the folder you
                loaded, then press the reload arrow on the extension card. Your rules stay as
                long as it is the same folder.
              </p>
            </div>
          </div>
        </div>
      ) : pending ? (
        <div className="check check--allowed">
          <div className="check__row">
            <span className="check__icon" aria-hidden="true">
              ↑
            </span>
            <div>
              <strong>Version {pending} is ready</strong>
              <p>
                You have v{version}. Restarting the extension installs the update and closes
                this page; reopen it from the toolbar afterwards.
              </p>
            </div>
          </div>
          <button type="button" onClick={applyUpdate}>
            Restart to update
          </button>
        </div>
      ) : (
        <div className="check">
          <div className="check__row">
            <span className="check__icon" aria-hidden="true">
              {check.status === 'checking' ? '…' : '✓'}
            </span>
            <div>
              <strong>Installed · v{version}</strong>
              <p>
                {check.status === 'checking'
                  ? 'Checking the Web Store…'
                  : check.status === 'downloading'
                    ? `Version ${check.version} found and downloading. A restart button appears here when it is ready.`
                    : check.status === 'current'
                      ? 'You have the latest version.'
                      : check.status === 'throttled'
                        ? 'Chrome limits how often an extension can check. Try again in a few minutes.'
                        : check.status === 'failed'
                          ? 'The check could not reach the Web Store. Try again later.'
                          : 'Check now to fetch an update without waiting for Chrome.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={runCheck}
            disabled={check.status === 'checking' || check.status === 'downloading'}
          >
            Check for updates
          </button>
        </div>
      )}
    </section>
  );
}
