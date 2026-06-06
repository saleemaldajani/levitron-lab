/**
 * Startup self-checks for each module at its default preset.
 * Logs PASS/FAIL to the console so regressions are visible immediately.
 */

import {
  earnshawPreset,
  findEquilibrium,
  initEarnshawState,
  netAccelerationZ,
  stepEarnshaw,
} from './earnshaw';
import {
  feedback1DPreset,
  initFeedback1DState,
  netAcceleration1D,
  stepFeedback1D,
} from './feedback1D';
import {
  feedback2DPreset,
  initFeedback2DState,
  netAcceleration2D,
  stepFeedback2D,
} from './feedback2D';
import {
  computeDiagnostics,
  gyroscopicPreset,
  initGyroscopicState,
  stepGyroscopic,
} from './gyroscopic';
import {
  deltaRCritical,
  dynamicalPreset,
  findTrapEquilibriumZ,
  hasTrappingMinimum,
  initDynamicalState,
  netAccelerationDynamical,
  stepDynamical,
} from './dynamicalRotor';
import { closedLoopEigenvalues1D, closedLoopEigenvalues2D, maxRealPart } from './eigenvalues';
import { PHYSICS_DT } from './integrators';

export interface StartupReport {
  module: string;
  verdict: 'PASS' | 'FAIL';
  firstStepAccel: number;
  details: Record<string, string | number | boolean>;
}

const ACCEL_LIMIT = {
  earnshaw: 0.5,
  feedback1D: 2,
  feedback2D: 2,
  gyroscopic: 3,
  dynamical: 2,
};

function logReport(report: StartupReport): void {
  const tag = report.verdict === 'PASS' ? 'PASS' : 'FAIL';
  console.info(`[Levitron Lab · Startup] ${report.module}: ${tag}`, {
    first_step_accel: report.firstStepAccel.toExponential(3),
    ...report.details,
    verdict: report.verdict,
  });
}

export function checkModule0(): StartupReport {
  const p = earnshawPreset();
  const s = initEarnshawState(p);
  const eq = findEquilibrium(p);
  const f0 = netAccelerationZ(s, p);
  const s1 = stepEarnshaw(s, p, PHYSICS_DT);
  const a1 = Math.abs((s1.vz - s.vz) / PHYSICS_DT);
  const pass =
    eq !== null &&
    Math.abs(f0) < 0.05 &&
    a1 < ACCEL_LIMIT.earnshaw &&
    !s1.crashed;
  const report: StartupReport = {
    module: 'Module 0 (Earnshaw)',
    verdict: pass ? 'PASS' : 'FAIL',
    firstStepAccel: a1,
    details: {
      equilibrium_z_cm: eq !== null ? (eq * 100).toFixed(2) : 'none',
      net_force_at_eq: Math.abs(f0) < 0.05 ? '~0' : f0.toFixed(4),
      unstable_curvature: eq !== null ? 'yes (by design)' : 'n/a',
    },
  };
  logReport(report);
  return report;
}

export function checkModule1(): StartupReport {
  const p = feedback1DPreset();
  const s = initFeedback1DState(p);
  const eigs = closedLoopEigenvalues1D({
    kp: p.kp,
    ki: p.ki,
    kd: p.kd,
    baseStrength: p.baseStrength,
    mass: p.mass,
    temperature: p.temperature,
    loopDelay: p.loopDelay,
  });
  const maxRe = maxRealPart(eigs);
  const a0 = Math.abs(netAcceleration1D(s, p));
  const s1 = stepFeedback1D(s, p, PHYSICS_DT, 0);
  const a1 = Math.abs((s1.vz - s.vz) / PHYSICS_DT);
  const pass = maxRe < -0.01 && a1 < ACCEL_LIMIT.feedback1D && !s1.crashed;
  const report: StartupReport = {
    module: 'Module 1 (1D feedback)',
    verdict: pass ? 'PASS' : 'FAIL',
    firstStepAccel: a1,
    details: {
      max_closed_loop_Re: maxRe.toFixed(3),
      poles_stable: maxRe < 0,
      net_accel_at_setpoint: a0.toFixed(4),
    },
  };
  logReport(report);
  return report;
}

export function checkModule2(): StartupReport {
  const p = feedback2DPreset();
  const s = initFeedback2DState(p);
  const eigs = closedLoopEigenvalues2D({
    kpXY: p.kpXY,
    kiXY: p.kiXY,
    kdXY: p.kdXY,
    coilImbalance: p.coilImbalance,
    mass: p.mass,
    temperature: p.temperature,
    loopDelay: p.loopDelay,
  });
  const maxRe = maxRealPart(eigs);
  const [ax0, ay0] = netAcceleration2D(s, p);
  let sim = s;
  for (let i = 0; i < 8000; i++) {
    sim = stepFeedback2D(sim, p, PHYSICS_DT, Math.random() * 2 - 1, Math.random() * 2 - 1);
    if (sim.crashed) break;
  }
  const s1 = stepFeedback2D(s, p, PHYSICS_DT, 0, 0);
  const a1 = Math.hypot((s1.vx - s.vx) / PHYSICS_DT, (s1.vy - s.vy) / PHYSICS_DT);
  const hoverRadius = Math.hypot(sim.x, sim.y);
  const pass =
    !sim.crashed &&
    hoverRadius < 0.012 &&
    a1 < ACCEL_LIMIT.feedback2D &&
    !s1.crashed;
  const report: StartupReport = {
    module: 'Module 2 (2D feedback)',
    verdict: pass ? 'PASS' : 'FAIL',
    firstStepAccel: a1,
    details: {
      max_closed_loop_Re: maxRe.toFixed(3),
      poles_stable: maxRe < 0,
      hover_radius_after_8s: hoverRadius.toFixed(4),
      net_accel_at_center: Math.hypot(ax0, ay0).toFixed(4),
    },
  };
  logReport(report);
  return report;
}

export function checkModule3(): StartupReport {
  const p = gyroscopicPreset();
  const s = initGyroscopicState(p);
  const d = computeDiagnostics(p, s.omega);
  const s1 = stepGyroscopic(s, p, PHYSICS_DT);
  const a1 = Math.hypot(
    (s1.vx - s.vx) / PHYSICS_DT,
    (s1.vy - s.vy) / PHYSICS_DT,
    (s1.vz - s.vz) / PHYSICS_DT,
  );
  const pass =
    d.inSpinWindow &&
    d.hasMinimum &&
    d.spinStabilityRatio > 3 &&
    a1 < ACCEL_LIMIT.gyroscopic &&
    !s1.crashed;
  const report: StartupReport = {
    module: 'Module 3 (gyroscopic)',
    verdict: pass ? 'PASS' : 'FAIL',
    firstStepAccel: a1,
    details: {
      'p_psi^2 / (4mglI_p cosθ)': d.spinStabilityRatio.toFixed(2),
      'U_res has min': d.hasMinimum,
      omega_rps: d.omega.toFixed(1),
      in_spin_window: d.inSpinWindow,
    },
  };
  logReport(report);
  return report;
}

export function checkModule4(): StartupReport {
  const p = dynamicalPreset();
  const zEq = findTrapEquilibriumZ(p);
  const hasMin = hasTrappingMinimum(p);
  const s = initDynamicalState(p);
  const az0 = netAccelerationDynamical(s, p);
  const s1 = stepDynamical(s, p, PHYSICS_DT);
  const a1 = Math.abs((s1.vzf - s.vzf) / PHYSICS_DT);
  const pass =
    hasMin &&
    Math.abs(az0) < 0.5 &&
    a1 < ACCEL_LIMIT.dynamical &&
    !s1.crashed;
  const report: StartupReport = {
    module: 'Module 4 (dynamical rotor)',
    verdict: pass ? 'PASS' : 'FAIL',
    firstStepAccel: a1,
    details: {
      'U_f has trapping min': hasMin,
      delta_R: p.deltaR.toFixed(4),
      delta_R_critical: deltaRCritical(p).toFixed(4),
      trap_z_cm: (zEq * 100).toFixed(2),
      net_accel_at_trap: az0.toFixed(4),
    },
  };
  logReport(report);
  return report;
}

export function runAllStartupChecks(): StartupReport[] {
  return [checkModule0(), checkModule1(), checkModule2(), checkModule3(), checkModule4()];
}
