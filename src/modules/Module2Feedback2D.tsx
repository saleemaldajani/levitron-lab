import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EigenPlaneCanvas, EigenvaluePanel } from '../components/EigenvaluePanel';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import { drawGlowOrb, drawReferencePlane, setupCanvas } from '../components/viz/drawHelpers';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { SliderControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { drawMultiLinePlot, useSimLoop } from '../hooks/useSimLoop';
import { openLoopEigenvalues2D } from '../physics/eigenvalues';
import {
  type Feedback2DParams,
  type Feedback2DState,
  classifyFeedback2D,
  coilCommands,
  computeEigenvalues2D,
  eigenvalueSummary,
  feedback2DPreset,
  initFeedback2DState,
  nudgeFeedback2D,
  stepFeedback2D,
} from '../physics/feedback2D';
import { PHYSICS_DT, clamp } from '../physics/integrators';
import { checkModule2 } from '../physics/startupCheck';
import type { StabilityStatus } from '../types';

export function Module2Feedback2D() {
  const [params, setParams] = useState<Feedback2DParams>(() => feedback2DPreset());
  const [state, setState] = useState<Feedback2DState>(() => initFeedback2DState(feedback2DPreset()));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const stateRef = useRef(state);
  const paramsRef = useRef(params);
  const noiseRef = useRef({ x: 0, y: 0 });
  paramsRef.current = params;
  stateRef.current = state;

  const heroRef = useRef<HTMLCanvasElement>(null);
  const posCanvasRef = useRef<HTMLCanvasElement>(null);
  const coilCanvasRef = useRef<HTMLCanvasElement>(null);
  const historyRef = useRef<
    { t: number; x: number; y: number; ix: number; iy: number; err: number }[]
  >([]);
  const ev = eigenvalueSummary();

  const eigsClosed = useMemo(() => computeEigenvalues2D(params, false), [params]);
  const eigsOpen = useMemo(() => openLoopEigenvalues2D(params.temperature), [params.temperature]);

  useEffect(() => {
    checkModule2();
  }, []);

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback((dt) => {
      stateRef.current = stepFeedback2D(
        stateRef.current,
        paramsRef.current,
        dt,
        noiseRef.current.x,
        noiseRef.current.y,
      );
    }, []),
    onFrame: useCallback(() => {
      noiseRef.current = { x: Math.random() * 2 - 1, y: Math.random() * 2 - 1 };
      const next = stateRef.current;
      const p = paramsRef.current;
      const [ix, iy] = coilCommands(next.coilCurrents);
      const err = Math.hypot(next.x - p.payloadOffsetX, next.y - p.payloadOffsetY);
      const hist = historyRef.current;
      hist.push({
        t: next.time,
        x: next.x * 100,
        y: next.y * 100,
        ix,
        iy,
        err: err * 100,
      });
      if (hist.length > 800) hist.shift();
      setState(next);
      setStatus(classifyFeedback2D(next, p));
      if (next.crashed) setRunning(false);
    }, []),
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

    const px = cx + clamp(state.x, -0.04, 0.04) * scale * 10;
    const py = cy + clamp(state.y, -0.04, 0.04) * scale * 10;
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
    const hist = historyRef.current;
    const setX = params.payloadOffsetX * 100;
    const setY = params.payloadOffsetY * 100;

    const posCanvas = posCanvasRef.current;
    if (posCanvas) {
      const ctx = setupCanvas(posCanvas);
      if (ctx) {
        drawMultiLinePlot(ctx, posCanvas.clientWidth, posCanvas.clientHeight, [
          { data: hist.map((p) => ({ x: p.t, y: p.x })), color: '#4fc3f7', label: 'x' },
          { data: hist.map((p) => ({ x: p.t, y: p.y })), color: '#ffb74d', label: 'y' },
        ], {
          xLabel: 't (s)',
          yLabel: 'position (cm)',
          refLines: [
            { y: setX, color: 'rgba(79, 195, 247, 0.55)', dash: [5, 4] },
            { y: setY, color: 'rgba(255, 183, 77, 0.55)', dash: [5, 4] },
          ],
        });
      }
    }

    const coilCanvas = coilCanvasRef.current;
    if (coilCanvas) {
      const ctx = setupCanvas(coilCanvas);
      if (ctx) {
        drawMultiLinePlot(ctx, coilCanvas.clientWidth, coilCanvas.clientHeight, [
          { data: hist.map((p) => ({ x: p.t, y: p.ix })), color: '#ce93d8', label: 'i_x' },
          { data: hist.map((p) => ({ x: p.t, y: p.iy })), color: '#80cbc4', label: 'i_y' },
        ], {
          xLabel: 't (s)',
          yLabel: 'coil cmd',
          yZero: true,
        });
      }
    }
  }, [state, params.payloadOffsetX, params.payloadOffsetY]);

  const reset = () => {
    historyRef.current = [];
    setRunning(true);
    const s = initFeedback2DState(params);
    stateRef.current = s;
    setState(s);
    setStatus('LEVITATING');
  };

  const preset = () => {
    const p = feedback2DPreset();
    setParams(p);
    paramsRef.current = p;
    historyRef.current = [];
    setRunning(true);
    const s = initFeedback2DState(p);
    stateRef.current = s;
    setState(s);
    setStatus('LEVITATING');
  };

  const nudge = () => {
    const nudged = nudgeFeedback2D(stateRef.current);
    stateRef.current = nudged;
    setState(nudged);
  };

  return (
    <div className="module">
      <ModuleHeader
        dimension="2D Feedback"
        title="2D Feedback Levitator"
        subtitle="Top view — four coils recenter the payload; unstable in x and y without them."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid module-grid--2d">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} onNudge={nudge} nudgeLabel="Nudge payload" />
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

          <div className="secondary-panels live-plots">
            <div>
              <canvas ref={posCanvasRef} className="sim-canvas small" aria-label="Horizontal position vs time" />
              <p className="panel-caption">x, y position — dashed lines = setpoint (offset sliders)</p>
            </div>
            <div>
              <canvas ref={coilCanvasRef} className="sim-canvas small" aria-label="Coil PID commands vs time" />
              <p className="panel-caption">Coil commands i_x, i_y — watch Kp/Ki/Kd and delay change the trace</p>
            </div>
          </div>

          <div className="readouts">
            <span>
              x = {(state.x * 100).toFixed(2)} cm, y = {(state.y * 100).toFixed(2)} cm
              (err = {(Math.hypot(state.x - params.payloadOffsetX, state.y - params.payloadOffsetY) * 100).toFixed(2)} cm)
            </span>
            <span>
              i_x = {coilCommands(state.coilCurrents)[0].toFixed(3)}, i_y = {coilCommands(state.coilCurrents)[1].toFixed(3)}
            </span>
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
          experiment="Lower Kp or crank coil imbalance until an eigenvalue crosses Re=0 — then nudge the payload and watch it fly off. Long loop delay adds phase lag."
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
