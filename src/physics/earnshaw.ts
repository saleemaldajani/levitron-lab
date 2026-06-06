/**
 * Module 0 — Earnshaw primer.
 * Rests in a locally restoring (green) well; hilltop at z_eq is unstable (red).
 * Parameter changes drift the field gradually so the magnet slides out slowly.
 */

import { clamp } from './integrators';

export interface EarnshawParams {
  separation: number;
  magnetStrength: number;
  mass: number;
}

export interface EarnshawState {
  z: number;
  vz: number;
  crashed: boolean;
  nudged: boolean;
}

export const DEFAULT_EARNSHAW: EarnshawParams = {
  separation: 0.025,
  magnetStrength: 1.0,
  mass: 0.008,
};

const G = 9.81;
const REST_BELOW_EQ = 0.006;
const GREEN_MARGIN_BELOW = 0.014;
const HILL_APPROACH = 0.004;

/** Hilltop reference (m) — moves with separation & strength. */
export function nominalGap(p: EarnshawParams): number {
  return 0.011 + p.separation * 0.44 + 0.0012 * (p.magnetStrength - 1);
}

/** Center of the restoring well (green), just below the unstable hilltop. */
export function stableRestZ(p: EarnshawParams): number {
  return nominalGap(p) - REST_BELOW_EQ;
}

/** Green restoring interval (below the hill approach). */
export function greenBandLimits(p: EarnshawParams): { z0: number; z1: number } {
  const zWell = stableRestZ(p);
  const zEq = nominalGap(p);
  return {
    z0: zWell - GREEN_MARGIN_BELOW,
    z1: zEq - HILL_APPROACH,
  };
}

/** Red unstable hill interval (saddle approach through hilltop). */
export function redBandLimits(p: EarnshawParams): { z0: number; z1: number } {
  const zEq = nominalGap(p);
  return {
    z0: zEq - HILL_APPROACH,
    z1: zEq + 0.006,
  };
}

/**
 * Net vertical force (N), positive upward.
 * Linear restoring well below z_eq; inverted hill at z_eq; weight balanced in the well.
 */
export function totalForceZ(z: number, p: EarnshawParams): number {
  const mg = p.mass * G;
  const zEq = nominalGap(p);
  const zWell = stableRestZ(p);
  const strength = p.magnetStrength;

  const dzWell = z - zWell;
  const wellBlend = 1 / (1 + Math.exp((z - (zEq - 0.0042)) / 0.0007));
  const Fwell = -strength * 0.52 * dzWell * wellBlend;

  const dzEq = z - zEq;
  const hillEnv = Math.exp(-((dzEq / 0.004) ** 2));
  const Fhill = strength * 0.38 * dzEq * hillEnv;

  const lift = mg * (strength / 0.85);
  return Fwell + Fhill + lift - mg;
}

export function magneticForceZ(z: number, p: EarnshawParams): number {
  return totalForceZ(z, p) + p.mass * G;
}

export function netAccelerationZ(state: EarnshawState, p: EarnshawParams): number {
  return totalForceZ(Math.max(state.z, 0.001), p) / p.mass;
}

export function potentialU(z: number, p: EarnshawParams): number {
  const zMin = 0.004;
  const steps = 80;
  const dz = (z - zMin) / steps;
  let u = 0;
  let zPrev = zMin;
  let fPrev = totalForceZ(zMin, p);
  for (let i = 1; i <= steps; i++) {
    const zCur = zMin + i * dz;
    if (zCur > z) break;
    const fCur = totalForceZ(zCur, p);
    u -= 0.5 * (fPrev + fCur) * (zCur - zPrev);
    zPrev = zCur;
    fPrev = fCur;
  }
  return u;
}

export function findEquilibrium(p: EarnshawParams): number | null {
  const zEq = nominalGap(p);
  if (curvatureAt(zEq, p) <= 0.04) return null;
  return zEq;
}

/** @deprecated alias */
export function equilibriumZ(p: EarnshawParams): number {
  return nominalGap(p);
}

/** Best rest point in the green band with F ≈ 0. */
export function findStableRestPoint(p: EarnshawParams): number {
  const { z0, z1 } = greenBandLimits(p);
  let bestZ = (z0 + z1) * 0.5;
  let bestF = Infinity;
  for (let i = 0; i <= 120; i++) {
    const z = z0 + (i / 120) * (z1 - z0);
    const f = Math.abs(totalForceZ(z, p));
    if (f < bestF) {
      bestF = f;
      bestZ = z;
    }
  }
  return bestZ;
}

export function curvatureAt(z: number, p: EarnshawParams): number {
  const dz = 1e-5;
  return (totalForceZ(z + dz, p) - totalForceZ(z - dz, p)) / (2 * dz);
}

export function isInStableBand(z: number, p: EarnshawParams): boolean {
  const { z0, z1 } = greenBandLimits(p);
  return z >= z0 && z <= z1;
}

export function isInUnstableBand(z: number, p: EarnshawParams): boolean {
  const { z0, z1 } = redBandLimits(p);
  return z >= z0 && z <= z1;
}

/** True when the restoring well is shallow or the floater has left the green band. */
export function isNearStabilityMargin(p: EarnshawParams, z: number): boolean {
  const rest = findStableRestPoint(p);
  const { z1: greenTop } = greenBandLimits(p);
  return (
    curvatureAt(rest, p) > -0.08 ||
    z > greenTop - 0.0005 ||
    !isInStableBand(z, p) ||
    Math.abs(totalForceZ(z, p)) > 0.018
  );
}

/** Quasi-static follow of the moving well while sliders drift (fine-tune mode). */
export function adiabaticFieldStep(
  state: EarnshawState,
  p: EarnshawParams,
  pullStrength: number,
): EarnshawState {
  if (state.crashed || state.nudged) return state;
  const rest = findStableRestPoint(p);
  const pull = clamp(pullStrength, 0, 1);
  const z = state.z + (rest - state.z) * pull;
  const vz = state.vz * (1 - pull * 0.35);
  return { ...state, z, vz };
}

export function stepEarnshaw(state: EarnshawState, p: EarnshawParams, dt: number): EarnshawState {
  if (state.crashed) return state;

  const fz = totalForceZ(Math.max(state.z, 0.001), p);
  const az = fz / p.mass;
  const vz = clamp(state.vz + az * dt, -2.5, 2.5);
  const z = Math.max(0.001, state.z + vz * dt);

  if (
    !Number.isFinite(z) ||
    !Number.isFinite(vz) ||
    z > 0.105 ||
    (z < 0.0015 && vz < -0.04)
  ) {
    return { z: clamp(z, 0.001, 0.14), vz: 0, crashed: true, nudged: state.nudged };
  }
  return {
    z,
    vz,
    crashed: false,
    nudged: state.nudged || isInUnstableBand(z, p) || Math.abs(fz) > 0.02,
  };
}

/** Tip the floater onto the red hill approach with upward speed. */
export function nudgeEarnshaw(state: EarnshawState, p: EarnshawParams): EarnshawState {
  if (state.crashed) return state;
  const { z1: greenTop } = greenBandLimits(p);
  return {
    z: greenTop + 0.00025,
    vz: 0.024,
    crashed: false,
    nudged: true,
  };
}

export function initEarnshawState(p: EarnshawParams): EarnshawState {
  return { z: findStableRestPoint(p), vz: 0, crashed: false, nudged: false };
}

export function sampleForceCurve(
  p: EarnshawParams,
  zMin = 0.004,
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

export interface StabilityBand {
  z0: number;
  z1: number;
}

/** Green = restoring well; red = unstable hill (geometry matches the force model). */
export function stabilityBands(
  p: EarnshawParams,
  zMin = 0.004,
  zMax = 0.12,
): { stable: StabilityBand[]; unstable: StabilityBand[] } {
  const green = greenBandLimits(p);
  const red = redBandLimits(p);
  return {
    stable: [
      {
        z0: Math.max(zMin, green.z0),
        z1: Math.min(zMax, green.z1),
      },
    ].filter((b) => b.z1 > b.z0),
    unstable: [
      {
        z0: Math.max(zMin, red.z0),
        z1: Math.min(zMax, red.z1),
      },
    ].filter((b) => b.z1 > b.z0),
  };
}

/** Rest-containing green band for zoom/readouts. */
export function primaryStableBand(
  p: EarnshawParams,
  bands?: { stable: StabilityBand[] },
): StabilityBand {
  const stable = bands?.stable ?? stabilityBands(p).stable;
  if (stable.length === 0) {
    const rest = findStableRestPoint(p);
    return { z0: rest - 0.006, z1: rest + 0.002 };
  }
  return stable[0];
}

/** Plot z-range zoomed on the green well and nearby hilltop. */
export function greenWellPlotRange(
  p: EarnshawParams,
  eq: number | null,
  band: StabilityBand,
): { zMin: number; zMax: number } {
  const width = band.z1 - band.z0;
  const padBelow = Math.max(0.003, width * 0.25);
  const padAbove = Math.max(0.004, width * 0.35);
  const zMin = Math.max(0.004, band.z0 - padBelow);
  const hill = eq ?? nominalGap(p);
  const zMax = Math.min(0.12, Math.max(band.z1 + padAbove, hill + 0.004));
  return { zMin, zMax };
}

/** Lerp field parameters toward a target (smooth slider response). */
export function lerpEarnshawParams(
  current: EarnshawParams,
  target: EarnshawParams,
  alpha: number,
): EarnshawParams {
  const t = clamp(alpha, 0, 1);
  return {
    separation: current.separation + (target.separation - current.separation) * t,
    magnetStrength: current.magnetStrength + (target.magnetStrength - current.magnetStrength) * t,
    mass: current.mass + (target.mass - current.mass) * t,
  };
}

export function earnshawPreset(): EarnshawParams {
  return { ...DEFAULT_EARNSHAW, magnetStrength: 0.85, separation: 0.028, mass: 0.008 };
}

export function classifyEarnshaw(
  state: EarnshawState,
  p: EarnshawParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.z < 0.002) return 'CRASHED';
  if (state.z > 0.11) return 'FLEW_OFF';
  if (state.nudged || Math.abs(state.vz) > 0.0015) return 'DRIFTING';
  if (!isInStableBand(state.z, p)) return 'DRIFTING';
  if (Math.abs(totalForceZ(state.z, p)) > 0.012) return 'DRIFTING';
  return 'LEVITATING';
}

export function displayZ(state: EarnshawState, _p: EarnshawParams, zMax = 0.1): number {
  if (state.crashed) return clamp(state.z, 0.001, zMax);
  return clamp(state.z, 0.005, zMax);
}
