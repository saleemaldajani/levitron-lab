/**
 * Module 4 — Dynamical rotor Levitron (RK4 integration).
 */

import { clamp, isFiniteState, isOutOfBounds3D, rk4Step } from './integrators';

export interface DynamicalParams {
  rotorRpm: number;
  rotorFloaterGap: number;
  floaterMass: number;
  floaterMoment: number;
  deltaR: number;
  rotorAxisTilt: number;
  rotationalDrag: number;
  translationalDrag: number;
}

export interface DynamicalState {
  zf: number;
  vzf: number;
  xf: number;
  yf: number;
  vxf: number;
  vyf: number;
  omegaF: number;
  thetaF: number;
  phiF: number;
  time: number;
  crashed: boolean;
}

export const DEFAULT_DYNAMICAL: DynamicalParams = {
  rotorRpm: 12000,
  rotorFloaterGap: 0.035,
  floaterMass: 0.003,
  floaterMoment: 0.0008,
  deltaR: 0.012,
  rotorAxisTilt: 0.05,
  rotationalDrag: 0.02,
  translationalDrag: 0.15,
};

const G = 9.81;
const FLOOR_Z = 0.0025;

export function deltaRCritical(p: DynamicalParams): number {
  return 0.008 + 0.002 * (15000 / Math.max(p.rotorRpm, 5000));
}

export function rotorOmega(p: DynamicalParams): number {
  return (p.rotorRpm * 2 * Math.PI) / 60;
}

export function isCoupled(p: DynamicalParams): boolean {
  return p.deltaR >= deltaRCritical(p);
}

/** Coupling strength in [0, 1+] from δ_R margin above threshold; 0 when decoupled. */
export function trapStrength(p: DynamicalParams): number {
  if (!isCoupled(p)) return 0;
  const margin = p.deltaR - deltaRCritical(p);
  return clamp(margin / 0.006, 0, 1.4);
}

/** Vertical force on floater (N), positive upward. */
export function floaterForceZ(z: number, p: DynamicalParams, spinLock = 1): number {
  const mg = p.floaterMass * G;
  const strength = trapStrength(p) * clamp(spinLock, 0, 1);

  if (strength <= 0.05) {
    return -mg;
  }

  const z0 = p.rotorFloaterGap;
  const kVert = (50 + 60 * strength) * p.floaterMass;
  const magneticSupport = mg * clamp(strength, 0.2, 1.15);
  return magneticSupport - kVert * (z - z0) - mg;
}

export function floaterPotentialZ(z: number, p: DynamicalParams, spinLock = 1): number {
  const mg = p.floaterMass * G;
  const strength = trapStrength(p) * clamp(spinLock, 0, 1);

  if (strength <= 0.05) {
    return mg * z;
  }

  const z0 = p.rotorFloaterGap;
  const kVert = (50 + 60 * strength) * p.floaterMass;
  const magneticSupport = mg * clamp(strength, 0.2, 1.15);
  return mg * z - magneticSupport * z + 0.5 * kVert * (z - z0) ** 2;
}

export function findTrapEquilibriumZ(p: DynamicalParams): number {
  return p.rotorFloaterGap;
}

export function hasTrappingMinimum(p: DynamicalParams): boolean {
  if (trapStrength(p) <= 0.15) return false;
  const z0 = p.rotorFloaterGap;
  const dz = 1e-5;
  const d2 =
    (floaterForceZ(z0 + dz, p, 1) - floaterForceZ(z0 - dz, p, 1)) / (2 * dz);
  return Math.abs(floaterForceZ(z0, p, 1)) < 0.05 && d2 < -0.5;
}

export function netAccelerationDynamical(state: DynamicalState, p: DynamicalParams): number {
  const lock = lockedSpinRatio(state.thetaF);
  const Fz = floaterForceZ(state.zf, p, lock) - p.translationalDrag * state.vzf;
  return Fz / p.floaterMass;
}

export function lockedSpinRatio(thetaF: number): number {
  return Math.sin(thetaF);
}

function derivatives(_t: number, s: number[], p: DynamicalParams): number[] {
  const [zf, vzf, xf, yf, vxf, vyf, omegaF, thetaF] = s;
  const wR = rotorOmega(p);
  const coupled = isCoupled(p);
  const lock = coupled ? clamp(lockedSpinRatio(thetaF), 0, 1) : 0;

  let dOmegaF = 0;
  let dThetaF = 0;
  if (coupled) {
    const targetTheta = Math.PI / 2 - p.rotorAxisTilt;
    dThetaF = (targetTheta - thetaF) * 2.5;
    dOmegaF = (wR * Math.sin(thetaF) - omegaF) * 3.5;
  } else {
    dOmegaF = -p.rotationalDrag * omegaF;
    dThetaF = -p.rotationalDrag * (thetaF - Math.PI / 2) * 0.5;
  }

  const dRc = deltaRCritical(p);
  const margin = Math.max(0, p.deltaR - dRc);
  const kLat = coupled ? 28 * margin * 800 * lock : -12;
  const Fz = floaterForceZ(zf, p, lock) - p.translationalDrag * vzf;
  const Fx = -kLat * xf - p.translationalDrag * vxf;
  const Fy = -kLat * yf - p.translationalDrag * vyf;

  return [
    vzf,
    Fz / p.floaterMass,
    vxf,
    Fx / p.floaterMass,
    vyf,
    Fy / p.floaterMass,
    dOmegaF,
    dThetaF,
    omegaF,
  ];
}

function stateToVec(s: DynamicalState): number[] {
  return [s.zf, s.vzf, s.xf, s.yf, s.vxf, s.vyf, s.omegaF, s.thetaF, s.phiF];
}

function vecToState(v: number[], time: number, crashed: boolean): DynamicalState {
  return {
    zf: v[0],
    vzf: clamp(v[1], -4, 4),
    xf: v[2],
    yf: v[3],
    vxf: clamp(v[4], -4, 4),
    vyf: clamp(v[5], -4, 4),
    omegaF: v[6],
    thetaF: v[7],
    phiF: v[8],
    time,
    crashed,
  };
}

export function stepDynamical(
  state: DynamicalState,
  p: DynamicalParams,
  dt: number,
): DynamicalState {
  if (state.crashed) return state;

  const { state: nextVec, t } = rk4Step(stateToVec(state), state.time, dt, (t, s) =>
    derivatives(t, s, p),
  );
  const next = vecToState(nextVec, t, false);

  if (
    !isFiniteState(nextVec) ||
    isOutOfBounds3D(next.xf, next.yf, next.zf, 0.1, 0.14, FLOOR_Z) ||
    next.zf < FLOOR_Z
  ) {
    return { ...next, zf: Math.max(FLOOR_Z, next.zf), crashed: true };
  }
  return next;
}

export function classifyDynamical(
  state: DynamicalState,
  p: DynamicalParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.zf <= FLOOR_Z + 0.0005) return 'CRASHED';
  if (state.zf > 0.12 || Math.hypot(state.xf, state.yf) > 0.08) return 'FLEW_OFF';
  const strength = trapStrength(p);
  const lock = lockedSpinRatio(state.thetaF);
  if (strength <= 0.05 || lock < 0.35) return 'DRIFTING';
  const z0 = p.rotorFloaterGap;
  const zErr = Math.abs(state.zf - z0);
  if (zErr > 0.018) return 'DRIFTING';
  if (Math.hypot(state.vxf, state.vyf, state.vzf) > 0.035) return 'DRIFTING';
  return 'LEVITATING';
}

export function dynamicalPreset(): DynamicalParams {
  return {
    ...DEFAULT_DYNAMICAL,
    rotorRpm: 12500,
    rotorFloaterGap: 0.032,
    floaterMass: 0.0025,
    deltaR: 0.017,
    rotorAxisTilt: 0.03,
    translationalDrag: 0.1,
  };
}

export function initDynamicalState(p: DynamicalParams): DynamicalState {
  const z0 = p.rotorFloaterGap;
  const coupled = isCoupled(p);
  return {
    zf: z0 + (coupled ? 0.002 : 0),
    vzf: coupled ? -0.004 : 0,
    xf: 0,
    yf: 0,
    vxf: 0,
    vyf: 0,
    omegaF: coupled ? rotorOmega(p) * 0.92 : 0,
    thetaF: Math.PI / 2 - p.rotorAxisTilt * 0.4,
    phiF: 0,
    time: 0,
    crashed: false,
  };
}

export function sampleFloaterPotential(p: DynamicalParams, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = 0.005 + (i / n) * 0.08;
    pts.push({ z, u: floaterPotentialZ(z, p, 1) });
  }
  return pts;
}

export function displayFloaterZ(state: DynamicalState): number {
  return Math.max(FLOOR_Z, state.zf);
}

export function neodymiumSpinWindowEstimate(): string {
  return '\\omega_{\\min}/\\omega_{\\max} \\approx O(1/25)';
}
