interface SimControlsProps {
  onReset: () => void;
  onPreset: () => void;
  onNudge?: () => void;
  nudgeLabel?: string;
}

export function SimControls({ onReset, onPreset, onNudge, nudgeLabel = 'Nudge' }: SimControlsProps) {
  return (
    <div className="sim-controls">
      <button type="button" className="btn btn-secondary" onClick={onReset}>
        Reset
      </button>
      {onNudge ? (
        <button type="button" className="btn btn-secondary" onClick={onNudge}>
          {nudgeLabel}
        </button>
      ) : null}
      <button type="button" className="btn btn-primary" onClick={onPreset}>
        Auto-stable preset
      </button>
    </div>
  );
}
