/**
 * Module 2 — 2D horizontal feedback (4-coil gimbal / PID).
 * Stable in z passively; unstable in x,y.
 */

import {
  closedLoopEigenvalues2D,
  openLoopEigenvalues2D,
  passiveUnstableGainXY,
  type Feedback2DEigenParams,
  type ComplexEigenvalue,
} from './eigenvalues';
import {
  CONTROL_DT,
  clamp,
  isFiniteState,
  isOutOfBounds2D,
  semiImplicitEuler2D,
} from './integrators';

export interface Feedback2DParams {
  kpXY: number;
  kiXY: number;
  kdXY: number;
  coilStrengths: [number, number, number, number];
  coilImbalance: number;
  mass: number;
  payloadOffsetX: number;
  payloadOffsetY: number;
  temperature: number;
  loopDelay: number;
  sensorNoise: number;
}

export interface Feedback2DState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  coilCurrents: [number, number, number, number];
  errorIntegralX: number;
  errorIntegralY: number;
  errorHistoryX: number[];
  errorHistoryY: number[];
  controlTimer: number;
  time: number;
  crashed: boolean;
}

export const DEFAULT_FEEDBACK2D: Feedback2DParams = {
  kpXY: 120,
  kiXY: 40,
  kdXY: 18,
  coilStrengths: [1, 1, 1, 1],
  coilImbalance: 0,
  mass: 0.015,
  payloadOffsetX: 0,
  payloadOffsetY: 0,
  temperature: 22,
  loopDelay: 0.003,
  sensorNoise: 0.0003,
};

const INTEGRAL_MAX = 0.04;

function tempFactor(temp: number): number {
  return 1 - 0.001 * (temp - 22);
}

function coilScale(p: Feedback2DParams): number {
  return 0.04 * tempFactor(p.temperature);
}

function passiveForce(val: number, p: Feedback2DParams): number {
  return passiveUnstableGainXY(p.temperature) * val;
}

function computeAxisPID(
  err: number,
  vel: number,
  integral: number,
  p: Feedback2DParams,
): { cmd: number; newIntegral: number } {
  const raw = p.kpXY * err + p.kiXY * integral - p.kdXY * vel;
  const cmd = clamp(raw, -2, 2);
  const saturated = Math.abs(raw - cmd) > 1e-9;
  let newIntegral = integral;
  if (!saturated) {
    newIntegral = clamp(integral + err * CONTROL_DT, -INTEGRAL_MAX, INTEGRAL_MAX);
  }
  return { cmd, newIntegral };
}

function feedbackForce(
  pos: number,
  _vel: number,
  cmd: number,
  p: Feedback2DParams,
): number {
  const scale = coilScale(p);
  return scale * cmd + passiveForce(pos, p);
}

export function stepFeedback2D(
  state: Feedback2DState,
  p: Feedback2DParams,
  dt: number,
  noiseX: number,
  noiseY: number,
): Feedback2DState {
  if (state.crashed) return state;

  let {
    x,
    y,
    vx,
    vy,
    errorIntegralX,
    errorIntegralY,
    errorHistoryX,
    errorHistoryY,
    controlTimer,
    coilCurrents,
    time,
  } = state;

  controlTimer += dt;
  if (controlTimer >= CONTROL_DT) {
    controlTimer -= CONTROL_DT;
    const measX = x + p.sensorNoise * noiseX;
    const measY = y + p.sensorNoise * noiseY;
    const errX = p.payloadOffsetX - measX;
    const errY = p.payloadOffsetY - measY;

    errorHistoryX = [...errorHistoryX, errX];
    errorHistoryY = [...errorHistoryY, errY];
    const delaySteps = Math.max(1, Math.round(p.loopDelay / CONTROL_DT));
    while (errorHistoryX.length > delaySteps) errorHistoryX.shift();
    while (errorHistoryY.length > delaySteps) errorHistoryY.shift();

    const pidX = computeAxisPID(errorHistoryX[0], vx, errorIntegralX, p);
    const pidY = computeAxisPID(errorHistoryY[0], vy, errorIntegralY, p);
    errorIntegralX = pidX.newIntegral;
    errorIntegralY = pidY.newIntegral;

    const ix = pidX.cmd;
    const iy = pidY.cmd;
    coilCurrents = [ix + iy, ix - iy, -ix - iy, -ix + iy];
  }

  const accel = (px: number, py: number, pvx: number, pvy: number): [number, number] => {
    const ix = (coilCurrents[0] - coilCurrents[2]) * 0.25;
    const iy = (coilCurrents[1] - coilCurrents[3]) * 0.25;
    const imbalance = 1 + p.coilImbalance * 0.08;
    const fx = feedbackForce(px, pvx, ix * imbalance, p) / p.mass;
    const fy = feedbackForce(py, pvy, iy / imbalance, p) / p.mass;
    return [fx, fy];
  };

  const next = semiImplicitEuler2D(x, y, vx, vy, accel, dt);
  x = next.x;
  y = next.y;
  vx = clamp(next.vx, -3, 3);
  vy = clamp(next.vy, -3, 3);

  if (!isFiniteState([x, y, vx, vy]) || isOutOfBounds2D(x, y, 0.06)) {
    return { ...state, crashed: true, time: time + dt };
  }

  return {
    x,
    y,
    vx,
    vy,
    coilCurrents,
    errorIntegralX,
    errorIntegralY,
    errorHistoryX,
    errorHistoryY,
    controlTimer,
    time: time + dt,
    crashed: false,
  };
}

export function classifyFeedback2D(
  state: Feedback2DState,
  p: Feedback2DParams,
): 'LEVITATING' | 'DRIFTING' | 'CRASHED' | 'FLEW_OFF' {
  if (state.crashed) return 'CRASHED';
  const r = Math.hypot(state.x, state.y);
  if (r > 0.045) return 'FLEW_OFF';
  if (r > 0.022) return 'DRIFTING';
  const err = Math.hypot(state.x - p.payloadOffsetX, state.y - p.payloadOffsetY);
  if (err > 0.01) return 'DRIFTING';
  if (Math.hypot(state.vx, state.vy) > 0.015) return 'DRIFTING';
  return 'LEVITATING';
}

export function feedback2DPreset(): Feedback2DParams {
  return {
    ...DEFAULT_FEEDBACK2D,
    kpXY: 100,
    kiXY: 45,
    kdXY: 16,
    coilImbalance: 0,
    loopDelay: 0.002,
    temperature: 22,
  };
}

export function initFeedback2DState(p: Feedback2DParams): Feedback2DState {
  return {
    x: p.payloadOffsetX,
    y: p.payloadOffsetY,
    vx: 0,
    vy: 0,
    coilCurrents: [0, 0, 0, 0],
    errorIntegralX: 0,
    errorIntegralY: 0,
    errorHistoryX: [0],
    errorHistoryY: [0],
    controlTimer: 0,
    time: 0,
    crashed: false,
  };
}

export function getEigenParams2D(p: Feedback2DParams): Feedback2DEigenParams {
  return {
    kpXY: p.kpXY,
    kiXY: p.kiXY,
    kdXY: p.kdXY,
    coilImbalance: p.coilImbalance,
    mass: p.mass,
    temperature: p.temperature,
    loopDelay: p.loopDelay,
  };
}

export function computeEigenvalues2D(
  p: Feedback2DParams,
  openLoop = false,
): ComplexEigenvalue[] {
  if (openLoop) return openLoopEigenvalues2D(p.temperature);
  return closedLoopEigenvalues2D(getEigenParams2D(p));
}

export function eigenvalueSummary(): { module1: string; module2: string } {
  return {
    module1: '\\mathrm{Re}(\\lambda_z) > 0 \\text{ open-loop; closed-loop stabilizes } z',
    module2: '\\mathrm{Re}(\\lambda_x), \\mathrm{Re}(\\lambda_y) > 0 \\text{ open-loop; feedback stabilizes } x,y',
  };
}
