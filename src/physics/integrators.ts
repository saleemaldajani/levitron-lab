/** Fixed-step physics integrator utilities. Physics at 1 ms; control loop at 1 kHz. */

export const PHYSICS_DT = 0.001;
export const CONTROL_DT = 0.001;
/** @deprecated use PHYSICS_DT */
export const SIM_DT = PHYSICS_DT;

export type Vec = number[];

export function vecAdd(a: Vec, b: Vec): Vec {
  return a.map((v, i) => v + b[i]);
}

export function vecScale(a: Vec, s: number): Vec {
  return a.map((v) => v * s);
}

export function rk4Step(
  state: Vec,
  t: number,
  dt: number,
  derivative: (t: number, s: Vec) => Vec,
): { state: Vec; t: number } {
  const k1 = derivative(t, state);
  const k2 = derivative(t + dt / 2, vecAdd(state, vecScale(k1, dt / 2)));
  const k3 = derivative(t + dt / 2, vecAdd(state, vecScale(k2, dt / 2)));
  const k4 = derivative(t + dt, vecAdd(state, vecScale(k3, dt)));
  const increment = vecAdd(
    vecAdd(vecScale(k1, 1 / 6), vecScale(k2, 1 / 3)),
    vecAdd(vecScale(k3, 1 / 3), vecScale(k4, 1 / 6)),
  );
  return { state: vecAdd(state, vecScale(increment, dt)), t: t + dt };
}

/** Semi-implicit (symplectic) Euler for second-order 1D. */
export function semiImplicitEuler1D(
  z: number,
  vz: number,
  accel: (z: number, vz: number) => number,
  dt: number,
): { z: number; vz: number } {
  const az = accel(z, vz);
  const nvz = vz + az * dt;
  return { z: z + nvz * dt, vz: nvz };
}

export function semiImplicitEuler2D(
  x: number,
  y: number,
  vx: number,
  vy: number,
  accel: (x: number, y: number, vx: number, vy: number) => [number, number],
  dt: number,
): { x: number; y: number; vx: number; vy: number } {
  const [ax, ay] = accel(x, y, vx, vy);
  const nvx = vx + ax * dt;
  const nvy = vy + ay * dt;
  return { x: x + nvx * dt, y: y + nvy * dt, vx: nvx, vy: nvy };
}

export function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export function isFiniteState(values: number[]): boolean {
  return values.every((v) => Number.isFinite(v) && Math.abs(v) < 1e6);
}

export function isOutOfBounds1D(z: number, maxZ = 0.15, minZ = -0.01): boolean {
  return z < minZ || z > maxZ || !Number.isFinite(z);
}

export function isOutOfBounds2D(x: number, y: number, maxR = 0.08): boolean {
  return !Number.isFinite(x) || !Number.isFinite(y) || Math.hypot(x, y) > maxR;
}

export function isOutOfBounds3D(
  x: number,
  y: number,
  z: number,
  maxR = 0.12,
  maxZ = 0.15,
  minZ = -0.01,
): boolean {
  return (
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    !Number.isFinite(z) ||
    Math.hypot(x, y) > maxR ||
    z < minZ ||
    z > maxZ
  );
}
