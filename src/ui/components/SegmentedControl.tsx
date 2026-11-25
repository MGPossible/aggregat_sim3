export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

export interface SegmentedControlProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'normal' | 'small';
}

/** Auswahlgruppe ohne ausschließliche Maus-/Hover-Abhängigkeit (Tastatur + Touch). */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'normal',
}: SegmentedControlProps<T>): React.ReactElement {
  return (
    <div
      className={`segmented segmented--${size}`}
      role="radiogroup"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`segmented__option${option.value === value ? ' is-active' : ''}`}
          role="radio"
          aria-checked={option.value === value}
          title={option.title}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
