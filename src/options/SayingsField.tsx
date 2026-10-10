import { useEffect, useRef, useState } from 'react';
import { PROVERBS } from '../landing';
import {
  clearSayings,
  loadSayings,
  MAX_SAYING_LENGTH,
  MAX_SAYINGS,
  parseSayings,
  saveSayings,
  type Saying,
  type SayingsState,
} from '../sayings';

const SAVE_DELAY = 400;

type UploadMode = 'replace' | 'append';

/** One editable row. The id only keeps React's keys stable while rows move. */
interface Row extends Saying {
  id: number;
}

let nextId = 0;
const toRows = (sayings: Saying[]): Row[] => sayings.map((item) => ({ ...item, id: nextId++ }));

/**
 * Your own phrases for the landing page, one row each, or the built-in ones.
 * Each phrase and its attribution are separate fields, so nothing typed here is
 * ever split or merged by a parser.
 */
export function SayingsField() {
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadMode = useRef<UploadMode>('replace');
  const saveTimer = useRef<number | undefined>(undefined);
  const [custom, setCustom] = useState<SayingsState | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [note, setNote] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  useEffect(() => {
    void loadSayings().then((state) => {
      setCustom(state);
      setRows(toRows(state ? state.sayings : PROVERBS));
    });
    return () => window.clearTimeout(saveTimer.current);
  }, []);

  /** Store the rows that have text; with none left, the built-in phrases come back. */
  const commit = (next: Row[], source: string) => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      const sayings = next
        .map((row) => ({ text: row.text.trim(), ref: row.ref.trim() }))
        .filter((item) => item.text.length > 0);
      if (sayings.length === 0) {
        void clearSayings().then(() => setCustom(null));
        return;
      }
      const state = { sayings, source };
      void saveSayings(state).then(() => setCustom(state));
    }, SAVE_DELAY);
  };

  const change = (next: Row[], source = '') => {
    setRows(next);
    commit(next, source);
  };

  const editRow = (id: number, patch: Partial<Saying>) => {
    setNote(null);
    change((rows ?? []).map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removeRow = (id: number) => {
    setNote(null);
    change((rows ?? []).filter((row) => row.id !== id));
  };

  const addRow = () => {
    setNote(null);
    // Not saved until it has text, so an empty row never replaces the built-ins.
    setRows([...(rows ?? []), ...toRows([{ text: '', ref: '' }])]);
  };

  const upload = async (file: File, mode: UploadMode) => {
    try {
      const uploaded = parseSayings(await file.text());
      const current = mode === 'append' ? (rows ?? []) : [];
      const room = Math.max(0, MAX_SAYINGS - current.length);
      const added = uploaded.slice(0, room);
      change([...current, ...toRows(added)], file.name);
      setNote({
        kind: 'ok',
        text:
          `${mode === 'append' ? 'Added' : 'Loaded'} ${added.length} phrase${added.length === 1 ? '' : 's'}` +
          (added.length < uploaded.length ? ` (capped at ${MAX_SAYINGS}).` : '.'),
      });
    } catch (error) {
      setNote({ kind: 'error', text: `Could not read that file: ${(error as Error).message}` });
    }
  };

  const pick = (mode: UploadMode) => {
    uploadMode.current = mode;
    fileInput.current?.click();
  };

  const reset = async () => {
    window.clearTimeout(saveTimer.current);
    await clearSayings();
    setCustom(null);
    setRows(toRows(PROVERBS));
    setNote(null);
  };

  const count = custom?.sayings.length ?? PROVERBS.length;
  const full = (rows?.length ?? 0) >= MAX_SAYINGS;

  return (
    <div className="field">
      <div className="field__head">
        <strong>{custom ? 'Your phrases' : 'Built-in phrases'}</strong>
        {custom ? (
          <button type="button" className="link" onClick={() => void reset()}>
            Use built-in phrases
          </button>
        ) : null}
      </div>
      <p className="section__hint">
        {count} phrase{count === 1 ? '' : 's'}
        {custom?.source ? ` from ${custom.source}` : ''}, shown one at a time in random order.
        Editing any of them switches to your own list.
      </p>

      <ol className="phrases">
        {(rows ?? []).map((row, index) => (
          <li key={row.id} className="phrase">
            <span className="phrase__num">{index + 1}</span>
            <div className="phrase__fields">
              <textarea
                className="text-input phrase__text"
                rows={2}
                value={row.text}
                maxLength={MAX_SAYING_LENGTH}
                placeholder="Phrase"
                aria-label={`Phrase ${index + 1}`}
                onChange={(event) => editRow(row.id, { text: event.target.value })}
              />
              <input
                className="text-input phrase__ref"
                value={row.ref}
                maxLength={200}
                placeholder="Attribution (optional)"
                aria-label={`Attribution for phrase ${index + 1}`}
                onChange={(event) => editRow(row.id, { ref: event.target.value })}
              />
            </div>
            <button
              type="button"
              className="phrase__remove"
              aria-label={`Remove phrase ${index + 1}`}
              title="Remove"
              onClick={() => removeRow(row.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ol>

      <div className="backup__actions">
        <button type="button" onClick={addRow} disabled={rows === null || full}>
          Add phrase
        </button>
        <button type="button" onClick={() => pick('replace')} disabled={rows === null}>
          Upload &amp; replace
        </button>
        <button type="button" onClick={() => pick('append')} disabled={rows === null || full}>
          Upload &amp; append
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".txt,.json,text/plain,application/json"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file, uploadMode.current);
            event.target.value = ''; // let the same file be picked twice
          }}
        />
      </div>
      <p className="section__hint">
        Uploads take a .json list of strings or <code>{'{ "text", "ref" }'}</code> objects, or
        a .txt file with one phrase per line and an optional attribution after
        <code> — </code>. Check the rows after uploading. Up to {MAX_SAYINGS}.
      </p>
      {note ? <p className={`backup__note backup__note--${note.kind}`}>{note.text}</p> : null}
    </div>
  );
}
