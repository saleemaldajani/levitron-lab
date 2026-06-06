interface SliderControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

export function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  format,
}: SliderControlProps) {
  const display = format ? format(value) : value.toFixed(step < 0.01 ? 4 : step < 1 ? 2 : 0);

  return (
    <label className="slider-control">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          {display}
          {unit && <span className="slider-unit">{unit}</span>}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}

export function ToggleControl({ label, checked, onChange, hint }: ToggleControlProps) {
  return (
    <label className="toggle-control">
      <div className="toggle-row">
        <span className="slider-label">{label}</span>
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      </div>
      {hint && <span className="toggle-hint">{hint}</span>}
    </label>
  );
}

interface ButtonControlProps {
  label: string;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export function ButtonControl({ label, onClick, variant = 'secondary' }: ButtonControlProps) {
  return (
    <button type="button" className={`btn btn-${variant}`} onClick={onClick}>
      {label}
    </button>
  );
}
