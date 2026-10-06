import { useEffect, useRef, useState } from 'react';
import { PROVERBS } from '../landing';
import {
  clearSayings,
  loadSayings,
  MAX_SAYINGS,
  onSayingsChanged,
  parseSayings,
  saveSayings,
  type SayingsState,
} from '../sayings';

/** Upload your own sayings for the landing page, or go back to the proverbs. */
export function SayingsField() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [custom, setCustom] = useState<SayingsState | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadSayings().then(setCustom);
    return onSayingsChanged(setCustom);
  }, []);

  const upload = async (file: File) => {
    try {
      const sayings = parseSayings(await file.text());
      await saveSayings({ sayings, source: file.name });
      setNote({
        kind: 'ok',
        text: `Loaded ${sayings.length} saying${sayings.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      setNote({ kind: 'error', text: `Could not read that file: ${(error as Error).message}` });
    }
  };

  const reset = async () => {
    await clearSayings();
    setNote(null);
  };

  const count = custom?.sayings.length ?? PROVERBS.length;

  return (
    <div className="field">
      <div className="field__head">
        <strong>{custom ? 'Your sayings' : 'Built-in proverbs'}</strong>
        {custom ? (
          <button type="button" className="link" onClick={() => void reset()}>
            Use proverbs
          </button>
        ) : null}
      </div>
      <p className="section__hint">
        {count} saying{count === 1 ? '' : 's'}
        {custom?.source ? ` from ${custom.source}` : ''}, shown one at a time in random order.
      </p>
      <div className="backup__actions">
        <button type="button" onClick={() => fileInput.current?.click()}>
          {custom ? 'Replace sayings' : 'Upload sayings'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = ''; // let the same file be picked twice
          }}
        />
      </div>
      <p className="section__hint">
        A .txt file with one saying per line — add an attribution after <code> — </code>,
        <code> -- </code> or <code> | </code> — or a .json list of strings or
        <code>{'{ "text", "ref" }'}</code> objects. Up to {MAX_SAYINGS}.
      </p>
      {note ? <p className={`backup__note backup__note--${note.kind}`}>{note.text}</p> : null}
    </div>
  );
}
