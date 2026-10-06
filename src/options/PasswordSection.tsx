import { useEffect, useState, type FormEvent } from 'react';
import {
  loadLock,
  MIN_PASSWORD_LENGTH,
  onLockChanged,
  relock,
  removePassword,
  setGuardExtensions,
  setPassword,
  UNLOCK_MINUTES,
  type LockState,
} from '../lock';
import { Toggle } from '../ui/Toggle';

export function PasswordSection() {
  // undefined = still loading, null = no password set.
  const [lock, setLock] = useState<LockState | null | undefined>(undefined);
  const [changing, setChanging] = useState(false);
  const [first, setFirst] = useState('');
  const [second, setSecond] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () => void loadLock().then(setLock);
    load();
    return onLockChanged(load);
  }, []);

  if (lock === undefined) return null;

  const showForm = !lock || changing;

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (first.length < MIN_PASSWORD_LENGTH) {
      setError(`Use at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (first !== second) {
      setError('The two passwords do not match.');
      return;
    }
    await setPassword(first, lock?.guardExtensions ?? false);
    setFirst('');
    setSecond('');
    setError(null);
    setChanging(false);
  };

  const remove = () => {
    if (window.confirm('Remove the password? The popup, this page and the extensions page open freely again.')) {
      void removePassword();
    }
  };

  return (
    <section className="section">
      <header className="section__head">
        <h2>Password</h2>
      </header>
      <p className="section__hint">
        {lock
          ? `The popup and this page ask for the password. Once entered, it stays unlocked for ${UNLOCK_MINUTES} minutes or until the browser quits.`
          : 'Ask for a password before the popup or this page will open. There is no way to recover a forgotten password, so keep it somewhere safe.'}
      </p>

      {showForm ? (
        <form className="field password-form" onSubmit={(event) => void save(event)}>
          <input
            type="password"
            className="text-input"
            value={first}
            onChange={(event) => setFirst(event.target.value)}
            placeholder={lock ? 'New password' : 'Password'}
            autoComplete="new-password"
          />
          <input
            type="password"
            className="text-input"
            value={second}
            onChange={(event) => setSecond(event.target.value)}
            placeholder="Type it again"
            autoComplete="new-password"
          />
          <div className="backup__actions">
            <button type="submit">{lock ? 'Change password' : 'Set password'}</button>
            {changing ? (
              <button
                type="button"
                onClick={() => {
                  setChanging(false);
                  setError(null);
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {error ? <p className="backup__note backup__note--error">{error}</p> : null}
        </form>
      ) : (
        <div className="backup__actions">
          <button type="button" onClick={() => void relock()}>
            Lock now
          </button>
          <button type="button" onClick={() => setChanging(true)}>
            Change password
          </button>
          <button type="button" onClick={remove}>
            Remove password
          </button>
        </div>
      )}

      <div className="field">
        <Toggle
          checked={lock?.guardExtensions ?? false}
          disabled={!lock}
          onChange={(guard) => void setGuardExtensions(guard)}
          label="Guard the extensions page"
          hint={
            lock
              ? 'Opening chrome://extensions asks for the password first, so the blocker cannot be switched off or removed from there.'
              : 'Set a password first.'
          }
        />
        <p className="section__hint">
          A browser extension cannot fully stop its own removal. Right-clicking its toolbar
          icon and choosing &ldquo;Remove&rdquo; still works, and so does deleting the browser
          profile. To make it impossible to remove, install it by policy — see the README.
        </p>
      </div>
    </section>
  );
}
