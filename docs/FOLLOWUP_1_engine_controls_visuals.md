# Follow-up Prompt — The Levitron Lab (physics engine, controls, and visualization refinements)

Paste this into the running Claude Code session. These are refinements to the work already in progress — keep everything already built and apply the following across the relevant modules.

---

## 1. Every module must show the levitating object itself, not just plots

This is the most important point: each of the five webapp modules must include a **live visual of the thing levitating** — the floating object hovering, wobbling, drifting, spinning, and crashing in real time — as the centerpiece of that module. The potential-energy curves, phase portraits, and gauges are *secondary* panels alongside it, never a replacement for it. A user should always be looking at a hovering object that visibly responds to every slider.

Specifics per module:

- **Module 0 (Earnshaw primer):** show the free magnet above the fixed magnet, visibly sliding off or snapping down to the equilibrium and failing to stay — the visual proof that the balance point is unstable. The F(z) and U(z) plots sit beside it.
- **Module 1 (1D feedback globe/lamp):** render the floating globe/object hovering under the electromagnet, bobbing vertically toward setpoint, sagging when warmed, oscillating when the gain is too high, and dropping when it crashes. The gap-vs-time and current-vs-time plots are side panels.
- **Module 2 (2D feedback gimbal):** render the object hovering with a clear top-down view showing the four coils, the object drifting in x–y when detuned and being pulled back to center. Phase portraits are side panels.
- **Module 3 (gyroscopic Levitron):** full **three.js** spinning top hovering above the base — visibly spinning, precessing, nutating, tilting, and crashing or flying off when it leaves the stability window. The U(z)/U(r) wells and spin-rate gauge are side panels. This 3D hovering top is the signature visual of the whole site.
- **Module 4 (dynamical rotor):** three.js scene with the driven rotor spinning above and the floater hovering below it, spinning up into frequency-lock, settling at its trapped height, and falling out of the trap when δ_R drops below δ_R^c. The U_f(z_f) plot is a side panel.

For the 2D/3D scenes use three.js; for the 1D/0D scenes a clean canvas or lightweight three.js scene is fine — but in all cases the floating object is animated and on-screen at all times. Give it a soft glow and a subtle shadow/reference plane so the hover height is legible. The Stability Status badge should visually track what the object is doing.

## 2. Make the controllers true PID, not just PD

Modules 1 and 2 currently use a Kp·err + Kd·err' law. Add the integral term so the control law is:

`I = clamp(Kp·err + Ki·∫err·dt + Kd·d(err)/dt, 0, I_max)`

- Expose a **Ki slider** in both feedback modules.
- Implement **integral-windup protection**: cap the integral accumulator and freeze it when the actuator saturates.
- Teaching payoff: when the **temperature / thermal-drift** slider warms the system, with Ki = 0 the floating object settles *below* setpoint (visible steady-state sag); raising Ki pulls it back exactly to setpoint. This makes visible why real levitating-globe toys need the integral term, and connects to the thermal-failure story from the Ketterle conversation.
- Add one sentence per physics panel explaining each of P, I, and D in terms of what the floating object visibly does (P = pushes back proportionally to displacement, I = erases slow drift/sag, D = damps oscillation).

## 3. Make the ODE simulation robust and explicit

These magnetic-feedback systems are numerically stiff, so:

- Run the **physics integrator on a fixed internal timestep** (e.g. dt = 1 ms) decoupled from the render loop, using an **accumulator pattern** (fixed-step substeps per animation frame) so behavior is frame-rate-independent and reproducible.
- Use **RK4** for the gyroscopic top and dynamical-rotor modules (Modules 3–4). **Semi-implicit (symplectic) Euler** is acceptable for the feedback modules (1–2), but keep the fixed-step accumulator.
- Add a **simulated control-loop rate** separate from the physics rate (e.g. controller updates at ~1 kHz) so the control-loop-delay slider is meaningful — the controller samples-and-holds while the physics integrates continuously between samples.
- Guard against blow-up: clamp state magnitudes, and if the integrator diverges, set Stability Status to **CRASHED** and freeze/reset the visual rather than rendering NaNs or letting the object fly to infinity.

## 4. Operationalize the eigenvalue teaching point in Module 2 (and Module 1)

Don't just assert that the 1D device is unstable in z and the 2D device in x,y — compute and show it:

- Linearize the equations of motion about the equilibrium, form the **Jacobian**, and compute its **eigenvalues numerically** each time the parameters change.
- Display the eigenvalues live — e.g. small bar/marker indicators for the real parts, or a dot plot in the complex plane — so the user *sees* eigenvalues cross into the right-half plane (instability) as they detune coil balance, lower a gain, or add loop delay.
- Present the 1D-vs-2D contrast explicitly as *which* eigenvalues go unstable, making Ketterle's "you can show by analysis of the differential equation that this one has an instability in x and y, and that one has an instability in z" claim literal and visible.

## Summary
Keep all existing modules, references, and the footer. The net effect of this follow-up: (1) every module foregrounds a live, animated hovering object; (2) feedback modules use full PID with windup protection and a thermal-sag demonstration; (3) integration is fixed-step, frame-rate-independent, RK4 where it matters, with crash-safety; (4) stability is shown via live Jacobian eigenvalues, not just asserted.
