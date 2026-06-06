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

export function deltaRCritical(p: DynamicalParams): number {
  return 0.008 + 0.002 * (15000 / Math.max(p.rotorRpm, 7500));
}

export function rotorOmega(p: DynamicalParams): number {
  return (p.rotorRpm * 2 * Math.PI) / 60;
}

export function floaterPotentialZ(z: number, p: DynamicalParams): number {
  const dRc = deltaRCritical(p);
  const coupled = p.deltaR >= dRc;
  const z0 = p.rotorFloaterGap;
  const mag = p.floaterMoment * 0.5 / Math.pow(Math.abs(z - z0) + 0.008, 2);
  const grav = p.floaterMass * G * z;
  if (!coupled) return mag + grav;
  const wellDepth = 0.002 * ((p.deltaR - dRc) / 0.01 + 0.5);
  const trap = -wellDepth * Math.exp(-Math.pow((z - z0) / 0.012, 2));
  return mag + grav + trap;
}

export function lockedSpinRatio(thetaF: number): number {
  return Math.sin(thetaF);
}

function forceZ(z: number, p: DynamicalParams): number {
  const dz = 1e-5;
  return (
    -(floaterPotentialZ(z + dz, p) - floaterPotentialZ(z - dz, p)) / (2 * dz)
  );
}

function derivatives(_t: number, s: number[], p: DynamicalParams): number[] {
  const [zf, vzf, xf, yf, vxf, vyf, omegaF, thetaF] = s;
  const wR = rotorOmega(p);
  const dRc = deltaRCritical(p);
  const coupled = p.deltaR >= dRc;

  let dOmegaF = 0;
  let dThetaF = 0;
  if (coupled) {
    const targetTheta = Math.PI / 2 - p.rotorAxisTilt;
    dThetaF = (targetTheta - thetaF) * 2;
    dOmegaF = (wR * Math.sin(thetaF) - omegaF) * 3;
  } else {
    dOmegaF = -p.rotationalDrag * omegaF;
  }

  const kLat = coupled ? 25 * (p.deltaR - dRc + 0.005) : -5;
  const Fz = forceZ(zf, p) - p.translationalDrag * vzf;
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
    zf: Math.max(0.003, v[0]),
    vzf: clamp(v[1], -3, 3),
    xf: v[2],
    yf: v[3],
    vxf: clamp(v[4], -3, 3),
    vyf: clamp(v[5], -3, 3),
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
    isOutOfBounds3D(next.xf, next.yf, next.zf, 0.08, 0.12, 0.002) ||
    next.zf < 0.003
  ) {
    return { ...state, crashed: true, time: state.time + dt };
  }
  return next;
}

export function classifyDynamical(
  state: DynamicalState,
  p: DynamicalParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.zf < 0.003) return 'CRASHED';
  if (state.zf > 0.1 || Math.hypot(state.xf, state.yf) > 0.05) return 'FLEW_OFF';
  const dRc = deltaRCritical(p);
  if (p.deltaR < dRc) return 'DRIFTING';
  const zErr = Math.abs(state.zf - p.rotorFloaterGap);
  if (zErr > 0.015) return 'DRIFTING';
  if (Math.hypot(state.vxf, state.vyf, state.vzf) > 0.03) return 'DRIFTING';
  return 'LEVITATING';
}

export function dynamicalPreset(): DynamicalParams {
  return {
    ...DEFAULT_DYNAMICAL,
    rotorRpm: 12000,
    deltaR: 0.014,
    rotorAxisTilt: 0.04,
  };
}

export function initDynamicalState(p: DynamicalParams): DynamicalState {
  return {
    zf: p.rotorFloaterGap,
    vzf: 0,
    xf: 0,
    yf: 0,
    vxf: 0,
    vyf: 0,
    omegaF: 0,
    thetaF: Math.PI / 2,
    phiF: 0,
    time: 0,
    crashed: false,
  };
}

export function sampleFloaterPotential(p: DynamicalParams, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = 0.01 + (i / n) * 0.06;
    pts.push({ z, u: floaterPotentialZ(z, p) });
  }
  return pts;
}

export function neodymiumSpinWindowEstimate(): string {
  return '\\omega_{\\min}/\\omega_{\\max} \\approx O(1/25)';
}
