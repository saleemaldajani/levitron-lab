import { useCallback, useEffect, useRef, useState } from 'react';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import {
  drawBarMagnet,
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
import {
  DEFAULT_EARNSHAW,
  type EarnshawParams,
  type EarnshawState,
  classifyEarnshaw,
  curvatureAt,
  earnshawPreset,
  findEquilibrium,
  sampleForceCurve,
  stepEarnshaw,
} from '../physics/earnshaw';
import { PHYSICS_DT } from '../physics/integrators';
import type { StabilityStatus } from '../types';

export function Module0Earnshaw() {
  const [params, setParams] = useState<EarnshawParams>({ ...DEFAULT_EARNSHAW });
  const [state, setState] = useState<EarnshawState>({ z: 0.03, vz: 0, crashed: false });
  const [running, setRunning] = useState(true);
  const [status, setStatus] = useState<StabilityStatus>('DRIFTING');
  const heroRef = useRef<HTMLCanvasElement>(null);
  const forcePlotRef = useRef<HTMLCanvasElement>(null);
  const curve = sampleForceCurve(params);
  const eq = findEquilibrium(params);
  const curv = eq !== null ? curvatureAt(eq, params) : null;

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback(
      (dt) => {
        setState((s) => {
          const next = stepEarnshaw(s, params, dt);
          setStatus(classifyEarnshaw(next));
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
    const baseY = h - 55;
    const zMin = 0.005;
    const zMax = 0.1;
    const floatY = zToPixelY(state.z, zMin, zMax, h, 50);

    drawReferencePlane(ctx, floatY, w, 'rgba(255, 82, 82, 0.2)');
    if (eq !== null) {
      const eqY = zToPixelY(eq, zMin, zMax, h, 50);
      drawReferencePlane(ctx, eqY, w, 'rgba(255, 235, 59, 0.25)');
    }

    drawBarMagnet(ctx, cx, baseY, 48, 22, true);
    drawBarMagnet(ctx, cx, floatY, 38, 18, false);
    drawGlowOrb(ctx, cx, floatY, 14, {
      glow: status === 'CRASHED' ? '#ff5252' : '#4fc3f7',
      alpha: state.crashed ? 0.4 : 1,
    });

    ctx.fillStyle = '#8899aa';
    ctx.font = '11px sans-serif';
    ctx.fillText('fixed magnet', cx - 30, baseY + 38);
    ctx.fillText(`z = ${(state.z * 100).toFixed(1)} cm`, cx + 30, floatY - 18);
  }, [state, eq, status]);

  useEffect(() => {
    const canvas = forcePlotRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const forceData = curve.map((p) => ({ x: p.z * 100, y: p.force }));
    drawLinePlot(ctx, w, h, forceData, { xLabel: 'z (cm)', yLabel: 'F(z)', color: '#ff8a65', yZero: true });
  }, [curve]);

  const reset = () => {
    setState({ z: eq ?? 0.03, vz: 0, crashed: false });
    setStatus('DRIFTING');
    setRunning(true);
  };

  const preset = () => {
    setParams(earnshawPreset());
    setState({ z: 0.03, vz: 0, crashed: false });
    setStatus('DRIFTING');
    setRunning(true);
  };

  return (
    <div className="module">
      <ModuleHeader
        dimension="0D Conceptual"
        title="Why This Is Hard: Earnshaw's Theorem"
        subtitle="Two bar magnets on a vertical axis — the free magnet finds balance, then slides off the hilltop."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} />

          <canvas ref={heroRef} className="hero-canvas" aria-label="Free magnet above fixed magnet" />

          <div className="slider-grid">
            <SliderControl label="Magnet separation" value={params.separation * 100} min={1} max={6} step={0.1} unit="cm" onChange={(v) => setParams((p) => ({ ...p, separation: v / 100 }))} />
            <SliderControl label="Magnet strength" value={params.magnetStrength} min={0.3} max={2} step={0.05} onChange={(v) => setParams((p) => ({ ...p, magnetStrength: v }))} />
            <SliderControl label="Floater mass" value={params.mass * 1000} min={4} max={20} step={0.5} unit="g" onChange={(v) => setParams((p) => ({ ...p, mass: v / 1000 }))} />
          </div>

          <div className="secondary-panels">
            <canvas ref={forcePlotRef} className="sim-canvas small" />
          </div>

          <div className="readouts">
            {eq !== null ? (
              <>
                <span>Equilibrium z = {(eq * 100).toFixed(2)} cm</span>
                <span className={curv !== null && curv < 0 ? 'unstable' : ''}>
                  ∂²U/∂z² {curv !== null && curv < 0 ? '< 0 (unstable max)' : ''}
                </span>
              </>
            ) : (
              <span>No equilibrium — object falls or flies away</span>
            )}
          </div>
        </div>

        <PhysicsPanel
          experiment="Release the top magnet near equilibrium. It cannot stay — the balance point is a hilltop, not a bowl."
          citations={<p>Earnshaw <CiteLink id={6} /> <CiteLink id={7} /> <CiteLink id={9} /></p>}
        >
          <p>Earnshaw forbids stable equilibrium for a dipole in a static field — wherever F = 0, it is a saddle.</p>
          <KatexBlock display math="F(z) = F_{\mathrm{mag}}(z) - mg" />
          <div className="escape-routes">
            <h4>Three escape routes</h4>
            <ol>
              <li><strong>Active feedback</strong> — Modules 1 &amp; 2</li>
              <li><strong>Gyroscopic spin</strong> — Module 3</li>
              <li><strong>Driven rotation</strong> — Module 4</li>
            </ol>
          </div>
        </PhysicsPanel>
      </div>
    </div>
  );
}
