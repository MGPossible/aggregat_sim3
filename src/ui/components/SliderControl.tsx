import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
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
  /** Beschriftung links/rechts unter dem Balken. */
  rangeLabels?: [string, string];
  /** Goldene Spur (für neutre Löste wie Saccharose) statt Teel. */
  tone?: 'teal' | 'gold';
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * Schieberegler im Look der Referenzsimulation: gefüllte Spur über
 * `--range-fill`, großes rundes Thumb, synchronisiertes Zahlenfeld.
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
  rangeLabels,
  tone = 'teal',
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
  const clamped = Math.min(max, Math.max(min, value));
  const fill = `${((clamped - min) / Math.max(max - min, 1e-9)) * 100}%`;

  return (
    <div className={`slider-block${disabled ? ' control--disabled' : ''}`}>
      <div className="slider-head">
        <label htmlFor={rangeId}>{label}</label>
        <span className="slider-value">
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
        </span>
      </div>
      <input
        id={rangeId}
        className={`concentration-slider${tone === 'gold' ? ' is-gold' : ''}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={clamped}
        disabled={disabled}
        style={{ '--range-fill': fill } as CSSProperties}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(next);
          setEditing(false);
          setText(formatNumber(next, decimals));
        }}
        aria-describedby={hint || secondary ? `${id}-hint` : undefined}
        aria-valuetext={`${formatNumber(value, decimals)} ${unit}`}
      />
      {rangeLabels !== undefined && (
        <div className="range-labels">
          <span>{rangeLabels[0]}</span>
          <span>{rangeLabels[1]}</span>
        </div>
      )}
      {(hint !== undefined || secondary !== undefined) && (
        <p className="slider-hint" id={`${id}-hint`}>
          {secondary !== undefined && <strong>{secondary}</strong>}
          {hint !== undefined && <span>{hint}</span>}
        </p>
      )}
    </div>
  );
}
