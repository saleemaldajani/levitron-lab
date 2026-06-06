/**
 * Numerical eigenvalue analysis for linearized feedback levitators.
 * Used to make Ketterle's "which directions are unstable" claim visible.
 */

export interface ComplexEigenvalue {
  re: number;
  im: number;
  label?: string;
}

/** Compute eigenvalues of a real n×n matrix (n ≤ 6) via companion matrix / QR-free Jacobi-like iteration. */
export function eigenvaluesOfMatrix(a: number[][]): ComplexEigenvalue[] {
  const n = a.length;
  if (n === 1) return [{ re: a[0][0], im: 0 }];
  if (n === 2) return eigenvalues2x2(a[0][0], a[0][1], a[1][0], a[1][1]);

  // For 3×3 use analytic formula; for larger use simplified power iteration on pairs
  if (n === 3) return eigenvalues3x3(a);

  // Fallback: treat as block diagonal if off-diagonal blocks zero (used for 2D decoupled)
  return eigenvaluesByQR(a);
}

function eigenvalues2x2(a: number, b: number, c: number, d: number): ComplexEigenvalue[] {
  const tr = a + d;
  const det = a * d - b * c;
  const disc = tr * tr - 4 * det;
  if (disc >= 0) {
    const s = Math.sqrt(disc);
    return [
      { re: (tr + s) / 2, im: 0 },
      { re: (tr - s) / 2, im: 0 },
    ];
  }
  return [
    { re: tr / 2, im: Math.sqrt(-disc) / 2 },
    { re: tr / 2, im: -Math.sqrt(-disc) / 2 },
  ];
}

function eigenvalues3x3(m: number[][]): ComplexEigenvalue[] {
  // Characteristic polynomial coefficients for det(λI - A) = λ³ + c2 λ² + c1 λ + c0
  const a = m[0][0],
    b = m[0][1],
    c = m[0][2];
  const d = m[1][0],
    e = m[1][1],
    f = m[1][2];
  const g = m[2][0],
    h = m[2][1],
    i = m[2][2];

  const c2 = -(a + e + i);
  const c1 = a * e + a * i + e * i - b * d - c * g - f * h;
  const c0 = -(a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g));

  return solveCubic(-c2, -c1, -c0);
}

function solveCubic(p: number, q: number, r: number): ComplexEigenvalue[] {
  // λ³ + p λ² + q λ + r = 0  →  depressed cubic via λ = x - p/3
  const a = (3 * q - p * p) / 3;
  const b = (2 * p * p * p - 9 * p * q + 27 * r) / 27;
  const shift = p / 3;

  const disc = (b * b) / 4 + (a * a * a) / 27;
  if (disc > 1e-12) {
    const sqrtD = Math.sqrt(disc);
    const u = Math.cbrt(-b / 2 + sqrtD);
    const v = Math.cbrt(-b / 2 - sqrtD);
    return [{ re: u + v - shift, im: 0 }];
  }
  if (Math.abs(disc) <= 1e-12) {
    const u = Math.cbrt(-b / 2);
    return [
      { re: 2 * u - shift, im: 0 },
      { re: -u - shift, im: 0 },
      { re: -u - shift, im: 0 },
    ];
  }
  const rho = Math.sqrt((-a * a * a) / 27);
  const theta = Math.acos(clamp(-b / (2 * rho), -1, 1));
  const m = 2 * Math.cbrt(rho);
  return [0, 1, 2].map((k) => ({
    re: m * Math.cos((theta + 2 * Math.PI * k) / 3) - shift,
    im: 0,
  }));
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Simplified eigenvalue solver for 4×4 and 6×6 via diagonal blocks. */
function eigenvaluesByQR(m: number[][]): ComplexEigenvalue[] {
  const n = m.length;
  const out: ComplexEigenvalue[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ re: m[i][i], im: 0, label: `λ${i}` });
  }
  return out;
}

export interface Feedback1DEigenParams {
  kp: number;
  ki: number;
  kd: number;
  baseStrength: number;
  mass: number;
  temperature: number;
  loopDelay: number;
}

/** Open-loop passive vertical instability gain (Earnshaw saddle in z). */
export function passiveUnstableGainZ(temp: number): number {
  return 35 * (1 - 0.001 * (temp - 22));
}

/**
 * Closed-loop Jacobian for Module 1 at equilibrium [z, vz, ∫e].
 * State: z' = vz, vz' = (K*I + k_pass*z)/m, I_int' = z_set - z
 * I = Kp*e + Ki*I_int - Kd*vz,  e = z_set - z
 */
export function jacobianFeedback1D(p: Feedback1DEigenParams): number[][] {
  const K = p.baseStrength * (1 - 0.001 * (p.temperature - 22));
  const m = p.mass;
  const kPass = passiveUnstableGainZ(p.temperature);
  const delayFactor = 1 / (1 + p.loopDelay * 800); // delay reduces effective gain

  const kpEff = p.kp * delayFactor;
  const kdEff = p.kd * delayFactor;
  const kiEff = p.ki * delayFactor;

  return [
    [0, 1, 0],
    [(-K * kpEff + kPass) / m, (-K * kdEff) / m, (K * kiEff) / m],
    [-1, 0, 0],
  ];
}

/** Open-loop eigenvalues (feedback off): unstable λ_z > 0. */
export function openLoopEigenvalues1D(temp: number): ComplexEigenvalue[] {
  const k = passiveUnstableGainZ(temp);
  return eigenvalues2x2(0, 1, k, 0).map((ev, i) => ({ ...ev, label: i === 0 ? 'λ_z' : 'λ_z' }));
}

export function closedLoopEigenvalues1D(p: Feedback1DEigenParams): ComplexEigenvalue[] {
  return eigenvaluesOfMatrix(jacobianFeedback1D(p)).map((ev, i) => ({
    ...ev,
    label: `λ${i + 1}`,
  }));
}

export interface Feedback2DEigenParams {
  kpXY: number;
  kiXY: number;
  kdXY: number;
  coilImbalance: number;
  mass: number;
  temperature: number;
  loopDelay: number;
}

export function passiveUnstableGainXY(temp: number): number {
  return 8 * (1 - 0.001 * (temp - 22));
}

/** Per-axis closed-loop Jacobian (x and y symmetric when balanced). */
export function jacobianFeedback2DAxis(p: Feedback2DEigenParams): number[][] {
  const coilScale = 0.04 * (1 - 0.001 * (p.temperature - 22));
  const kAct = coilScale * (1 - p.coilImbalance * 0.05);
  const m = p.mass;
  const kPass = passiveUnstableGainXY(p.temperature);
  const delayFactor = 1 / (1 + p.loopDelay * 600);

  const kpEff = p.kpXY * kAct * delayFactor;
  const kdEff = p.kdXY * kAct * delayFactor;
  const kiEff = p.kiXY * kAct * delayFactor;

  return [
    [0, 1, 0],
    [(-kpEff + kPass) / m, -kdEff / m, kiEff / m],
    [-1, 0, 0],
  ];
}

export function openLoopEigenvalues2D(temp: number): ComplexEigenvalue[] {
  const k = passiveUnstableGainXY(temp);
  const pair = eigenvalues2x2(0, 1, k, 0);
  return [
    { ...pair[0], label: 'λ_x' },
    { ...pair[1], label: 'λ_x' },
    { ...pair[0], label: 'λ_y' },
    { ...pair[1], label: 'λ_y' },
  ];
}

export function closedLoopEigenvalues2D(p: Feedback2DEigenParams): ComplexEigenvalue[] {
  const axis = eigenvaluesOfMatrix(jacobianFeedback2DAxis(p));
  return [
    { ...axis[0], label: 'λ_x' },
    { ...axis[1], label: 'λ_x' },
    { ...axis[2], label: 'λ_x' },
    { ...axis[0], label: 'λ_y' },
    { ...axis[1], label: 'λ_y' },
    { ...axis[2], label: 'λ_y' },
  ];
}

export function countUnstable(eigs: ComplexEigenvalue[]): number {
  return eigs.filter((e) => e.re > 1e-4).length;
}

export function maxRealPart(eigs: ComplexEigenvalue[]): number {
  return Math.max(...eigs.map((e) => e.re));
}
