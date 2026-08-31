interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function Toggle({ checked, onChange, label, hint, disabled }: ToggleProps) {
  return (
    <label className={`toggle${disabled ? ' toggle--disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle__track" aria-hidden="true">
        <span className="toggle__thumb" />
      </span>
      <span className="toggle__text">
        <span className="toggle__label">{label}</span>
        {hint ? <span className="toggle__hint">{hint}</span> : null}
      </span>
    </label>
  );
}
