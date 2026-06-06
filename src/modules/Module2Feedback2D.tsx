import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EigenPlaneCanvas, EigenvaluePanel } from '../components/EigenvaluePanel';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import { drawGlowOrb, drawReferencePlane, setupCanvas } from '../components/viz/drawHelpers';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { SliderControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { drawPhasePortrait, useSimLoop } from '../hooks/useSimLoop';
import { openLoopEigenvalues2D } from '../physics/eigenvalues';
import {
  DEFAULT_FEEDBACK2D,
  type Feedback2DParams,
  type Feedback2DState,
  classifyFeedback2D,
  computeEigenvalues2D,
  eigenvalueSummary,
  feedback2DPreset,
  initFeedback2DState,
  stepFeedback2D,
} from '../physics/feedback2D';
import { PHYSICS_DT } from '../physics/integrators';
import type { StabilityStatus } from '../types';

export function Module2Feedback2D() {
  const [params, setParams] = useState<Feedback2DParams>({ ...DEFAULT_FEEDBACK2D });
  const [state, setState] = useState<Feedback2DState>(() => initFeedback2DState(DEFAULT_FEEDBACK2D));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const heroRef = useRef<HTMLCanvasElement>(null);
  const phase1Ref = useRef<HTMLCanvasElement>(null);
  const phase2Ref = useRef<HTMLCanvasElement>(null);
  const ev = eigenvalueSummary();

  const eigsClosed = useMemo(() => computeEigenvalues2D(params, false), [params]);
  const eigsOpen = useMemo(() => openLoopEigenvalues2D(params.temperature), [params.temperature]);

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback(
      (dt) => {
        const nx = Math.random() * 2 - 1;
        const ny = Math.random() * 2 - 1;
        setState((s) => {
          const next = stepFeedback2D(s, params, dt, nx, ny);
          setStatus(classifyFeedback2D(next, params));
          if (next.crashed) setRunning(false);
          return next;
        });
      },
      [params],
    ),
  });

  useEffect(() => {
    const canvas = heroRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const scale = Math.min(w, h) * 0.38;

    drawReferencePlane(ctx, cy, w, 'rgba(102, 187, 106, 0.08)');

    const coils = [
      { x: cx, y: cy - scale, label: 'N', i: 0 },
      { x: cx + scale, y: cy, label: 'E', i: 1 },
      { x: cx, y: cy + scale, label: 'S', i: 2 },
      { x: cx - scale, y: cy, label: 'W', i: 3 },
    ];
    coils.forEach((c) => {
      const strength = params.coilStrengths[c.i] * (1 + params.coilImbalance * (c.i - 1.5) * 0.05);
      const cur = Math.abs(state.coilCurrents[c.i]);
      ctx.fillStyle = `rgba(79, 195, 247, ${0.25 + strength * 0.25 + cur * 0.15})`;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = `rgba(79, 195, 247, ${0.4 + cur * 0.3})`;
      ctx.lineWidth = 2 + cur;
      ctx.stroke();
      ctx.fillStyle = '#8899aa';
      ctx.font = '12px sans-serif';
      ctx.fillText(c.label, c.x - 4, c.y + 4);
    });

    const px = cx + state.x * scale * 10;
    const py = cy + state.y * scale * 10;
    const glow =
      status === 'LEVITATING' ? '#4fc3f7' : status === 'CRASHED' ? '#ff5252' : '#ffb74d';
    drawGlowOrb(ctx, px, py, 16, { glow, alpha: state.crashed ? 0.35 : 1 });

    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.stroke();

    ctx.fillStyle = '#8899aa';
    ctx.font='11px sans-serif';
    ctx.fillText(`x=${(state.x*100).toFixed(1)} y=${(state.y*100).toFixed(1)} cm`, 12, h - 12);
  }, [state, params, status]);

  useEffect(() => {
    [phase1Ref, phase2Ref].forEach((ref, i) => {
      const canvas = ref.current;
      if (!canvas) return;
      const ctx = setupCanvas(canvas);
      if (!ctx) return;
      drawPhasePortrait(ctx, canvas.clientWidth, canvas.clientHeight, i === 0 ? 'z' : 'xy');
    });
  }, []);

  const reset = () => {
    setRunning(true);
    setState(initFeedback2DState(params));
    setStatus('LEVITATING');
  };

  const preset = () => {
    const p = feedback2DPreset();
    setParams(p);
    setRunning(true);
    setState(initFeedback2DState(p));
    setStatus('LEVITATING');
  };

  return (
    <div className="module">
      <ModuleHeader
        dimension="2D Feedback"
        title="2D Feedback Levitator"
        subtitle="Top view — four coils recenter the payload; unstable in x and y without them."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} />
          <canvas ref={heroRef} className="hero-canvas square-hero" aria-label="Top-down four-coil levitator" />

          <div className="slider-grid">
            <SliderControl label="Kp (xy)" value={params.kpXY} min={20} max={300} step={5} onChange={(v) => setParams((p) => ({ ...p, kpXY: v }))} />
            <SliderControl label="Ki (xy)" value={params.kiXY} min={0} max={150} step={2} onChange={(v) => setParams((p) => ({ ...p, kiXY: v }))} />
            <SliderControl label="Kd (xy)" value={params.kdXY} min={2} max={50} step={1} onChange={(v) => setParams((p) => ({ ...p, kdXY: v }))} />
            <SliderControl label="Coil imbalance" value={params.coilImbalance} min={-1} max={1} step={0.05} onChange={(v) => setParams((p) => ({ ...p, coilImbalance: v }))} />
            <SliderControl label="Payload mass" value={params.mass * 1000} min={8} max={30} step={0.5} unit="g" onChange={(v) => setParams((p) => ({ ...p, mass: v / 1000 }))} />
            <SliderControl label="Offset x" value={params.payloadOffsetX * 100} min={-1} max={1} step={0.05} unit="cm" onChange={(v) => setParams((p) => ({ ...p, payloadOffsetX: v / 100 }))} />
            <SliderControl label="Offset y" value={params.payloadOffsetY * 100} min={-1} max={1} step={0.05} unit="cm" onChange={(v) => setParams((p) => ({ ...p, payloadOffsetY: v / 100 }))} />
            <SliderControl label="Temperature" value={params.temperature} min={15} max={45} step={0.5} unit="°C" onChange={(v) => setParams((p) => ({ ...p, temperature: v }))} />
            <SliderControl label="Loop delay" value={params.loopDelay * 1000} min={1} max={25} step={0.5} unit="ms" onChange={(v) => setParams((p) => ({ ...p, loopDelay: v / 1000 }))} />
          </div>

          <div className="secondary-panels">
            <canvas ref={phase1Ref} className="sim-canvas small" />
            <canvas ref={phase2Ref} className="sim-canvas small" />
          </div>

          <EigenvaluePanel
            title="Closed-loop eigenvalues (x, y)"
            eigenvalues={eigsClosed}
            compareOpenLoop={eigsOpen}
            highlightLabels={['λ_x', 'λ_y']}
          />
          <EigenPlaneCanvas eigenvalues={eigsClosed} width={280} height={100} />
        </div>

        <PhysicsPanel
          experiment="Detune coil imbalance until an eigenvalue crosses Re=0. Compare with Module 1 where λ_z is the culprit."
          citations={<p><CiteLink id={9} /></p>}
        >
          <p>Stable in z; <em>unstable in x and y</em> open-loop — four horizontal coils provide PID feedback.</p>
          <KatexBlock display math={ev.module1} />
          <KatexBlock display math={ev.module2} />
          <p><strong>P</strong> — pushes the payload back toward center when displaced.</p>
          <p><strong>I</strong> — removes steady offset from thermal drift or coil mismatch.</p>
          <p><strong>D</strong> — stops orbital wobble when gains are high.</p>
        </PhysicsPanel>
      </div>
    </div>
  );
}
