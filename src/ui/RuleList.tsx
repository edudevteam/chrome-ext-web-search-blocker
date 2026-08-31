import { useState, type FormEvent } from 'react';

interface RuleListProps {
  title: string;
  hint: string;
  placeholder: string;
  noun: string;
  items: string[];
  onChange: (items: string[]) => void;
  /** Applied before an item is added (e.g. URL -> bare domain). */
  normalize?: (raw: string) => string;
}

/** Feedback that confirms an edit without printing what was blocked. */
type Note = { text: string } | null;

export function RuleList({
  title,
  hint,
  placeholder,
  noun,
  items,
  onChange,
  normalize,
}: RuleListProps) {
  const [draft, setDraft] = useState('');
  // Always starts closed. Persisting "open" would defeat the point of hiding it.
  const [revealed, setRevealed] = useState(false);
  const [note, setNote] = useState<Note>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const entries = draft
      .split(/[\n,]/)
      .map((part) => (normalize ? normalize(part) : part.trim()))
      .filter(Boolean);
    if (entries.length === 0) return;

    const seen = new Set(items.map((item) => item.toLowerCase()));
    const additions = entries.filter((entry) => {
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (additions.length > 0) onChange([...items, ...additions]);
    setDraft('');
    setNote({
      text:
        additions.length === 0
          ? `Already on the list — nothing added.`
          : `Added ${additions.length} ${noun}${additions.length === 1 ? '' : 's'}.`,
    });
  };

  return (
    <section className="section">
      <header className="section__head">
        <h2>{title}</h2>
        <span className="section__count">{items.length}</span>
      </header>
      <p className="section__hint">{hint}</p>

      <form className="rule-add" onSubmit={add}>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
        />
        <button type="submit" disabled={draft.trim().length === 0}>
          Add
        </button>
      </form>

      {note ? <p className="rule-note">{note.text}</p> : null}

      {items.length > 0 ? (
        <div className="rule-vault">
          <div className="rule-vault__head">
            <span className="rule-vault__count">
              {revealed
                ? `${items.length} ${noun}${items.length === 1 ? '' : 's'}`
                : `${items.length} ${noun}${items.length === 1 ? '' : 's'} hidden`}
            </span>
            <button
              type="button"
              className="link"
              aria-expanded={revealed}
              onClick={() => setRevealed((open) => !open)}
            >
              {revealed ? 'Hide' : 'Show list'}
            </button>
          </div>

          {revealed ? (
            <ul className="chips">
              {items.map((item) => (
                <li key={item} className="chip">
                  <span className="chip__text" title={item}>
                    {item}
                  </span>
                  <button
                    type="button"
                    className="chip__remove"
                    aria-label={`Remove ${item}`}
                    onClick={() => onChange(items.filter((entry) => entry !== item))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
