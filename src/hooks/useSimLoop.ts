import { useEffect, useRef } from 'react';
import { PHYSICS_DT } from '../physics/integrators';

interface UseSimLoopOptions {
  running: boolean;
  dt?: number;
  /** Called once per fixed physics substep (may run many times per frame). */
  onStep: (dt: number, frameDt: number) => void;
  /** Called once after all substeps in a frame — commit to React state here. */
  onFrame?: (frameDt: number) => void;
}

/** Fixed 1 ms physics timestep, decoupled from render via accumulator. */
export function useSimLoop({ running, dt = PHYSICS_DT, onStep, onFrame }: UseSimLoopOptions) {
  const onStepRef = useRef(onStep);
  const onFrameRef = useRef(onFrame);
  onStepRef.current = onStep;
  onFrameRef.current = onFrame;

  useEffect(() => {
    if (!running) return;

    let raf = 0;
    let last = performance.now();
    let accumulator = 0;

    const tick = (now: number) => {
      const frameDt = Math.min((now - last) / 1000, 0.025);
      last = now;
      accumulator += frameDt;

      let stepped = false;
      while (accumulator >= dt) {
        onStepRef.current(dt, frameDt);
        accumulator -= dt;
        stepped = true;
      }

      if (stepped) onFrameRef.current?.(frameDt);

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, dt]);
}

/** Draw helper for canvas line plots. */
export function drawLinePlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: { x: number; y: number }[],
  opts: {
    xLabel?: string;
    yLabel?: string;
    color?: string;
    pad?: number;
    yZero?: boolean;
  } = {},
) {
  const pad = opts.pad ?? 40;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, width, height);

  if (data.length < 2) return;

  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (opts.yZero) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yRange = yMax - yMin || 1;
  const xRange = xMax - xMin || 1;

  const toX = (x: number) => pad + ((x - xMin) / xRange) * plotW;
  const toY = (y: number) => pad + plotH - ((y - yMin) / yRange) * plotH;

  // Grid
  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 1;
  if (opts.yZero && yMin < 0 && yMax > 0) {
    ctx.beginPath();
    ctx.moveTo(pad, toY(0));
    ctx.lineTo(pad + plotW, toY(0));
    ctx.stroke();
  }

  ctx.strokeStyle = opts.color ?? '#4fc3f7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const px = toX(d.x);
    const py = toY(d.y);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  ctx.fillStyle = '#8899aa';
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  if (opts.xLabel) ctx.fillText(opts.xLabel, pad, height - 8);
  if (opts.yLabel) {
    ctx.save();
    ctx.translate(12, pad + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }
}

export interface LineSeries {
  data: { x: number; y: number }[];
  color: string;
  label?: string;
}

/** Multiple time-series on one axes (Module 2 position / coil traces). */
export function drawMultiLinePlot(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  series: LineSeries[],
  opts: {
    xLabel?: string;
    yLabel?: string;
    pad?: number;
    yZero?: boolean;
    refLines?: { y: number; color: string; dash?: number[]; label?: string }[];
  } = {},
) {
  const pad = opts.pad ?? 40;
  const plotW = width - pad * 2;
  const plotH = height - pad * 2;

  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, width, height);

  const allPoints = series.flatMap((s) => s.data);
  if (allPoints.length < 2) return;

  const xs = allPoints.map((d) => d.x);
  const ys = allPoints.map((d) => d.y);
  let yMin = Math.min(...ys);
  let yMax = Math.max(...ys);
  if (opts.yZero) {
    yMin = Math.min(yMin, 0);
    yMax = Math.max(yMax, 0);
  }
  opts.refLines?.forEach((line) => {
    yMin = Math.min(yMin, line.y);
    yMax = Math.max(yMax, line.y);
  });
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yRange = yMax - yMin || 1;
  const xRange = xMax - xMin || 1;

  const toX = (x: number) => pad + ((x - xMin) / xRange) * plotW;
  const toY = (y: number) => pad + plotH - ((y - yMin) / yRange) * plotH;

  ctx.strokeStyle = '#1a2332';
  ctx.lineWidth = 1;
  if (opts.yZero && yMin < 0 && yMax > 0) {
    ctx.beginPath();
    ctx.moveTo(pad, toY(0));
    ctx.lineTo(pad + plotW, toY(0));
    ctx.stroke();
  }

  opts.refLines?.forEach((line) => {
    ctx.strokeStyle = line.color;
    ctx.setLineDash(line.dash ?? [6, 4]);
    ctx.beginPath();
    ctx.moveTo(pad, toY(line.y));
    ctx.lineTo(pad + plotW, toY(line.y));
    ctx.stroke();
    ctx.setLineDash([]);
  });

  series.forEach((s) => {
    if (s.data.length < 2) return;
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    s.data.forEach((d, i) => {
      const px = toX(d.x);
      const py = toY(d.y);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.stroke();
  });

  ctx.font = '10px "IBM Plex Sans", sans-serif';
  let legendX = pad;
  series.forEach((s) => {
    if (!s.label) return;
    ctx.fillStyle = s.color;
    ctx.fillRect(legendX, 8, 10, 10);
    ctx.fillStyle = '#8899aa';
    ctx.fillText(s.label, legendX + 14, 17);
    legendX += ctx.measureText(s.label).width + 28;
  });

  ctx.fillStyle = '#8899aa';
  ctx.font = '11px "IBM Plex Sans", sans-serif';
  if (opts.xLabel) ctx.fillText(opts.xLabel, pad, height - 8);
  if (opts.yLabel) {
    ctx.save();
    ctx.translate(12, pad + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(opts.yLabel, 0, 0);
    ctx.restore();
  }
}

export function drawPhasePortrait(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  unstableAxes: 'z' | 'xy',
) {
  const pad = 30;
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, width, height);

  const cx = width / 2;
  const cy = height / 2;

  ctx.strokeStyle = '#334455';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, cy);
  ctx.lineTo(width - pad, cy);
  ctx.moveTo(cx, pad);
  ctx.lineTo(cx, height - pad);
  ctx.stroke();

  ctx.strokeStyle = unstableAxes === 'z' ? '#ff6b6b' : '#4fc3f7';
  ctx.lineWidth = 2;

  if (unstableAxes === 'z') {
    // Unstable manifold along vertical
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + i * (height / 2 - pad));
      ctx.stroke();
    }
    ctx.fillStyle = '#8899aa';
    ctx.font = '12px sans-serif';
    ctx.fillText('unstable: z', pad, pad + 12);
    ctx.fillStyle = '#66bb6a';
    ctx.fillText('stable: x, y', pad, pad + 28);
  } else {
    for (let i = -1; i <= 1; i += 2) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + i * (width / 2 - pad), cy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx, cy + i * (height / 2 - pad) * 0.3);
      ctx.stroke();
    }
    ctx.fillStyle = '#8899aa';
    ctx.font = '12px sans-serif';
    ctx.fillText('unstable: x, y', pad, pad + 12);
    ctx.fillStyle = '#66bb6a';
    ctx.fillText('stable: z', pad, pad + 28);
  }
}
