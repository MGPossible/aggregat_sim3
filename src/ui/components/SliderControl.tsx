import { useEffect, useState } from 'react';
import { formatNumber, parseNumberInput } from '../../sim/format';

export interface SliderControlProps {
  id: string;
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  decimals?: number;
  hint?: string;
  /** Zusätzliche Anzeige, z. B. % (w/v) zu mmol/L. */
  secondary?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * Schieberegler mit synchronisiertem Zahlenfeld.
 * Das Zahlenfeld akzeptiert Komma und Punkt (iPad-Tastatur) und wird erst bei
 * Enter oder Blur übernommen, damit beim Tippen keine halben Werte entstehen.
 */
export function SliderControl({
  id,
  label,
  unit,
  value,
  min,
  max,
  step,
  decimals = 1,
  hint,
  secondary,
  disabled = false,
  onChange,
}: SliderControlProps): React.ReactElement {
  const [text, setText] = useState(() => formatNumber(value, decimals));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(formatNumber(value, decimals));
  }, [value, decimals, editing]);

  const commit = (raw: string): void => {
    const parsed = parseNumberInput(raw);
    setEditing(false);
    if (parsed === null) {
      setText(formatNumber(value, decimals));
      return;
    }
    const clamped = Math.min(max, Math.max(min, parsed));
    onChange(clamped);
    setText(formatNumber(clamped, decimals));
  };

  const rangeId = `${id}-range`;
  const numberId = `${id}-number`;

  return (
    <div className={`control${disabled ? ' control--disabled' : ''}`}>
      <div className="control__head">
        <label className="control__label" htmlFor={rangeId}>
          {label}
        </label>
        <div className="control__value">
          <input
            id={numberId}
            className="control__number"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            value={text}
            disabled={disabled}
            aria-label={`${label} in ${unit}`}
            onFocus={() => setEditing(true)}
            onChange={(event) => {
              setEditing(true);
              setText(event.target.value);
            }}
            onBlur={(event) => commit(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commit(event.currentTarget.value);
              }
            }}
          />
          <span className="control__unit">{unit}</span>
        </div>
      </div>
      <input
        id={rangeId}
        className="control__range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={Math.min(max, Math.max(min, value))}
        disabled={disabled}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(next);
          setEditing(false);
          setText(formatNumber(next, decimals));
        }}
        aria-describedby={hint ? `${id}-hint` : undefined}
        aria-valuetext={`${formatNumber(value, decimals)} ${unit}`}
      />
      {(hint !== undefined || secondary !== undefined) && (
        <p className="control__hint" id={`${id}-hint`}>
          {secondary !== undefined && <span className="control__secondary">{secondary}</span>}
          {hint !== undefined && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}
