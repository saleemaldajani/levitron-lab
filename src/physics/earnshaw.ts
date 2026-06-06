/**
 * Module 0 — Earnshaw primer with crash guards.
 */

export interface EarnshawParams {
  separation: number;
  magnetStrength: number;
  mass: number;
}

export interface EarnshawState {
  z: number;
  vz: number;
  crashed: boolean;
}

export const DEFAULT_EARNSHAW: EarnshawParams = {
  separation: 0.025,
  magnetStrength: 1.0,
  mass: 0.008,
};

const G = 9.81;

export function magneticForceZ(z: number, p: EarnshawParams): number {
  const d = Math.max(z, 0.003);
  const mu = p.magnetStrength * 0.015;
  const a = p.separation * 0.5;
  const denom = Math.pow(d * d + a * a, 2.5);
  return (6 * mu * mu * d) / denom;
}

export function totalForceZ(z: number, p: EarnshawParams): number {
  return magneticForceZ(z, p) - p.mass * G;
}

export function potentialU(z: number, p: EarnshawParams): number {
  const d = Math.max(z, 0.003);
  const mu = p.magnetStrength * 0.015;
  const a = p.separation * 0.5;
  const denom = Math.pow(d * d + a * a, 1.5);
  return (mu * mu) / denom + p.mass * G * d;
}

export function findEquilibrium(p: EarnshawParams): number | null {
  let lo = 0.005;
  let hi = 0.15;
  if (totalForceZ(lo, p) < 0 || totalForceZ(hi, p) > 0) return null;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (totalForceZ(mid, p) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export function curvatureAt(z: number, p: EarnshawParams): number {
  const dz = 1e-5;
  const f1 = totalForceZ(z - dz, p);
  const f2 = totalForceZ(z + dz, p);
  return (f2 - f1) / (2 * dz);
}

export function stepEarnshaw(state: EarnshawState, p: EarnshawParams, dt: number): EarnshawState {
  if (state.crashed) return state;

  const fz = totalForceZ(Math.max(state.z, 0.001), p);
  const az = fz / p.mass;
  const vz = state.vz + az * dt;
  const z = Math.max(0.001, state.z + vz * dt);

  if (!Number.isFinite(z) || !Number.isFinite(vz) || z > 0.2 || z < 0.001 && vz < -0.5) {
    return { z: Math.max(0.001, z), vz: 0, crashed: true };
  }
  return { z, vz, crashed: false };
}

export function sampleForceCurve(
  p: EarnshawParams,
  zMin = 0.005,
  zMax = 0.12,
  n = 200,
): { z: number; force: number; potential: number }[] {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = zMin + (i / n) * (zMax - zMin);
    pts.push({ z, force: totalForceZ(z, p), potential: potentialU(z, p) });
  }
  return pts;
}

export function earnshawPreset(): EarnshawParams {
  return { ...DEFAULT_EARNSHAW };
}

export function classifyEarnshaw(state: EarnshawState): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.z < 0.002) return 'CRASHED';
  if (state.z > 0.14) return 'FLEW_OFF';
  if (Math.abs(state.vz) > 0.002) return 'DRIFTING';
  return 'DRIFTING'; // never truly levitating — unstable equilibrium
}
