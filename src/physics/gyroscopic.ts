/**
 * Module 3 — Gyroscopic Levitron via 8.223 symmetric-top mechanics
 * (Aldajani & Alowayed, MIT 8.223 — goo.gl/c5u3lk).
 *
 * Euler angles (Landau): φ precession, θ nutation, ψ spin.
 * Conserved momenta:
 *   p_ψ = I_s(ψ̇ + φ̇ cos θ)
 *   p_φ = (I_p sin²θ + I_s cos²θ)φ̇ + I_s ψ̇ cos θ
 * Restoring potential:
 *   U_res(θ) = p_ψ²/(2I_s) + (p_φ − p_ψ cos θ)²/(2I_p sin²θ) + V_eff(θ)
 * with V_eff(θ) = m g l cos θ − μB cos θ (magnetic upright bias).
 */

import { clamp, isFiniteState, isOutOfBounds3D, rk4Step } from './integrators';

export interface GyroscopicParams {
  mass: number;
  baseFieldStrength: number;
  ringInnerRadius: number;
  ringOuterRadius: number;
  spinRate: number;
  launchHeight: number;
  lateralOffset: number;
  nutationAngle: number;
  temperature: number;
  respinDrive: boolean;
  inclinedMode: boolean;
  pullerStrength: number;
  pullerHeight: number;
  targetTiltDeg: number;
}

export interface GyroscopicState {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  theta: number;
  phi: number;
  psi: number;
  thetaDot: number;
  phiDot: number;
  psiDot: number;
  pPsi: number;
  pPhi: number;
  omega: number;
  time: number;
  crashed: boolean;
}

export interface GyroscopicDiagnostics {
  pPsi: number;
  pPhi: number;
  fourMglIpCos: number;
  spinStabilityRatio: number;
  hasMinimum: boolean;
  thetaStable: number;
  thetaMin: number;
  thetaMax: number;
  phiDotSlow: number;
  omega: number;
  inSpinWindow: boolean;
}

export const DEFAULT_GYROSCOPIC: GyroscopicParams = {
  mass: 0.022,
  baseFieldStrength: 1.0,
  ringInnerRadius: 0.032,
  ringOuterRadius: 0.055,
  spinRate: 33,
  launchHeight: 0.025,
  lateralOffset: 0,
  nutationAngle: 0.05,
  temperature: 22,
  respinDrive: false,
  inclinedMode: false,
  pullerStrength: 0.5,
  pullerHeight: 0.08,
  targetTiltDeg: 0,
};

const G = 9.81;
const THETA_EPS = 0.025;
const THETA_MAX = Math.PI / 2 - 0.05;

function tempFactor(temp: number): number {
  return 1 - 0.0012 * (temp - 22);
}

function fieldScale(p: GyroscopicParams): number {
  return tempFactor(p.temperature) * p.baseFieldStrength;
}

/** Spin moment I_s (symmetry axis). */
export function momentIs(p: GyroscopicParams): number {
  return p.mass * 9.2e-4;
}

/** Transverse moment I_p. */
export function momentIp(p: GyroscopicParams): number {
  return p.mass * 1.85e-3;
}

/** CM lever arm l (m). */
export function leverArm(p: GyroscopicParams): number {
  return 0.0115 * Math.pow(NOMINAL_MASS / p.mass, 0.15);
}

const NOMINAL_MASS = 0.022;

export function omegaMin(_p: GyroscopicParams): number {
  return 19;
}

export function omegaMax(p: GyroscopicParams): number {
  return omegaMin(p) * (2.8 + 0.2 * p.baseFieldStrength);
}

export function defaultOmega(p: GyroscopicParams): number {
  const wMin = omegaMin(p);
  const wMax = omegaMax(p);
  return Math.sqrt(wMin * wMax);
}

function safeSin(theta: number): number {
  return Math.max(Math.sin(clamp(theta, THETA_EPS, THETA_MAX)), 1e-3);
}

function safeSin2(theta: number): number {
  const s = safeSin(theta);
  return s * s;
}

/** m g l cos θ − magnetic upright bias (Levitron effective potential). */
function Veff(theta: number, p: GyroscopicParams): number {
  const mgl = p.mass * G * leverArm(p);
  const tf = fieldScale(p);
  return mgl * Math.cos(theta) - tf * 0.0018 * Math.cos(theta);
}

function dVeffDtheta(theta: number, p: GyroscopicParams): number {
  const mgl = p.mass * G * leverArm(p);
  const tf = fieldScale(p);
  return -(mgl - tf * 0.0018) * Math.sin(theta);
}

/** U_res(θ) from 8.223 symmetric-top analysis. */
export function Ures(theta: number, pPsi: number, pPhi: number, p: GyroscopicParams): number {
  const Is = momentIs(p);
  const Ip = momentIp(p);
  const sin2 = safeSin2(theta);
  const cosT = Math.cos(theta);
  const diff = pPhi - pPsi * cosT;
  return (
    (pPsi * pPsi) / (2 * Is) +
    (diff * diff) / (2 * Ip * sin2) +
    Veff(theta, p)
  );
}

export function dUresDtheta(theta: number, pPsi: number, pPhi: number, p: GyroscopicParams): number {
  const Ip = momentIp(p);
  const sinT = safeSin(theta);
  const sin2 = sinT * sinT;
  const sin4 = sin2 * sin2;
  const cosT = Math.cos(theta);
  const diff = pPhi - pPsi * cosT;

  const dNutation =
    (diff * pPsi * sinT) / (Ip * sin2) -
    (diff * diff * cosT * sinT) / (Ip * sin4);

  return dNutation + dVeffDtheta(theta, p);
}

export function phiDotFromMomenta(theta: number, pPsi: number, pPhi: number, p: GyroscopicParams): number {
  const Ip = momentIp(p);
  const sin2 = safeSin2(theta);
  return (pPhi - pPsi * Math.cos(theta)) / (Ip * sin2);
}

export function psiDotFromMomenta(
  theta: number,
  phiDot: number,
  pPsi: number,
  p: GyroscopicParams,
): number {
  return pPsi / momentIs(p) - phiDot * Math.cos(theta);
}

export function phiDotSlow(p: GyroscopicParams, pPsi: number): number {
  const mgl = p.mass * G * leverArm(p);
  return mgl / Math.max(pPsi, 1e-8);
}

/** Slow-precession equilibrium: cos θ_s = p_φ/p_ψ (8.223 project). */
export function pPhiFromEquilibrium(theta: number, pPsi: number): number {
  return pPsi * Math.cos(theta);
}

/** θ_s where dU_res/dθ = 0 with p_φ = p_ψ cos θ (slow-precession root). */
export function findStableTheta(pPsi: number, p: GyroscopicParams): number {
  let bestTheta = 0.05;
  let bestScore = Infinity;
  for (let i = 1; i < 200; i++) {
    const th = THETA_EPS + (i / 199) * (0.35 - THETA_EPS);
    const pPhi = pPhiFromEquilibrium(th, pPsi);
    const dU = Math.abs(dUresDtheta(th, pPsi, pPhi, p));
    const d2 =
      (dUresDtheta(th + 1e-4, pPsi, pPhi, p) - dUresDtheta(th - 1e-4, pPsi, pPhi, p)) /
      2e-4;
    const score = dU + (d2 > 0 ? 0 : 10);
    if (score < bestScore) {
      bestScore = score;
      bestTheta = th;
    }
  }
  return bestTheta;
}

/** Full p_φ including slow precession φ̇ = mgl/p_ψ (used in diagnostics). */
export function pPhiFromSlowPrecession(theta: number, pPsi: number, p: GyroscopicParams): number {
  const phiSlow = phiDotSlow(p, pPsi);
  return pPsi * Math.cos(theta) + momentIp(p) * safeSin2(theta) * phiSlow;
}

/** Nutation turning points θ_min < θ < θ_max where U_res(θ) = U_res(θ_s). */
export function nutationBounds(
  pPsi: number,
  pPhi: number,
  p: GyroscopicParams,
): { thetaMin: number; thetaMax: number; thetaStable: number } {
  const thetaStable = findStableTheta(pPsi, p);
  const u0 = Ures(thetaStable, pPsi, pPhi, p);
  let thetaMin = thetaStable;
  let thetaMax = thetaStable;

  for (let i = 1; i <= 300; i++) {
    const th = THETA_EPS + (i / 300) * (THETA_MAX - THETA_EPS);
    if (Math.abs(Ures(th, pPsi, pPhi, p) - u0) < 0.002) {
      if (th < thetaStable) thetaMin = Math.min(thetaMin, th);
      if (th > thetaStable) thetaMax = Math.max(thetaMax, th);
    }
  }
  if (thetaMax <= thetaStable) thetaMax = thetaStable + 0.04;
  if (thetaMin >= thetaStable) thetaMin = Math.max(THETA_EPS, thetaStable - 0.04);
  return { thetaMin, thetaMax, thetaStable };
}

export function criticalNutationAngle(omega: number, p: GyroscopicParams): number {
  const Is = momentIs(p);
  const pPsi = Is * omega * 2 * Math.PI;
  const thetaStable = findStableTheta(pPsi, p);
  const pPhi = pPhiFromEquilibrium(thetaStable, pPsi);
  const { thetaMax } = nutationBounds(pPsi, pPhi, p);
  return thetaMax;
}

export function computeDiagnostics(p: GyroscopicParams, omega: number): GyroscopicDiagnostics {
  const Is = momentIs(p);
  const Ip = momentIp(p);
  const pPsi = Is * omega * 2 * Math.PI;
  const thetaStable = findStableTheta(pPsi, p);
  const pPhi = pPhiFromEquilibrium(thetaStable, pPsi);
  const cosT = Math.cos(thetaStable);
  const fourMglIpCos = 4 * p.mass * G * leverArm(p) * Ip * cosT;
  const spinStabilityRatio = (pPsi * pPsi) / Math.max(fourMglIpCos, 1e-12);
  const d2 =
    (dUresDtheta(thetaStable + 1e-4, pPsi, pPhi, p) -
      dUresDtheta(thetaStable - 1e-4, pPsi, pPhi, p)) /
    2e-4;
  const bounds = nutationBounds(pPsi, pPhi, p);
  const wMin = omegaMin(p);
  const wMax = omegaMax(p);

  return {
    pPsi,
    pPhi,
    fourMglIpCos,
    spinStabilityRatio,
    hasMinimum: d2 > 0 && spinStabilityRatio > 3,
    thetaStable: bounds.thetaStable,
    thetaMin: bounds.thetaMin,
    thetaMax: bounds.thetaMax,
    phiDotSlow: phiDotSlow(p, pPsi),
    omega,
    inSpinWindow: omega >= wMin && omega <= wMax,
  };
}

/** Startup assertion — logs stable-regime verification (8.223 checklist). */
export function logStartupDiagnostics(p: GyroscopicParams, omega?: number): GyroscopicDiagnostics {
  const w = omega ?? defaultOmega(p);
  const d = computeDiagnostics(p, w);
  if (typeof console !== 'undefined') {
    console.info('[Levitron Lab · Module 3] Gyroscopic startup diagnostics (8.223)', {
      p_psi: d.pPsi.toExponential(3),
      p_phi: d.pPhi.toExponential(3),
      'p_psi^2': (d.pPsi * d.pPsi).toExponential(3),
      '4 m g l I_p cosθ': d.fourMglIpCos.toExponential(3),
      'p_psi^2 / (4mglI_p cosθ)': d.spinStabilityRatio.toFixed(2),
      'U_res minimum': d.hasMinimum,
      theta_stable: `${((d.thetaStable * 180) / Math.PI).toFixed(2)}°`,
      theta_min: `${((d.thetaMin * 180) / Math.PI).toFixed(2)}°`,
      theta_max: `${((d.thetaMax * 180) / Math.PI).toFixed(2)}°`,
      phi_dot_slow: d.phiDotSlow.toFixed(4),
      omega_rps: d.omega.toFixed(1),
      in_spin_window: d.inSpinWindow,
    });
  }
  return d;
}

function derivatives(_t: number, s: number[], p: GyroscopicParams): number[] {
  const [x, y, z, vx, vy, vz, theta, , , thetaDot, pPsi, pPhi, omega] = s;
  const th = clamp(theta, THETA_EPS, THETA_MAX);
  const Ip = momentIp(p);
  const tf = fieldScale(p);
  const wMin = omegaMin(p);
  const wMax = omegaMax(p);
  const inWindow = omega >= wMin && omega <= wMax;

  const phiDot = phiDotFromMomenta(th, pPsi, pPhi, p);
  const psiDot = psiDotFromMomenta(th, phiDot, pPsi, p);
  const thetaDDot = -dUresDtheta(th, pPsi, pPhi, p) / Ip;

  let dOmega = p.respinDrive ? (clamp(p.spinRate, wMin, wMax) - omega) * 4 : -0.008;
  const Is = momentIs(p);
  const dPPsi = p.respinDrive ? (Is * omega * 2 * Math.PI - pPsi) * 2 : Is * 2 * Math.PI * dOmega;

  const bounds = nutationBounds(pPsi, pPhi, p);
  const adiabaticOk = inWindow && th >= bounds.thetaMin * 0.95 && th <= bounds.thetaMax * 1.05;
  const proj = Math.cos(th) ** 2;

  const zEq = p.launchHeight * tf;
  const magK = p.mass * G * zEq * zEq;
  const zSafe = Math.max(z, 0.005);
  const Fz =
    (magK * tf) / (zSafe * zSafe) -
    p.mass * G +
    (adiabaticOk ? 55 * p.mass * tf * proj * (zEq - z) : 0);
  const Fr = adiabaticOk ? -45 * p.mass * tf * proj * x : 8 * p.mass * x;
  const Fy = adiabaticOk ? -45 * p.mass * tf * proj * y : 8 * p.mass * y;

  return [
    vx,
    vy,
    vz,
    Fr / p.mass,
    Fy / p.mass,
    Fz / p.mass,
    thetaDot,
    phiDot,
    psiDot,
    thetaDDot,
    dPPsi,
    0,
    dOmega,
  ];
}

/** Net translational acceleration (m/s²) at current state. */
export function netAccelerationGyro(state: GyroscopicState, p: GyroscopicParams): [number, number, number] {
  const d = derivatives(state.time, stateToVec(state), p);
  return [d[3], d[4], d[5]];
}

function stateToVec(s: GyroscopicState): number[] {
  return [
    s.x, s.y, s.z, s.vx, s.vy, s.vz,
    s.theta, s.phi, s.psi, s.thetaDot,
    s.pPsi, s.pPhi, s.omega,
  ];
}

function vecToState(v: number[], time: number, crashed: boolean, p: GyroscopicParams): GyroscopicState {
  const th = clamp(v[6], THETA_EPS, THETA_MAX);
  const pPsi = v[10];
  const pPhi = v[11];
  const phiDot = phiDotFromMomenta(th, pPsi, pPhi, p);
  const psiDot = psiDotFromMomenta(th, phiDot, pPsi, p);
  return {
    x: v[0],
    y: v[1],
    z: Math.max(0.002, v[2]),
    vx: clamp(v[3], -1.5, 1.5),
    vy: clamp(v[4], -1.5, 1.5),
    vz: clamp(v[5], -1.5, 1.5),
    theta: th,
    phi: v[7],
    psi: v[8],
    thetaDot: clamp(v[9], -6, 6),
    phiDot,
    psiDot,
    pPsi,
    pPhi,
    omega: Math.max(0, v[12]),
    time,
    crashed,
  };
}

export function stepGyroscopic(
  state: GyroscopicState,
  p: GyroscopicParams,
  dt: number,
): GyroscopicState {
  if (state.crashed) return state;

  const { state: nextVec, t } = rk4Step(stateToVec(state), state.time, dt, (t, s) =>
    derivatives(t, s, p),
  );

  const next = vecToState(nextVec, t, false, p);
  const bounds = nutationBounds(next.pPsi, next.pPhi, p);

  if (
    !isFiniteState(nextVec) ||
    isOutOfBounds3D(next.x, next.y, next.z, 0.08, 0.12) ||
    next.z < 0.003 ||
    next.theta > bounds.thetaMax * 1.45 ||
    next.theta < THETA_EPS * 0.4
  ) {
    return { ...next, crashed: true };
  }
  return next;
}

export function classifyGyroscopic(
  state: GyroscopicState,
  p: GyroscopicParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.z < 0.004) return 'CRASHED';
  if (state.z > 0.1 || Math.hypot(state.x, state.y) > 0.055) return 'FLEW_OFF';
  const wMin = omegaMin(p);
  if (state.omega < wMin * 0.92 || state.omega > omegaMax(p) * 1.05) return 'DRIFTING';
  const bounds = nutationBounds(state.pPsi, state.pPhi, p);
  if (state.theta > bounds.thetaMax * 1.08) return 'DRIFTING';
  if (Math.hypot(state.vx, state.vy, state.vz) > 0.035) return 'DRIFTING';
  return 'LEVITATING';
}

export function nudgeGyroscopic(state: GyroscopicState, _p: GyroscopicParams): GyroscopicState {
  if (state.crashed) return state;
  return {
    ...state,
    thetaDot: state.thetaDot + 0.35,
    theta: state.theta + 0.02,
    vx: state.vx + 0.003,
    vy: state.vy + 0.003,
  };
}

export function gyroscopicPreset(): GyroscopicParams {
  const base = {
    ...DEFAULT_GYROSCOPIC,
    temperature: 22,
    lateralOffset: 0,
  };
  const omega = defaultOmega(base);
  const pPsi = momentIs(base) * omega * 2 * Math.PI;
  const thetaStable = findStableTheta(pPsi, base);
  return {
    ...base,
    spinRate: omega,
    nutationAngle: thetaStable,
  };
}

export function initGyroscopicState(p: GyroscopicParams): GyroscopicState {
  const omega = clamp(
    p.spinRate > 0 ? p.spinRate : defaultOmega(p),
    omegaMin(p) * 1.02,
    omegaMax(p) * 0.98,
  );
  const Is = momentIs(p);
  const pPsi = Is * omega * 2 * Math.PI;
  const thetaStable = findStableTheta(pPsi, p);
  const pPhi = pPhiFromEquilibrium(thetaStable, pPsi);
  const bounds = nutationBounds(pPsi, pPhi, p);
  const theta0 = clamp(
    p.nutationAngle > 0 ? p.nutationAngle : thetaStable,
    bounds.thetaMin + 0.002,
    Math.min(bounds.thetaMax - 0.002, thetaStable + 0.015),
  );
  const phiDot = phiDotSlow(p, pPsi);
  const psiDot = psiDotFromMomenta(theta0, phiDot, pPsi, p);

  logStartupDiagnostics(p, omega);

  return {
    x: p.lateralOffset,
    y: 0,
    z: p.launchHeight,
    vx: 0,
    vy: 0,
    vz: 0,
    theta: theta0,
    phi: 0,
    psi: 0,
    thetaDot: 0,
    phiDot,
    psiDot,
    pPsi,
    pPhi,
    omega,
    time: 0,
    crashed: false,
  };
}

export function sampleUresCurve(pPsi: number, pPhi: number, p: GyroscopicParams, n = 120) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const th = THETA_EPS + (i / n) * (0.4 - THETA_EPS);
    pts.push({ theta: th, u: Ures(th, pPsi, pPhi, p) });
  }
  return pts;
}

export function effectivePotentialZ(z: number, omega: number, p: GyroscopicParams): number {
  const tf = fieldScale(p);
  const z0 = 0.022;
  const magU = (tf * 0.002) / Math.pow(z + z0, 3);
  const gravU = p.mass * G * z;
  const wMin = omegaMin(p);
  const wMax = omegaMax(p);
  let spinFactor = 0;
  if (omega >= wMin && omega <= wMax) {
    const t = (omega - wMin) / (wMax - wMin);
    spinFactor = -0.0008 * (4 * t * (1 - t));
  }
  return magU + gravU + spinFactor;
}

export function effectivePotentialR(r: number, omega: number, p: GyroscopicParams): number {
  const tf = fieldScale(p);
  const wMin = omegaMin(p);
  const wMax = omegaMax(p);
  let spinFactor = 0;
  if (omega >= wMin && omega <= wMax) {
    const t = (omega - wMin) / (wMax - wMin);
    spinFactor = -0.0005 * (4 * t * (1 - t));
  }
  return 0.5 * tf * 15 * r * r + spinFactor;
}

export function samplePotentialZ(omega: number, p: GyroscopicParams, n = 100) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const z = 0.008 + (i / n) * 0.05;
    pts.push({ z, u: effectivePotentialZ(z, omega, p) });
  }
  return pts;
}

export function samplePotentialR(omega: number, p: GyroscopicParams, n = 100) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const r = (i / n) * 0.04;
    pts.push({ r, u: effectivePotentialR(r, omega, p) });
  }
  return pts;
}

export function momentProjection(theta: number): number {
  return Math.cos(theta) ** 2;
}
