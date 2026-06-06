interface SimControlsProps {
  onReset: () => void;
  onPreset: () => void;
}

export function SimControls({ onReset, onPreset }: SimControlsProps) {
  return (
    <div className="sim-controls">
      <button type="button" className="btn btn-secondary" onClick={onReset}>
        Reset
      </button>
      <button type="button" className="btn btn-primary" onClick={onPreset}>
        Auto-stable preset
      </button>
    </div>
  );
}
