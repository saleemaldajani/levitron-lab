import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EigenPlaneCanvas, EigenvaluePanel } from '../components/EigenvaluePanel';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import {
  drawCoil,
  drawGlobe,
  drawGlowOrb,
  drawReferencePlane,
  setupCanvas,
  zToPixelY,
} from '../components/viz/drawHelpers';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { SliderControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { drawLinePlot, useSimLoop } from '../hooks/useSimLoop';
import { openLoopEigenvalues1D } from '../physics/eigenvalues';
import {
  DEFAULT_FEEDBACK1D,
  type Feedback1DParams,
  type Feedback1DState,
  classifyFeedback1D,
  computeEigenvalues1D,
  effectiveSetpoint,
  feedback1DPreset,
  initFeedback1DState,
  stepFeedback1D,
} from '../physics/feedback1D';
import { PHYSICS_DT } from '../physics/integrators';
import type { StabilityStatus } from '../types';

export function Module1Feedback1D() {
  const [params, setParams] = useState<Feedback1DParams>({ ...DEFAULT_FEEDBACK1D });
  const [state, setState] = useState<Feedback1DState>(() => initFeedback1DState(DEFAULT_FEEDBACK1D));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const heroRef = useRef<HTMLCanvasElement>(null);
  const gapCanvasRef = useRef<HTMLCanvasElement>(null);
  const currentCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<{ t: number; z: number; I: number }[]>([]);
  const noiseRef = useRef(0);

  const eigsClosed = useMemo(() => computeEigenvalues1D(params, false), [params]);
  const eigsOpen = useMemo(() => openLoopEigenvalues1D(params.temperature), [params.temperature]);
  const setpoint = effectiveSetpoint(params);

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback(
      (dt) => {
        noiseRef.current = Math.random() * 2 - 1;
        setState((s) => {
          const next = stepFeedback1D(s, params, dt, noiseRef.current);
          setStatus(classifyFeedback1D(next, params));
          if (next.crashed) setRunning(false);
          const hist = historyRef.current;
          hist.push({ t: next.time, z: next.z, I: next.coilCurrent });
          if (hist.length > 800) hist.shift();
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
    const cx = w / 2;

    ctx.fillStyle = '#080c12';
    ctx.fillRect(0, 0, w, h);

    const zMin = 0.005;
    const zMax = 0.035;
    const setY = zToPixelY(setpoint, zMin, zMax, h, 35);
    const objY = zToPixelY(Math.max(0.005, state.z), zMin, zMax, h, 35);

    drawReferencePlane(ctx, setY, w, 'rgba(255, 235, 59, 0.35)');
    drawCoil(ctx, cx, 28, 90, 20, state.coilCurrent);
    drawGlobe(ctx, cx, objY, 22, Math.sin(state.time * 8) * (status === 'DRIFTING' ? 0.08 : 0.02));

    if (status !== 'LEVITATING') {
      drawGlowOrb(ctx, cx, objY, 28, { glow: status === 'CRASHED' ? '#ff5252' : '#ffb74d', alpha: 0.3 });
    }

    ctx.strokeStyle = 'rgba(79, 195, 247, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 48);
    ctx.lineTo(cx, objY - 24);
    ctx.stroke();

    ctx.fillStyle = '#8899aa';
    ctx.font = '11px sans-serif';
    ctx.fillText(`gap ${(state.z * 100).toFixed(2)} cm`, cx + 30, objY);
    ctx.fillText(`set ${(setpoint * 100).toFixed(2)} cm`, cx + 30, setY - 6);
  }, [state, setpoint, status]);

  useEffect(() => {
    const drawHistory = (canvas: HTMLCanvasElement | null, key: 'z' | 'I', label: string, color: string) => {
      if (!canvas) return;
      const ctx = setupCanvas(canvas);
      if (!ctx) return;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const hist = historyRef.current;
      const data = hist.map((p) => ({ x: p.t, y: key === 'z' ? p.z * 100 : p.I }));
      drawLinePlot(ctx, w, h, data, { xLabel: 't (s)', yLabel: label, color, yZero: key === 'I' });
      if (key === 'z') {
        const ys = data.map((d) => d.y);
        const yMin = Math.min(...ys, setpoint * 100);
        const yMax = Math.max(...ys, setpoint * 100);
        const pad = 40;
        const plotH = h - pad * 2;
        const yRange = yMax - yMin || 1;
        const toY = (y: number) => pad + plotH - ((y - yMin) / yRange) * plotH;
        ctx.strokeStyle = '#ffeb3b';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(pad, toY(setpoint * 100));
        ctx.lineTo(w - pad, toY(setpoint * 100));
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };
    drawHistory(gapCanvasRef.current, 'z', 'gap (cm)', '#4fc3f7');
    drawHistory(currentCanvasRef.current, 'I', 'I (A)', '#ce93d8');
  });

  const reset = () => {
    historyRef.current = [];
    setRunning(true);
    setState(initFeedback1DState(params));
    setStatus('LEVITATING');
  };

  const preset = () => {
    const p = feedback1DPreset();
    setParams(p);
    historyRef.current = [];
    setRunning(true);
    setState(initFeedback1DState(p));
    setStatus('LEVITATING');
  };

  return (
    <div className="module">
      <ModuleHeader
        dimension="1D Feedback"
        title="1D Active Feedback Levitator"
        subtitle="Floating globe under the coil — stable left/right; feedback holds the vertical gap."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} />
          <canvas ref={heroRef} className="hero-canvas" aria-label="Floating globe under electromagnet" />

          <div className="slider-grid">
            <SliderControl label="Setpoint gap" value={params.setpointGap * 100} min={0.8} max={2.5} step={0.05} unit="cm" onChange={(v) => setParams((p) => ({ ...p, setpointGap: v / 100 }))} />
            <SliderControl label="Kp" value={params.kp} min={100} max={2000} step={10} onChange={(v) => setParams((p) => ({ ...p, kp: v }))} />
            <SliderControl label="Ki" value={params.ki} min={0} max={400} step={5} onChange={(v) => setParams((p) => ({ ...p, ki: v }))} />
            <SliderControl label="Kd" value={params.kd} min={5} max={120} step={1} onChange={(v) => setParams((p) => ({ ...p, kd: v }))} />
            <SliderControl label="Coil base strength" value={params.baseStrength} min={0.05} max={0.25} step={0.005} onChange={(v) => setParams((p) => ({ ...p, baseStrength: v }))} />
            <SliderControl label="Max coil current" value={params.maxCurrent} min={0.5} max={4} step={0.1} unit="A" onChange={(v) => setParams((p) => ({ ...p, maxCurrent: v }))} />
            <SliderControl label="Object mass" value={params.mass * 1000} min={6} max={25} step={0.5} unit="g" onChange={(v) => setParams((p) => ({ ...p, mass: v / 1000 }))} />
            <SliderControl label="Loop delay" value={params.loopDelay * 1000} min={0.5} max={20} step={0.5} unit="ms" onChange={(v) => setParams((p) => ({ ...p, loopDelay: v / 1000 }))} />
            <SliderControl label="Temperature" value={params.temperature} min={15} max={45} step={0.5} unit="°C" onChange={(v) => setParams((p) => ({ ...p, temperature: v }))} />
            <SliderControl label="Trim pot" value={params.trimPot} min={0} max={1} step={0.01} onChange={(v) => setParams((p) => ({ ...p, trimPot: v }))} />
          </div>

          <div className="secondary-panels">
            <canvas ref={gapCanvasRef} className="sim-canvas small" />
            <canvas ref={currentCanvasRef} className="sim-canvas small" />
          </div>

          <EigenvaluePanel
            title="Closed-loop eigenvalues (z axis)"
            eigenvalues={eigsClosed}
            compareOpenLoop={eigsOpen}
            highlightLabels={['λ_z']}
          />
          <EigenPlaneCanvas eigenvalues={eigsClosed} width={280} height={100} />

          <div className="readouts">
            <span>Gap: {(state.z * 100).toFixed(2)} cm (sag: {((setpoint - state.z) * 100).toFixed(2)} cm)</span>
            <span>I = {state.coilCurrent.toFixed(3)} A</span>
          </div>
        </div>

        <PhysicsPanel
          experiment="Set Ki = 0 and warm the temperature — the globe sags below setpoint. Raise Ki to erase the drift. Crank Kp until it oscillates."
          citations={<p><CiteLink id={9} /> <CiteLink id={1} /></p>}
        >
          <p>Only unstable in <em>z</em>; horizontal motion is passively stable.</p>
          <KatexBlock display math="I = \mathrm{clamp}(K_p e + K_i \int e\,dt + K_d \dot{e})" />
          <p><strong>P</strong> — pushes back in proportion to gap error (you see immediate bobbing).</p>
          <p><strong>I</strong> — erases slow thermal sag; without it the globe settles below setpoint when warmed.</p>
          <p><strong>D</strong> — damps oscillation when P is too high.</p>
          <KatexBlock display math="\text{Open-loop: } \mathrm{Re}(\lambda_z) > 0" />
        </PhysicsPanel>
      </div>
    </div>
  );
}
