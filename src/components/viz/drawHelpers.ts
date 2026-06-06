/** Shared canvas drawing helpers for levitation visuals. */

export function setupCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export function drawReferencePlane(
  ctx: CanvasRenderingContext2D,
  y: number,
  width: number,
  color = 'rgba(79, 195, 247, 0.15)',
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(width, y);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function drawGlowOrb(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  opts: { color?: string; glow?: string; alpha?: number } = {},
) {
  const color = opts.color ?? '#e0e8ff';
  const glow = opts.glow ?? '#4fc3f7';
  const alpha = opts.alpha ?? 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = glow;
  ctx.shadowBlur = radius * 2.5;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(0.6, glow);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawBarMagnet(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  fixed: boolean,
) {
  ctx.fillStyle = fixed ? '#455a64' : '#78909c';
  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 1;
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
  ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);
  // poles
  ctx.fillStyle = '#ef5350';
  ctx.fillRect(cx - w / 2, cy - h / 2, w, h * 0.25);
  ctx.fillStyle = '#42a5f5';
  ctx.fillRect(cx - w / 2, cy + h * 0.25, w, h * 0.25);
}

export function drawCoil(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  current: number,
) {
  const intensity = Math.min(1, Math.abs(current) / 2);
  ctx.strokeStyle = `rgba(79, 195, 247, ${0.4 + intensity * 0.5})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + i * 4, w / 2, h / 6, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function drawGlobe(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  wobble: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wobble);
  drawGlowOrb(ctx, 0, 0, r, { color: '#b3e5fc', glow: '#4fc3f7' });
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.95, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.85, r * 0.3, 0.3, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function zToPixelY(z: number, zMin: number, zMax: number, height: number, pad = 40): number {
  const t = (z - zMin) / (zMax - zMin);
  return height - pad - t * (height - pad * 2);
}

export function zToPixelX(z: number, zMin: number, zMax: number, width: number, pad = 40): number {
  const t = (z - zMin) / (zMax - zMin);
  return pad + t * (width - pad * 2);
}

/** Side-view schematic for Module 4 — rotor, floater, and trap geometry. */
export function drawDynamicalSideView(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  opts: {
    zf: number;
    zTrap: number;
    rotorY: number;
    deltaR: number;
    deltaRCritical: number;
    coupled: boolean;
    rotorRpm: number;
  },
) {
  const pad = 36;
  const zMin = 0;
  const zMax = 0.11;
  const toY = (z: number) => height - pad - ((z - zMin) / (zMax - zMin)) * (height - pad * 2);
  const cx = width * 0.52;

  ctx.fillStyle = '#080c12';
  ctx.fillRect(0, 0, width, height);

  // Base platform
  const baseY = toY(0);
  ctx.fillStyle = '#37474f';
  ctx.fillRect(pad, baseY, width - pad * 2, 8);
  ctx.fillStyle = '#8899aa';
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  ctx.fillText('Base', pad, baseY + 22);

  // Trap hover plane (when coupled)
  if (opts.coupled) {
    const trapY = toY(opts.zTrap);
    ctx.strokeStyle = 'rgba(129, 199, 132, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(cx - 55, trapY);
    ctx.lineTo(cx + 55, trapY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#81c784';
    ctx.fillText(`hover plane z₀ = ${(opts.zTrap * 100).toFixed(1)} cm`, cx - 72, trapY - 8);
  }

  // Rotor (motor-driven cross)
  const rotorY = toY(opts.rotorY);
  ctx.save();
  ctx.translate(cx, rotorY);
  ctx.fillStyle = '#c62828';
  ctx.fillRect(-28, -4, 56, 8);
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(-4, -28, 8, 56);
  ctx.restore();
  ctx.fillStyle = '#e0e8ff';
  ctx.fillText(`Rotor (${opts.rotorRpm.toLocaleString()} rpm)`, cx + 34, rotorY - 6);
  ctx.fillStyle = '#8899aa';
  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.fillText('motor spins this — floater does not', cx + 34, rotorY + 8);

  // Floater
  const floaterY = toY(opts.zf);
  drawGlowOrb(ctx, cx, floaterY, 10, {
    glow: opts.coupled ? '#4fc3f7' : '#ff8a65',
    alpha: opts.coupled ? 1 : 0.7,
  });
  ctx.fillStyle = opts.coupled ? '#4fc3f7' : '#ff8a65';
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  ctx.fillText('Passive floater', cx + 18, floaterY + 4);

  // Vertical gap arrow
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  const arrowX = cx - 60;
  ctx.beginPath();
  ctx.moveTo(arrowX, floaterY);
  ctx.lineTo(arrowX, rotorY);
  ctx.stroke();
  ctx.fillStyle = '#8899aa';
  ctx.fillText(`${((opts.rotorY - opts.zf) * 100).toFixed(1)} cm`, arrowX - 28, (floaterY + rotorY) / 2);

  // δ_R readout
  ctx.fillStyle = opts.coupled ? '#81c784' : '#ff8a65';
  ctx.fillText(
    `δ_R = ${(opts.deltaR * 100).toFixed(2)} cm  (need ≥ ${(opts.deltaRCritical * 100).toFixed(2)} cm)`,
    pad,
    pad + 12,
  );
  ctx.fillStyle = '#8899aa';
  ctx.fillText(opts.coupled ? 'Coupled — frequency lock & vertical trap' : 'Decoupled — floater falls', pad, pad + 28);
}

export interface EarnshawForcePlotOpts {
  currentZ: number;
  currentForce: number;
  equilibriumZ: number | null;
  restZ?: number;
  stableBands: Array<{ z0: number; z1: number }>;
  unstableBands: Array<{ z0: number; z1: number }>;
  zMin?: number;
  zMax?: number;
}

/** F(z) plot with stability shading and live levitator marker (Module 0). */
export function drawEarnshawForcePlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: { x: number; y: number }[],
  opts: EarnshawForcePlotOpts,
) {
  const pad = 44;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;
  const zMinM = opts.zMin ?? 0.004;
  const zMaxM = opts.zMax ?? 0.12;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, width, height);

  if (data.length < 2) return;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  let yMin = Math.min(...ys, 0);
  let yMax = Math.max(...ys, 0);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yRange = yMax - yMin || 1;
  const xRange = xMax - xMin || 1;

  const toX = (x: number) => pad + ((x - xMin) / xRange) * plotW;
  const toY = (y: number) => pad + plotH - ((y - yMin) / yRange) * plotH;
  const zToX = (zM: number) => toX(zM * 100);

  const shadeBand = (z0m: number, z1m: number, color: string) => {
    const x0 = zToX(Math.max(z0m, zMinM));
    const x1 = zToX(Math.min(z1m, zMaxM));
    if (x1 <= x0) return;
    ctx.fillStyle = color;
    ctx.fillRect(x0, pad, x1 - x0, plotH);
  };

  opts.stableBands.forEach((b) => shadeBand(b.z0, b.z1, 'rgba(102, 187, 106, 0.28)'));
  opts.unstableBands.forEach((b) => shadeBand(b.z0, b.z1, 'rgba(255, 82, 82, 0.22)'));

  if (opts.restZ !== undefined && opts.stableBands.length === 0) {
    shadeBand(opts.restZ - 0.008, opts.restZ + 0.004, 'rgba(102, 187, 106, 0.28)');
  }

  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, toY(0));
  ctx.lineTo(pad + plotW, toY(0));
  ctx.stroke();

  ctx.strokeStyle = '#ff8a65';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const px = toX(d.x);
    const py = toY(d.y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  if (opts.equilibriumZ !== null) {
    const eqX = zToX(opts.equilibriumZ);
    ctx.strokeStyle = 'rgba(255, 235, 59, 0.85)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(eqX, pad);
    ctx.lineTo(eqX, pad + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffeb3b';
    ctx.font = '10px "IBM Plex Sans", sans-serif';
    ctx.fillText('z_eq', eqX + 3, pad + 11);
  }

  const curX = zToX(opts.currentZ);
  const curY = toY(opts.currentForce);
  ctx.strokeStyle = 'rgba(79, 195, 247, 0.45)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(curX, pad);
  ctx.lineTo(curX, pad + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = '#4fc3f7';
  ctx.strokeStyle = '#e0e8ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(curX, curY, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#4fc3f7';
  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.fillText(`z = ${(opts.currentZ * 100).toFixed(2)} cm`, Math.min(curX + 8, width - 88), curY - 10);

  ctx.fillStyle = '#8899aa';
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  ctx.fillText('z (cm)', pad, height - 8);
  ctx.save();
  ctx.translate(12, pad + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('F(z)', 0, 0);
  ctx.restore();

  ctx.font = '10px "IBM Plex Sans", sans-serif';
  ctx.fillStyle = '#66bb6a';
  ctx.fillRect(pad, 6, 8, 8);
  ctx.fillStyle = '#8899aa';
  ctx.fillText('restoring', pad + 12, 14);
  ctx.fillStyle = '#ff5252';
  ctx.fillRect(pad + 72, 6, 8, 8);
  ctx.fillStyle = '#8899aa';
  ctx.fillText('unstable', pad + 84, 14);
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(pad + 138, 10, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8899aa';
  ctx.fillText('floater', pad + 146, 14);
}
