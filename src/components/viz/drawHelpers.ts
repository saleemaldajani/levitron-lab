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
