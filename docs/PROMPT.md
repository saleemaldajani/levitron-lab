# Claude Code Prompt — "The Levitron Lab": An Interactive Physics-Toy Website

Paste everything below into Claude Code.

---

Build a single-page educational website called **The Levitron Lab** — a collection of interactive physics simulations ("scientific toys") that teach how different types of magnetic levitation work. Each levitron type gets its own self-contained interactive webapp with live sliders on every physical parameter, real-time numerical simulation, and embedded teaching text. The site is both a *playground* (fiddle with real-device-like behavior, including the way these toys drift and crash) and a *curriculum* (physics introduced in increasing dimensional complexity).

This project grew out of a conversation with Wolfgang Ketterle about the physics of these toys, and it is meant to support a teaching statement. Keep the tone that of a beautiful, precise science-museum exhibit.

## Tech stack & constraints
- Use **React** + **Vite**. Plain JS/TS, no backend.
- Physics rendering: `<canvas>` (2D) for cross-sections / potential curves / phase plots and **three.js** for the 3D scenes.
- Numerical integration in-browser (RK4 or semi-implicit Euler at fixed dt, requestAnimationFrame loop). Each sim deterministic and resettable.
- All state in React (no localStorage). Runs fully offline.
- Mobile-responsive; sliders must work on touch.
- Render equations with KaTeX inline beside each toy.

## THE CENTRAL PHYSICS FRAMING (read first — this drives the whole design)

Every form of static permanent-magnet levitation is forbidden by **Earnshaw's theorem**: a magnetic dipole in a static field has no stable equilibrium — wherever forces balance, it's a saddle, stable along some axes and unstable along others. There are exactly **three escape routes**, and the site is organized around them:

1. **Active electronic feedback** — make the field *time-varying*. A sensor measures position and a circuit corrects a coil current. This is how the modern "levitating globe / lamp / floating-duck" toys work. Crucially, these are only unstable along *some* axes and naturally stable along the rest, so feedback only has to fix the unstable directions.
2. **Gyroscopic spin stabilization** — the classic Levitron. The spinning top is a little gyroscope; its angular momentum lets its magnetic moment adiabatically follow the local field, converting the saddle into a true potential minimum. **It is stabilized by angular momentum + magnetic force ALONE — there is no electronics and the spin is not driven for stability.** (Any electromagnetic drive you see on lab versions only re-spins the top against air friction; it is *not* part of the trap.)
3. **Driven rotation** — a motor-spun rotor magnet drags a floater into frequency-locked rotation and traps it (the newest, Ucar/Bjørk type).

A direct quote from Ketterle to honor in the framing: the feedback toys are *"only unstable in one dimension"* or *"unstable in two dimensions,"* while the classic Levitron *"is gyroscopically stabilized"* and *"works just by angular momentum and magnetic forces."* And the deep payoff: **the classic Levitron is a tabletop model of how a neutral atom is levitated in a magnetic trap** — "an atom has spin, angular momentum… so the atom is a little gyroscope," which is literally why a Nobel-laureate atomic physicist keeps one on his desk.

## Dimensionality ladder (the curriculum order — taken directly from how Ketterle classified his own devices)

Order the modules by *which directions are unstable*, climbing the ladder:

- **0D conceptual** — Earnshaw primer.
- **1D feedback** — the vertical maglev lamp/globe: stable in the two horizontal directions, unstable **only in z**. One magnet/coil, feedback on its strength.
- **2D feedback** — the gimbal / 4-coil PID levitator: stable in z, unstable in **x and y**. Four coils acting in the horizontal plane. Mathematically a *different* instability from the 1D case — make this contrast explicit.
- **3D gyroscopic** — the classic spinning Levitron: no electronics at all; full 6-DOF rigid-body top.
- **3D driven-rotation** — the rotating-rotor "dynamical Levitron."

## Information architecture
Left nav / top tabs following the ladder above. Each module has: (a) interactive sim with sliders, (b) a "What's happening" physics panel with KaTeX equations, (c) a "Try this" experiment prompt, (d) a live **Stability Status** badge (LEVITATING / DRIFTING / CRASHED / FLEW OFF), and (e) source citations.

### Module 0 — "Why this is hard: Earnshaw's theorem"
- 1D toy: two bar magnets on a vertical axis, fixed below, free above. Sliders: separation, magnet strength, floater mass.
- Plot F(z) = F_mag(z) − mg and U(z). Let the user hunt for equilibrium and discover it's always an *unstable* maximum (∂²U/∂z² < 0 where F = 0).
- Teaching point: static passive levitation is impossible → three escape routes (feedback / gyroscopic spin / driven rotation), previewing the modules.

### Module 1 — "1D Active Feedback Levitator" (the floating globe / lamp / duck)
- The cleanest case: a single electromagnet above, object below, gap sensed and corrected. **Frame it exactly as Ketterle did: stable in the two horizontal dimensions, feedback needed only in the longitudinal (z) direction.**
- Sliders: setpoint gap, proportional gain Kp, derivative gain Kd, **magnet/coil base strength (single magnet)**, sensor noise, coil max current, object mass (add weight → note Ketterle's observation that *adding weight makes it more stable*), control-loop delay, and a **temperature** slider that slowly detunes the coil/magnet.
- Sim: 1D EOM m·z'' = F_coil(I) − mg, I = clamp(Kp·err + Kd·err'), optional latency buffer. Behaviors to reproduce: crank gain too high → oscillation/instability ("the feedback was too strong"); add delay → crash; warm it up → slow drift downward until it falls. Include a "trim pot" slider mirroring the real adjustable feedback.
- Plots: gap-vs-time and coil-current-vs-time, live.
- Map to hardware: "This is the levitating-globe class — break the plastic shell off and inside is a magnet; a sensor measures the gap and a circuit drives one coil thousands of times per second. Stable left/right on its own; only the vertical needs help."

### Module 2 — "2D Feedback Levitator" (the 4-coil gimbal / PID)
- **The mathematically distinct sibling of Module 1:** here the device is stable in z but **unstable in x and y**, corrected by **four coils acting in the horizontal plane** (look-from-the-top view showing the 4 coils).
- Sliders: per-axis gains (Kp_xy, Kd_xy), the four coil strengths (with a small imbalance slider to mimic manufacturing drift), payload mass, payload offset, temperature drift, loop delay, sensor noise.
- Sim: 2D horizontal feedback m·x'' = F_x(I_x) , m·y'' = F_y(I_y) with the passive vertical handled as stable. Show that the instability lives in (x,y) — push it off-center and watch the four coils fight to recenter; detune one coil and watch it drift then crash.
- Physics panel: contrast with Module 1 via the differential-equation eigenvalues — *"you can show by analysis of the differential equation that this one has an instability in x and y, and that one has an instability in z."* Two top-view phase portraits side by side (1D vs 2D unstable manifolds).

### Module 3 — "3D Gyroscopic Levitron" (the classic spinning top — the *real* Levitron)
- Full 3D three.js rigid-body top above a ring/plate base. **No electronics.** Make explicit that lift = magnetic repulsion and stability = spin angular momentum, full stop.
- Sliders: top mass (add/remove "washers"), base field strength, base ring inner/outer radius, **spin rate ω (rps)**, launch height, lateral offset, **launch tilt / nutation angle**, magnet **temperature**, and an **impulse "nudge" button** to test restoring behavior.
- Sim: integrate the full Lagrangian-top / dipole-in-field equations (Euler equations for the spinning top + translational EOM), implementing **Berry's adiabatic effective potential** so a genuine local minimum exists only when ω lies between ω_min (~19 rps) and ω_max. Outside the window → it flips/crashes or flies off.
- **Two behaviors that must be faithfully reproduced, both raised in the Ketterle conversation:**
  - **Nutation/tilt window:** there is a finite allowable tilt before it crashes — "it only works when it's nice and upright." Expose a computed **critical nutation angle** readout and let the user find it by sweeping the tilt slider (tie this to the 8.225-style Lagrangian-top analysis).
  - **Air friction + spin-down:** with no drive, air drag bleeds ω; show a live spin-rate gauge falling toward ω_cutoff and the top crashing after ~tens of seconds to a minute. Add an optional **"electromagnetic re-spin drive" toggle** that maintains ω via a rotating field — and label clearly that this drive maintains spin against air friction and is **NOT** what provides stability.
  - **Temperature drift:** warming the magnets lowers the field and shifts the equilibrium; reproduce the "worked for a year then winter came and it crashed" failure mode.
- Plots: synchronized U(z) vertical well and U(r) lateral well; a stability-window gauge showing where current ω sits between ω_cutoff and ω_max; ratio ω_min/ω_max ≈ O(1/3) for ferrite tops.
- **Atom-trap analogy panel (the centerpiece):** a side-by-side showing the spinning top ↔ a spin-½ neutral atom in a magnetic trap. Same math: angular momentum makes the moment adiabatically follow the field (Berry phase), producing a trapping minimum. State plainly that this device is a macroscopic demonstration of how atoms are magnetically levitated in a vacuum chamber.
- **Inclined / Horizontal-axis (Michaelis) toggle:** add an overhead *puller* magnet (slider for strength/height) and magnetic "V" guides to tilt the stable spin axis to 45° and 90° — a static "macro-trap" superposed on the gyroscopic "micro-trap."

### Module 4 — "3D Dynamical Levitron" (driven rotating-rotor levitation; Ucar / Bjørk / Doff–Szmoski)
- A motor-driven rotor magnet (pole axis ⟂ rotation axis, ~7,500–17,000 rpm) above a floater that frequency-locks and is trapped a few cm below.
- Sliders: rotor rpm, rotor–floater geometry, floater mass, floater magnetic moment, **lateral-displacement parameter δ_R** (the key knob), rotor-axis tilt, rotational drag ξ^R, translational drag ξ^T.
- Sim: integrate the floater dipole EOM under the rotating rotor field using the paper's Taylor-expanded dipole force and U_f(z_f) (arXiv eqs. 7–11). Reproduce: floater spinning **up** to a locked ratio R_f = ω_f/ω_R = sinθ_f; the trap forming only when **δ_R ≥ δ_R^c** (decoupled → coupled); and the striking result that the floater can be trapped **even at rest**.
- Plots: U_f(z_f) morphing as δ_R crosses δ_R^c; the near-perpendicular locked orientation of the two magnetic axes.
- Physics panel: contrast with the classic Levitron — here trapping is set by rotor geometry (δ_R), **not** by tuning the floater's spin. Note the ω_min/ω_max ≈ O(1/25) estimate for neodymium.

## Cross-cutting features
- Persistent **Stability Status** badge per sim; a **Reset** and an **"auto-stable preset"** button so a frustrated user can always see it work (Saleem's own use case: walk into the office, it's crashed, reset it, get to work).
- A **comparison page** with a table summarizing, for each type: the escape-from-Earnshaw mechanism (feedback / gyroscopic spin / driven rotation), which directions are unstable (z only / x,y / full 3D), whether electronics are required, typical float duration, and dominant failure mode (gain too high, thermal drift, spin-down, tilt past critical angle).
- A short **"From toy to atom trap"** explainer page making the Ketterle analogy: gyroscopic Levitron <-> magnetic trapping of spin-carrying neutral atoms.
- Museum-exhibit aesthetic: dark background, a soft glow on the levitating object, restrained typography. Should feel like a polished interactive kiosk.
- Each physics panel cites its sources with links, and each citation links down to the full **References** section described below.

## References section (a dedicated page / clearly delimited section at the bottom of the site)
Render a complete, numbered, academically formatted reference list. Every entry must be a live clickable link to the exact URL. Keep all of these links verbatim — do not drop, shorten, or substitute any of them. Each physics-panel citation throughout the site should anchor-link to the matching entry here.

1. MIT VIZ Group, "Physics Behind the Levitron." https://web.mit.edu/viz/levitron/Physics.html
2. MIT VIZ Group, "Levitron — How To." https://web.mit.edu/viz/levitron/How_To.html
3. Doff, A. & Szmoski, R. M., "Magnetic levitation by rotation described by a new type of Levitron," arXiv:2506.23268. https://arxiv.org/html/2506.23268v2
4. Berkowitz, R., "How Rotation Drives Magnetic Levitation," Physics (APS) 16, 177. https://physics.aps.org/articles/v16/177
5. Hermansen, J. M. et al., "Magnetic levitation by rotation," Phys. Rev. Applied 20, 044036 (2023). https://journals.aps.org/prapplied/abstract/10.1103/PhysRevApplied.20.044036
6. Berry, M. V., "The Levitron: an adiabatic trap for spins," Proc. R. Soc. Lond. A 452, 1207–1220 (1996). https://michaelberryphysics.wordpress.com/wp-content/uploads/2013/07/berry271.pdf
7. Simon, M. D., Heflinger, L. O. & Ridgway, S. L., "Spin stabilized magnetic levitation," Am. J. Phys. 65, 286–292 (1997). https://www.physics.ucla.edu/marty/levitron/spinstab.pdf
8. "Spin-stabilized magnetic levitation," Wikipedia. https://en.wikipedia.org/wiki/Spin-stabilized_magnetic_levitation
9. Personal communication — conversation with Prof. Wolfgang Ketterle (MIT, Nobel Laureate in Physics 2001), June 2026: on the classification of levitating toys by which directions are unstable, gyroscopic stabilization by angular momentum and magnetic force alone, thermal-drift and air-friction failure modes, and the analogy between the gyroscopic Levitron and the magnetic trapping of neutral atoms. Source of the project's framing and the closing epigraph.

Style the entry for reference 9 (the Ketterle conversation) like a standard "personal communication" citation so it reads as a legitimate, attributed source on equal footing with the literature.

## Footer
Render this quote, attributed, in elegant centered type at the very bottom of every page:

> "We share a passion for scientific toys" — Wolfgang Ketterle

## Deliverable
A runnable Vite project: `npm install && npm run dev` opens the site with all modules working, sliders live, sims animating, equations rendering. Organize each module as its own React component with a paired physics module file (e.g. `physics/feedback1D.ts`, `physics/feedback2D.ts`, `physics/gyroscopic.ts`, `physics/dynamicalRotor.ts`). Comment each equation back to its source. Prioritize correct *qualitative* behavior — stability windows and instabilities appearing/disappearing as sliders cross thresholds — over quantitative precision, but use realistic parameter ranges from the references and from the device descriptions above (e.g. classic top float ~1 minute on air friction, omega_cutoff ~19 rps, rotor 7,500-17,000 rpm).
