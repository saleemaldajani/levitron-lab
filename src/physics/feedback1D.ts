/**
 * Module 1 — 1D active feedback levitator (globe/lamp class).
 * Full PID with integral windup protection; control loop at 1 kHz sample-and-hold.
 * m z̈ = F_coil(I) − mg
 */

import {
  closedLoopEigenvalues1D,
  openLoopEigenvalues1D,
  passiveUnstableGainZ,
  type Feedback1DEigenParams,
  type ComplexEigenvalue,
} from './eigenvalues';
import {
  CONTROL_DT,
  clamp,
  isFiniteState,
  isOutOfBounds1D,
  semiImplicitEuler1D,
} from './integrators';

export interface Feedback1DParams {
  setpointGap: number;
  kp: number;
  ki: number;
  kd: number;
  baseStrength: number;
  sensorNoise: number;
  maxCurrent: number;
  mass: number;
  loopDelay: number;
  temperature: number;
  trimPot: number;
}

export interface Feedback1DState {
  z: number;
  vz: number;
  coilCurrent: number;
  errorIntegral: number;
  errorHistory: number[];
  controlTimer: number;
  time: number;
  crashed: boolean;
}

export const DEFAULT_FEEDBACK1D: Feedback1DParams = {
  setpointGap: 0.015,
  kp: 800,
  ki: 120,
  kd: 45,
  baseStrength: 0.12,
  sensorNoise: 0.0002,
  maxCurrent: 2.5,
  mass: 0.012,
  loopDelay: 0.002,
  temperature: 22,
  trimPot: 0.5,
};

const G = 9.81;
const INTEGRAL_MAX = 0.05;

function tempFactor(temp: number): number {
  return 1 - 0.001 * (temp - 22);
}

export function coilForce(current: number, p: Feedback1DParams): number {
  return p.baseStrength * tempFactor(p.temperature) * current;
}

export function effectiveSetpoint(p: Feedback1DParams): number {
  return p.setpointGap + (p.trimPot - 0.5) * 0.004;
}

function passiveForceZ(z: number, p: Feedback1DParams): number {
  const zEq = effectiveSetpoint(p);
  return passiveUnstableGainZ(p.temperature) * (z - zEq);
}

function computePID(
  err: number,
  errDot: number,
  integral: number,
  p: Feedback1DParams,
): { I: number; newIntegral: number; saturated: boolean } {
  const I_ff = (p.mass * G) / (p.baseStrength * tempFactor(p.temperature));
  const raw = I_ff + p.kp * err + p.ki * integral + p.kd * errDot;
  const I = clamp(raw, -p.maxCurrent, p.maxCurrent);
  const saturated = Math.abs(raw - I) > 1e-9;
  let newIntegral = integral;
  if (!saturated) {
    newIntegral = clamp(integral + err * CONTROL_DT, -INTEGRAL_MAX, INTEGRAL_MAX);
  }
  return { I, newIntegral, saturated };
}

export function stepFeedback1D(
  state: Feedback1DState,
  p: Feedback1DParams,
  dt: number,
  noiseSample: number,
): Feedback1DState {
  if (state.crashed) return state;

  let { z, vz, coilCurrent, errorIntegral, errorHistory, controlTimer, time } = state;
  const setpoint = effectiveSetpoint(p);

  // Physics integrates continuously; controller sample-and-holds at CONTROL_DT with delay buffer
  controlTimer += dt;
  if (controlTimer >= CONTROL_DT) {
    controlTimer -= CONTROL_DT;
    const measuredZ = z + p.sensorNoise * noiseSample;
    const err = setpoint - measuredZ;
    const errDot = -vz;

    errorHistory = [...errorHistory, err];
    const delaySteps = Math.max(1, Math.round(p.loopDelay / CONTROL_DT));
    while (errorHistory.length > delaySteps) errorHistory.shift();
    const delayedErr = errorHistory[0];

    const pid = computePID(delayedErr, errDot, errorIntegral, p);
    coilCurrent = pid.I;
    errorIntegral = pid.newIntegral;
  }

  const accel = (pos: number, _vel: number) => {
    const F = coilForce(coilCurrent, p) + passiveForceZ(pos, p) - p.mass * G;
    return F / p.mass;
  };

  const next = semiImplicitEuler1D(z, vz, accel, dt);
  z = next.z;
  vz = clamp(next.vz, -5, 5);

  if (!isFiniteState([z, vz, coilCurrent, errorIntegral]) || isOutOfBounds1D(z)) {
    return { ...state, z: Math.max(0, z), vz: 0, crashed: true, time: time + dt };
  }

  return {
    z,
    vz,
    coilCurrent,
    errorIntegral,
    errorHistory,
    controlTimer,
    time: time + dt,
    crashed: false,
  };
}

export function classifyFeedback1D(
  state: Feedback1DState,
  p: Feedback1DParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed || state.z < 0.002) return 'CRASHED';
  if (state.z > 0.08) return 'FLEW_OFF';
  const err = Math.abs(effectiveSetpoint(p) - state.z);
  if (err > 0.006) return 'DRIFTING';
  if (Math.abs(state.vz) > 0.012) return 'DRIFTING';
  if (Math.abs(state.coilCurrent) >= p.maxCurrent * 0.92) return 'DRIFTING';
  return 'LEVITATING';
}

export function feedback1DPreset(): Feedback1DParams {
  return {
    ...DEFAULT_FEEDBACK1D,
    kp: 650,
    ki: 150,
    kd: 38,
    loopDelay: 0.001,
    temperature: 22,
    trimPot: 0.5,
  };
}

export function initFeedback1DState(p: Feedback1DParams): Feedback1DState {
  const z0 = effectiveSetpoint(p);
  const I0 = (p.mass * G) / (p.baseStrength * tempFactor(p.temperature));
  return {
    z: z0,
    vz: 0,
    coilCurrent: clamp(I0, -p.maxCurrent, p.maxCurrent),
    errorIntegral: 0,
    errorHistory: [0],
    controlTimer: 0,
    time: 0,
    crashed: false,
  };
}

/** Net vertical acceleration at current state (m/s²). */
export function netAcceleration1D(state: Feedback1DState, p: Feedback1DParams): number {
  const F = coilForce(state.coilCurrent, p) + passiveForceZ(state.z, p) - p.mass * G;
  return F / p.mass;
}

export function getEigenParams1D(p: Feedback1DParams): Feedback1DEigenParams {
  return {
    kp: p.kp,
    ki: p.ki,
    kd: p.kd,
    baseStrength: p.baseStrength,
    mass: p.mass,
    temperature: p.temperature,
    loopDelay: p.loopDelay,
  };
}

export function computeEigenvalues1D(
  p: Feedback1DParams,
  openLoop = false,
): ComplexEigenvalue[] {
  if (openLoop) return openLoopEigenvalues1D(p.temperature);
  return closedLoopEigenvalues1D(getEigenParams1D(p));
}
