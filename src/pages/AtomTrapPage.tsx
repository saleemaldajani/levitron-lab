import { CiteLink, KatexBlock } from '../components/KatexBlock';

export function AtomTrapPage() {
  return (
    <div className="module static-page">
      <header className="module-header">
        <div>
          <h2>From Toy to Atom Trap</h2>
          <p className="module-subtitle">
            Why a Nobel laureate keeps a Levitron on his desk — the same physics that levitates atoms.
          </p>
        </div>
      </header>

      <div className="atom-trap-page">
        <div className="analogy-diagram">
          <div className="trap-column">
            <div className="trap-icon levitron-icon" />
            <h3>Macroscopic Levitron</h3>
            <ul>
              <li>Ferrite or neodymium dipole top</li>
              <li>Spin angular momentum ℏ → macroscopic Iω</li>
              <li>Adiabatic following of local B field</li>
              <li>Berry phase creates effective potential minimum</li>
              <li>Stable window ω_min &lt; ω &lt; ω_max</li>
            </ul>
          </div>

          <div className="trap-bridge">
            <KatexBlock display math="\text{same mathematics}" />
            <span className="bridge-arrow">⟷</span>
          </div>

          <div className="trap-column">
            <div className="trap-icon atom-icon" />
            <h3>Magnetic atom trap</h3>
            <ul>
              <li>Neutral atom with magnetic moment μ</li>
              <li>Spin angular momentum from unpaired electron</li>
              <li>Adiabatic following in inhomogeneous B</li>
              <li>Weak-field seeking / strong-field seeking states</li>
              <li>Trapped at field minimum or maximum</li>
            </ul>
          </div>
        </div>

        <div className="prose-block">
          <p>
            Earnshaw forbids static trapping of a dipole — yet both the Levitron and a magneto-optical
            / magnetic trap for neutral atoms evade the theorem. In the classic Levitron, the spinning
            top's angular momentum lets its magnetic moment stay aligned with the local field as it
            moves, producing an effective potential with a true minimum (Berry, 1996).
          </p>
          <KatexBlock display math="U_{\mathrm{eff}} = U_{\mathrm{mag}} - \frac{(\boldsymbol{\mu}\cdot\mathbf{B})^2}{2I\omega^2} + \cdots" />
          <p>
            An atom has spin and angular momentum — &ldquo;so the atom is a little gyroscope,&rdquo; as
            Ketterle put it. The tabletop toy is a macroscopic model of how neutral atoms are
            levitated in vacuum, manipulated with magnetic fields, and cooled to nanokelvin
            temperatures on the path to Bose–Einstein condensation. <CiteLink id={6} />{' '}
            <CiteLink id={7} /> <CiteLink id={9} />
          </p>
        </div>
      </div>
    </div>
  );
}
