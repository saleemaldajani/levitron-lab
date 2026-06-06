import { CiteLink } from '../components/KatexBlock';

const ROWS = [
  {
    name: '1D Feedback (globe/lamp)',
    mechanism: 'Active electronic feedback',
    unstable: 'z only',
    electronics: 'Yes — single coil + sensor',
    duration: 'Indefinite (powered)',
    failure: 'Gain too high, loop delay, thermal drift',
  },
  {
    name: '2D Feedback (4-coil gimbal)',
    mechanism: 'Active electronic feedback',
    unstable: 'x, y',
    electronics: 'Yes — four horizontal coils',
    duration: 'Indefinite (powered)',
    failure: 'Coil imbalance, PID tuning, thermal drift',
  },
  {
    name: 'Gyroscopic Levitron',
    mechanism: 'Gyroscopic spin stabilization',
    unstable: 'Full 3D (without spin)',
    electronics: 'No (optional re-spin drive only)',
    duration: '~1 min (air friction spin-down)',
    failure: 'Spin below ω_min, tilt past critical angle, thermal drift',
  },
  {
    name: 'Dynamical rotor Levitron',
    mechanism: 'Driven rotation / frequency lock',
    unstable: 'Decoupled without δ_R ≥ δ_R^c',
    electronics: 'Yes — motor spins rotor',
    duration: 'While rotor spins',
    failure: 'δ_R too small, rotor stops, drag too high',
  },
];

export function ComparisonPage() {
  return (
    <div className="module static-page">
      <header className="module-header">
        <div>
          <h2>Comparison</h2>
          <p className="module-subtitle">
            Three escape routes from Earnshaw — which directions are unstable, and what fails first.
          </p>
        </div>
      </header>

      <div className="table-wrap">
        <table className="comparison-table">
          <thead>
            <tr>
              <th>Device</th>
              <th>Escape mechanism</th>
              <th>Unstable directions</th>
              <th>Electronics</th>
              <th>Float duration</th>
              <th>Dominant failure mode</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.mechanism}</td>
                <td>{row.unstable}</td>
                <td>{row.electronics}</td>
                <td>{row.duration}</td>
                <td>{row.failure}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="info-box">
        <p>
          As Wolfgang Ketterle noted: feedback toys are &ldquo;only unstable in one dimension&rdquo;
          or &ldquo;unstable in two dimensions,&rdquo; while the classic Levitron &ldquo;is
          gyroscopically stabilized&rdquo; and &ldquo;works just by angular momentum and magnetic
          forces.&rdquo; <CiteLink id={9} />
        </p>
      </div>
    </div>
  );
}
