# Follow-up Prompt #2 — The Levitron Lab (nutation-angle physics in the gyroscopic module)

Paste this into the running Claude Code session after the previous follow-up completes. Keep everything already built; this deepens the nutation/tilt treatment in Module 3 (the gyroscopic spinning Levitron), which was a central point in the source conversation and deserves to be a fully realized, visualized feature rather than a single readout.

---

## Context
The classic gyroscopic Levitron does not just need to be within its spin-rate window — it is also **sensitive to the nutation (tilt) angle of its spin axis**. In practice it "only works when it's nice and upright": there is a finite cone of allowable tilt, and if the top leans past a critical angle it falls out of the trap and crashes. This is the behavior analyzed in a classical-mechanics (Lagrangian rigid-body / spinning-top) treatment, and it is distinct from the spin-rate stability window. Make this a first-class, interactive, visualized part of Module 3.

## What to add / strengthen in Module 3

### 1. Model nutation explicitly in the dynamics
- Treat the top as a symmetric rigid body with the standard Euler-angle description: spin ψ about its symmetry axis, precession φ about the vertical, and **nutation θ** (the tilt of the symmetry axis away from vertical). Integrate the full Euler equations already specified for this module, ensuring θ is a live dynamical variable, not a fixed parameter.
- The effective magnetic trap acts on the projection of the magnetic moment along the local field; as θ grows, the restoring behavior weakens. Above a **critical nutation angle θ_c**, the adiabatic-following condition breaks and the equilibrium is lost — the top flips/precesses away and crashes.

### 2. Show nutation in the live 3D visual (not just a number)
- In the three.js scene, render the top's symmetry axis visibly **nutating** — the characteristic nodding/wobble superimposed on the steady precession. The tilt of the spin axis from vertical should be clearly legible.
- Draw a translucent **"allowable tilt cone"** around the vertical at the half-angle θ_c. While the top's axis stays inside the cone it stabilizes; when a disturbance pushes the axis outside the cone, show it diverging and crashing. This makes "it only works when upright" something the user can see.
- The existing impulse/"nudge" button should perturb the nutation angle, letting the user watch the axis nod and either settle back (inside the cone) or tumble out (past θ_c).

### 3. Make θ_c interactive and quantitative
- Keep the launch tilt / initial nutation-angle slider, and add a **live readout of the current nutation angle θ(t)** alongside the **computed critical angle θ_c**.
- Recompute θ_c as the user changes spin rate, top mass, and base field strength — i.e. show that the allowable tilt cone *shrinks* as spin drops toward ω_cutoff or as the magnets warm (temperature slider). This couples the nutation story to the spin-rate window and thermal-drift story already in the module.
- Add a small **θ(t) trace plot** (nutation angle vs time) as a side panel showing the nodding oscillation: bounded and decaying when stable, growing when the top is about to crash.

### 4. Teaching panel
- Add a short physics panel explaining nutation as the third Euler angle of a spinning top, why a fast-enough spin keeps the nod small (gyroscopic rigidity), and why there is a finite tilt tolerance rather than zero or infinite. Note that this is the same rigid-body spinning-top mechanics treated in a classical-mechanics course (Lagrangian top), and that the nutation tolerance is computable — let the user verify the computed θ_c by experiment with the tilt slider and nudge button.
- Tie it back to the framing: the spin-rate window keeps the moment adiabatically following the field; the nutation-angle window keeps the axis upright enough for that following to hold. Both must be satisfied for levitation.

## Summary
Net effect: Module 3 now treats nutation as a live dynamical variable, visualizes the nodding spin axis and an allowable-tilt cone in 3D, reports both the instantaneous nutation angle and the critical angle θ_c, shows θ_c shrinking as spin or field weakens, and explains the physics. This realizes the "it only works when it's nice and upright, and you can calculate the allowable angle" point in full.
