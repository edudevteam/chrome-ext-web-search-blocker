import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { isOpen, loadLock, onLockChanged, unlock, verifyPassword } from '../lock';

interface LockGateProps {
  children: ReactNode;
  /** What the prompt says the password is for. */
  purpose?: string;
  /** Runs after a correct password is entered here. */
  onUnlock?: () => void;
}

const WRONG_PASSWORD_DELAY = 1000;

/** Shows its children only while there is no password or it has been entered. */
export function LockGate({ children, purpose = 'open the blocker', onUnlock }: LockGateProps) {
  const [open, setOpen] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    const check = () => void isOpen().then(setOpen);
    check();
    return onLockChanged(check);
  }, []);

  if (open === null) return <div className="loading">Loading…</div>;
  if (open) return <>{children}</>;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (checking || !password) return;
    setChecking(true);
    setWrong(false);
    const lock = await loadLock();
    if (!lock || (await verifyPassword(lock, password))) {
      await unlock();
      setPassword('');
      setChecking(false);
      onUnlock?.();
      return;
    }
    // Slow down guessing a little.
    await new Promise((resolve) => setTimeout(resolve, WRONG_PASSWORD_DELAY));
    setChecking(false);
    setWrong(true);
    setPassword('');
  };

  return (
    <form className="lock" onSubmit={(event) => void submit(event)}>
      <span className="header__mark" />
      <h1>Locked</h1>
      <p>Enter the password to {purpose}.</p>
      <input
        type="password"
        className="lock__input"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        autoComplete="current-password"
        autoFocus
      />
      <button type="submit" className="lock__button" disabled={checking || !password}>
        {checking ? 'Checking…' : 'Unlock'}
      </button>
      {wrong ? <p className="lock__error">That password is not right.</p> : null}
    </form>
  );
}
