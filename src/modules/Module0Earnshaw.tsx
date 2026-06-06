import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import {
  drawBarMagnet,
  drawEarnshawForcePlot,
  drawGlowOrb,
  drawReferencePlane,
  setupCanvas,
  zToPixelY,
} from '../components/viz/drawHelpers';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { ButtonControl, SliderControl, ToggleControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { useSimLoop } from '../hooks/useSimLoop';
import {
  type EarnshawParams,
  adiabaticFieldStep,
  classifyEarnshaw,
  curvatureAt,
  displayZ,
  earnshawPreset,
  findEquilibrium,
  findStableRestPoint,
  greenWellPlotRange,
  initEarnshawState,
  isInStableBand,
  isNearStabilityMargin,
  lerpEarnshawParams,
  primaryStableBand,
  nudgeEarnshaw,
  sampleForceCurve,
  stabilityBands,
  stepEarnshaw,
  totalForceZ,
} from '../physics/earnshaw';
import { PHYSICS_DT } from '../physics/integrators';
import { checkModule0 } from '../physics/startupCheck';
import type { StabilityStatus } from '../types';

function initialBundle() {
  const params = earnshawPreset();
  return { params, state: initEarnshawState(params) };
}

export function Module0Earnshaw() {
  const [bundle] = useState(initialBundle);
  const [params, setParams] = useState(bundle.params);
  const [fineTune, setFineTune] = useState(true);
  const [simActive, setSimActive] = useState(false);
  const [running, setRunning] = useState(true);
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');

  const stateRef = useRef(bundle.state);
  const paramsRef = useRef(params);
  const targetParamsRef = useRef(params);
  const fieldParamsRef = useRef(params);
  const fineTuneRef = useRef(fineTune);
  const simActiveRef = useRef(simActive);
  paramsRef.current = params;
  targetParamsRef.current = params;
  fineTuneRef.current = fineTune;
  simActiveRef.current = simActive;

  const [state, setState] = useState(bundle.state);
  const [fieldParams, setFieldParams] = useState(params);
  stateRef.current = state;
  fieldParamsRef.current = fieldParams;

  const bands = useMemo(() => stabilityBands(fieldParams), [fieldParams]);
  const eq = findEquilibrium(fieldParams);
  const restZ = findStableRestPoint(fieldParams);
  const greenBand = useMemo(() => primaryStableBand(fieldParams, bands), [fieldParams, bands]);
  const plotRange = useMemo(
    () => greenWellPlotRange(fieldParams, eq, greenBand),
    [fieldParams, eq, greenBand],
  );
  const curve = useMemo(
    () => sampleForceCurve(fieldParams, plotRange.zMin, plotRange.zMax, 320),
    [fieldParams, plotRange],
  );
  const curv = eq !== null ? curvatureAt(eq, fieldParams) : null;
  const viewZ = displayZ(state, fieldParams);
  const currentForce = totalForceZ(state.z, fieldParams);
  const inGreen = isInStableBand(state.z, fieldParams);

  const heroRef = useRef<HTMLCanvasElement>(null);
  const forcePlotRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    checkModule0();
  }, []);

  const seatAtEquilibrium = useCallback((p: EarnshawParams) => {
    const seated = initEarnshawState(p);
    stateRef.current = seated;
    setState(seated);
    fieldParamsRef.current = p;
    targetParamsRef.current = p;
    setFieldParams(p);
    simActiveRef.current = false;
    setSimActive(false);
    setRunning(true);
    setStatus('LEVITATING');
    return seated;
  }, []);

  const updateParams = useCallback((patch: Partial<EarnshawParams>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      paramsRef.current = next;
      targetParamsRef.current = next;
      return next;
    });
    if (!stateRef.current.crashed) {
      simActiveRef.current = true;
      setSimActive(true);
      setRunning(true);
    }
  }, []);

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback((dt) => {
      const target = targetParamsRef.current;
      const fine = fineTuneRef.current;
      const alpha = fine ? 0.012 : 0.035;
      const smoothed = lerpEarnshawParams(fieldParamsRef.current, target, alpha);
      fieldParamsRef.current = smoothed;

      if (!simActiveRef.current) return;

      let next = stateRef.current;
      if (!next.nudged) {
        next = adiabaticFieldStep(next, smoothed, fine ? 0.1 : 0.055);
        if (isNearStabilityMargin(smoothed, next.z)) {
          next = stepEarnshaw(next, smoothed, dt);
        }
      } else {
        next = stepEarnshaw(next, smoothed, dt);
      }
      stateRef.current = next;
    }, []),
    onFrame: useCallback(() => {
      setFieldParams({ ...fieldParamsRef.current });
      const next = stateRef.current;
      setState(next);
      setStatus(classifyEarnshaw(next, fieldParamsRef.current));
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
    const baseY = h - 55;
    const zMin = 0.005;
    const zMax = 0.1;
    const floatY = zToPixelY(viewZ, zMin, zMax, h, 50);

    drawReferencePlane(ctx, floatY, w, 'rgba(255, 82, 82, 0.2)');
    if (eq !== null) {
      const eqY = zToPixelY(eq, zMin, zMax, h, 50);
      drawReferencePlane(ctx, eqY, w, 'rgba(255, 235, 59, 0.25)');
    }

    drawBarMagnet(ctx, cx, baseY, 48, 22, true);
    drawBarMagnet(ctx, cx, floatY, 38, 18, false);
    drawGlowOrb(ctx, cx, floatY, 14, {
      glow: status === 'CRASHED' || status === 'FLEW_OFF' ? '#ff5252' : '#4fc3f7',
      alpha: state.crashed ? 0.55 : 1,
    });

    ctx.fillStyle = '#8899aa';
    ctx.font = '11px sans-serif';
    ctx.fillText('fixed magnet', cx - 30, baseY + 38);
    ctx.fillText(`z = ${(state.z * 100).toFixed(1)} cm`, cx + 30, floatY - 18);
    if (!simActive && !state.crashed) {
      ctx.fillStyle = '#66bb6a';
      ctx.fillText('In restoring well — nudge or drift sliders toward the red hilltop', cx - 168, 24);
    } else if (state.crashed) {
      ctx.fillStyle = '#ff8a65';
      ctx.fillText('Off equilibrium — Reset to replay', cx - 70, 24);
    }
  }, [state, eq, status, viewZ, simActive]);

  useEffect(() => {
    const canvas = forcePlotRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const forceData = curve.map((p) => ({ x: p.z * 100, y: p.force }));
    drawEarnshawForcePlot(ctx, w, h, forceData, {
      currentZ: state.z,
      currentForce,
      equilibriumZ: eq,
      restZ,
      stableBands: bands.stable,
      unstableBands: bands.unstable,
      zMin: plotRange.zMin,
      zMax: plotRange.zMax,
    });
  }, [curve, bands, state.z, currentForce, eq, restZ, plotRange]);

  const reset = () => {
    seatAtEquilibrium(params);
  };

  const preset = () => {
    const p = earnshawPreset();
    setParams(p);
    seatAtEquilibrium(p);
  };

  const nudge = () => {
    const nudged = nudgeEarnshaw(stateRef.current, fieldParamsRef.current);
    stateRef.current = nudged;
    setState(nudged);
    simActiveRef.current = true;
    setSimActive(true);
    setRunning(true);
    setStatus('DRIFTING');
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
          <SimControls onReset={reset} onPreset={preset} onNudge={nudge} nudgeLabel="Nudge" />
          <ButtonControl label="Nudge — tip off hilltop" onClick={nudge} variant="primary" />

          <canvas ref={heroRef} className="hero-canvas" aria-label="Free magnet above fixed magnet" />

          <ToggleControl
            label="Fine tune (green well)"
            checked={fineTune}
            onChange={setFineTune}
            hint="Narrow slider ranges for small steps while exploring the restoring band"
          />

          <div className="slider-grid">
            <SliderControl
              label="Magnet separation"
              value={params.separation * 100}
              min={fineTune ? 1.8 : 0.5}
              max={fineTune ? 3.8 : 8}
              step={fineTune ? 0.01 : 0.02}
              unit="cm"
              format={(v) => v.toFixed(fineTune ? 2 : 1)}
              onChange={(v) => updateParams({ separation: v / 100 })}
            />
            <SliderControl
              label="Magnet strength"
              value={params.magnetStrength}
              min={fineTune ? 0.7 : 0.2}
              max={fineTune ? 1.05 : 2.5}
              step={fineTune ? 0.005 : 0.01}
              format={(v) => v.toFixed(fineTune ? 3 : 2)}
              onChange={(v) => updateParams({ magnetStrength: v })}
            />
            <SliderControl
              label="Floater mass"
              value={params.mass * 1000}
              min={fineTune ? 6 : 2}
              max={fineTune ? 10 : 30}
              step={fineTune ? 0.05 : 0.1}
              unit="g"
              format={(v) => v.toFixed(fineTune ? 2 : 1)}
              onChange={(v) => updateParams({ mass: v / 1000 })}
            />
          </div>

          <div className="secondary-panels">
            <div>
              <canvas ref={forcePlotRef} className="sim-canvas small" aria-label="Force curve with levitator position" />
              <p className="panel-caption">
                F(z) zoomed on green well ({(plotRange.zMin * 100).toFixed(2)}–{(plotRange.zMax * 100).toFixed(2)} cm)
              </p>
            </div>
          </div>

          <div className="readouts">
            {eq !== null ? (
              <>
                <span>Rest point ≈ {(restZ * 100).toFixed(2)} cm {inGreen ? '(green well)' : ''}</span>
                {greenBand ? (
                  <span className="green-band">
                    Green band {(greenBand.z0 * 100).toFixed(2)}–{(greenBand.z1 * 100).toFixed(2)} cm
                    ({((greenBand.z1 - greenBand.z0) * 100).toFixed(2)} cm wide)
                  </span>
                ) : null}
                <span>Unstable hilltop z_eq = {(eq * 100).toFixed(2)} cm</span>
                <span className={curv !== null && curv > 0 ? 'unstable' : ''}>
                  ∂F/∂z at hilltop {curv !== null && curv > 0 ? '> 0' : ''}
                </span>
              </>
            ) : (
              <span>No hilltop equilibrium — adjust parameters</span>
            )}
          </div>
        </div>

        <PhysicsPanel
          experiment="Starts in the green restoring well. Move sliders slowly — the field drifts and the magnet slides toward the red unstable hilltop before crashing."
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
