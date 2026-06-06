import type { ComplexEigenvalue } from '../physics/eigenvalues';

function dedupeByLabel(eigs: ComplexEigenvalue[]): ComplexEigenvalue[] {
  const seen = new Set<string>();
  return eigs.filter((e) => {
    const key = e.label ?? `${e.re}-${e.im}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function countUnstable(eigs: ComplexEigenvalue[]): number {
  return eigs.filter((e) => e.re > 1e-4).length;
}

interface EigenvaluePanelProps {
  title: string;
  eigenvalues: ComplexEigenvalue[];
  highlightLabels?: string[];
  compareOpenLoop?: ComplexEigenvalue[];
}

export function EigenvaluePanel({
  title,
  eigenvalues,
  highlightLabels = [],
  compareOpenLoop,
}: EigenvaluePanelProps) {
  const unique = dedupeByLabel(eigenvalues);
  const maxRe = Math.max(
    0.01,
    ...unique.map((e) => Math.abs(e.re)),
    ...(compareOpenLoop?.map((e) => Math.abs(e.re)) ?? []),
  );

  return (
    <div className="eigen-panel">
      <h4>{title}</h4>
      <div className="eigen-bars">
        {unique.map((ev, i) => {
          const unstable = ev.re > 1e-4;
          const width = Math.min(100, (Math.abs(ev.re) / maxRe) * 50);
          return (
            <div key={`${ev.label}-${i}`} className="eigen-row">
              <span className="eigen-label">{ev.label ?? `λ${i + 1}`}</span>
              <div className="eigen-bar-track">
                <div
                  className={`eigen-bar ${unstable ? 'unstable' : 'stable'}`}
                  style={{
                    width: `${width}%`,
                    marginLeft: ev.re < 0 ? `${50 - width}%` : '50%',
                  }}
                />
                <div className="eigen-zero" />
              </div>
              <span className={`eigen-val ${unstable ? 'unstable' : 'stable'}`}>
                {ev.re.toFixed(2)}
                {Math.abs(ev.im) > 1e-3 ? ` ± ${Math.abs(ev.im).toFixed(2)}i` : ''}
              </span>
            </div>
          );
        })}
      </div>
      {compareOpenLoop && (
        <p className="eigen-note">
          Open-loop: {countUnstable(compareOpenLoop)} unstable root
          {countUnstable(compareOpenLoop) !== 1 ? 's' : ''} (Re &gt; 0).
          Closed-loop: {countUnstable(eigenvalues)} unstable.
        </p>
      )}
      {highlightLabels.length > 0 && (
        <p className="eigen-note">Watch: {highlightLabels.join(', ')} cross Re = 0 as you detune.</p>
      )}
    </div>
  );
}

interface EigenPlaneProps {
  eigenvalues: ComplexEigenvalue[];
  width?: number;
  height?: number;
}

export function EigenPlaneCanvas({ eigenvalues, width = 200, height = 120 }: EigenPlaneProps) {
  const unique = dedupeByLabel(eigenvalues);
  const maxMag = Math.max(1, ...unique.map((e) => Math.hypot(e.re, e.im)));

  return (
    <svg className="eigen-plane" viewBox={`0 0 ${width} ${height}`} width={width} height={height}>
      <rect x={0} y={0} width={width} height={height} fill="#0a0e14" rx={4} />
      <line x1={width / 2} y1={4} x2={width / 2} y2={height - 4} stroke="#334455" strokeWidth={1} />
      <line x1={4} y1={height / 2} x2={width - 4} y2={height / 2} stroke="#334455" strokeWidth={1} />
      <text x={width - 28} y={14} fill="#8899aa" fontSize={9}>
        Re
      </text>
      {unique.map((ev, i) => {
        const px = width / 2 + (ev.re / maxMag) * (width / 2 - 12);
        const py = height / 2 - (ev.im / maxMag) * (height / 2 - 12);
        const unstable = ev.re > 1e-4;
        return (
          <circle
            key={i}
            cx={px}
            cy={py}
            r={5}
            fill={unstable ? '#ff5252' : '#66bb6a'}
            opacity={0.9}
          />
        );
      })}
    </svg>
  );
}
