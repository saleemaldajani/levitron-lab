import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { ButtonControl, SliderControl, ToggleControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { setupCanvas } from '../components/viz/drawHelpers';
import { drawLinePlot, useSimLoop } from '../hooks/useSimLoop';
import {
  type GyroscopicParams,
  type GyroscopicState,
  classifyGyroscopic,
  computeDiagnostics,
  criticalNutationAngle,
  gyroscopicPreset,
  initGyroscopicState,
  logStartupDiagnostics,
  nudgeGyroscopic,
  omegaMax,
  omegaMin,
  samplePotentialR,
  samplePotentialZ,
  sampleUresCurve,
  stepGyroscopic,
} from '../physics/gyroscopic';
import { exportRendererPng } from '../utils/exportFigure';
import { PHYSICS_DT } from '../physics/integrators';
import type { StabilityStatus } from '../types';

const THETA_HISTORY_LEN = 600;

export function Module3Gyroscopic() {
  const [params, setParams] = useState<GyroscopicParams>(() => gyroscopicPreset());
  const [state, setState] = useState<GyroscopicState>(() => initGyroscopicState(gyroscopicPreset()));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const potZRef = useRef<HTMLCanvasElement>(null);
  const potRRef = useRef<HTMLCanvasElement>(null);
  const uresRef = useRef<HTMLCanvasElement>(null);
  const thetaPlotRef = useRef<HTMLCanvasElement>(null);
  const topRef = useRef<THREE.Group | null>(null);
  const coneRef = useRef<THREE.Mesh | null>(null);
  const thetaHistoryRef = useRef<{ t: number; theta: number; thetaC: number }[]>([]);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
  } | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const wMin = omegaMin(params);
  const wMax = omegaMax(params);
  const thetaC = criticalNutationAngle(state.omega, params);
  const diag = useMemo(() => computeDiagnostics(params, state.omega), [params, state.omega]);

  useEffect(() => {
    logStartupDiagnostics(params, params.spinRate);
  }, []);
  const thetaDeg = (state.theta * 180) / Math.PI;
  const thetaCDeg = (thetaC * 180) / Math.PI;
  const insideCone = state.theta < thetaC;

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback(
      (dt) => {
        setState((s) => {
          const next = stepGyroscopic(s, params, dt);
          setStatus(classifyGyroscopic(next, params));
          if (next.crashed) setRunning(false);
          const tc = criticalNutationAngle(next.omega, params);
          const hist = thetaHistoryRef.current;
          hist.push({ t: next.time, theta: (next.theta * 180) / Math.PI, thetaC: (tc * 180) / Math.PI });
          if (hist.length > THETA_HISTORY_LEN) hist.shift();
          return next;
        });
      },
      [params],
    ),
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080c12);

    const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.01, 10);
    camera.position.set(0.14, 0.11, 0.2);
    camera.lookAt(0, 0.03, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x334455, 0.65));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(1, 2, 1);
    scene.add(dir);

    const ringMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.6, roughness: 0.4 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.008, 16, 64), ringMat);
    ring.rotation.x = Math.PI / 2;
    scene.add(ring);

    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.06, 0.008, 64), ringMat);
    plate.position.y = -0.004;
    scene.add(plate);

    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.025, 32),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.12 }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.001;
    shadow.name = 'hoverShadow';
    scene.add(shadow);

    // Allowable tilt cone (updated each frame)
    const coneH = 0.07;
    const coneGeo = new THREE.ConeGeometry(0.02, coneH, 32, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x66bb6a,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = coneH / 2;
    cone.name = 'tiltCone';
    scene.add(cone);
    coneRef.current = cone;

    // Wireframe cone edge for legibility
    const coneWire = new THREE.Mesh(
      coneGeo.clone(),
      new THREE.MeshBasicMaterial({ color: 0x66bb6a, wireframe: true, transparent: true, opacity: 0.25 }),
    );
    coneWire.position.y = coneH / 2;
    coneWire.name = 'tiltConeWire';
    scene.add(coneWire);

    // Vertical reference
    const vertGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.09, 0),
    ]);
    scene.add(new THREE.Line(vertGeo, new THREE.LineBasicMaterial({ color: 0x445566, transparent: true, opacity: 0.4 })));

    // Top: precession → nutation → spin hierarchy
    const topGroup = new THREE.Group();
    const precession = new THREE.Group();
    const nutation = new THREE.Group();
    const spin = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xc8d6e5, metalness: 0.35, roughness: 0.45 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.035, 32), bodyMat);
    body.position.y = 0.017;
    spin.add(body);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.012, 16), bodyMat);
    tip.position.y = -0.006;
    spin.add(tip);

    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.15 }),
    );
    glow.position.y = 0.02;
    spin.add(glow);

    // Symmetry axis (body +Y)
    const axisGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -0.015, 0),
      new THREE.Vector3(0, 0.045, 0),
    ]);
    const axisLine = new THREE.Line(axisGeo, new THREE.LineBasicMaterial({ color: 0xffeb3b, linewidth: 2 }));
    axisLine.name = 'symmetryAxis';
    spin.add(axisLine);

    nutation.add(spin);
    precession.add(nutation);
    topGroup.add(precession);
    topGroup.position.y = params.launchHeight;
    scene.add(topGroup);
    topRef.current = topGroup;

    sceneRef.current = { scene, renderer, camera };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const animate = () => {
      const sref = sceneRef.current;
      if (sref) sref.renderer.render(sref.scene, sref.camera);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Sync 3D scene to sim state
  useEffect(() => {
    const top = topRef.current;
    if (!top) return;

    top.position.set(state.x, state.z, state.y);
    const precession = top.children[0] as THREE.Group;
    const nutation = precession.children[0] as THREE.Group;
    const spin = nutation.children[0] as THREE.Group;

    precession.rotation.y = state.phi;
    nutation.rotation.x = state.theta;
    spin.rotation.y = state.psi;

    const glow = spin.children[2] as THREE.Mesh;
    (glow.material as THREE.MeshBasicMaterial).opacity =
      status === 'LEVITATING' ? 0.35 : status === 'CRASHED' ? 0.05 : 0.15;

    const axis = spin.getObjectByName('symmetryAxis') as THREE.Line | undefined;
    if (axis) {
      (axis.material as THREE.LineBasicMaterial).color.setHex(
        insideCone ? 0xffeb3b : 0xff5252,
      );
    }

    const shadow = top.parent?.getObjectByName('hoverShadow') as THREE.Mesh | undefined;
    if (shadow) {
      shadow.position.x = state.x;
      shadow.position.z = state.y;
      shadow.scale.setScalar(0.8 + state.z * 8);
      (shadow.material as THREE.MeshBasicMaterial).opacity = status === 'LEVITATING' ? 0.18 : 0.06;
    }

    // Update tilt cone at top position
    const tc = criticalNutationAngle(state.omega, paramsRef.current);
    const coneH = 0.07;
    const radius = coneH * Math.tan(Math.max(tc, 0.02));
    const scene = top.parent;
    if (scene) {
      ['tiltCone', 'tiltConeWire'].forEach((name) => {
        const mesh = scene.getObjectByName(name) as THREE.Mesh | undefined;
        if (mesh) {
          mesh.position.set(state.x, coneH / 2, state.y);
          mesh.scale.set(radius / 0.02, 1, radius / 0.02);
          const mat = mesh.material as THREE.MeshBasicMaterial;
          mat.color.setHex(insideCone ? 0x66bb6a : 0xff5252);
          mat.opacity = name === 'tiltCone' ? 0.1 : 0.28;
        }
      });
    }
  }, [state, status, insideCone]);

  const drawPot = useCallback(
    (canvas: HTMLCanvasElement | null, data: { val: number; u: number }[], xLabel: string) => {
      if (!canvas) return;
      const ctx = setupCanvas(canvas);
      if (!ctx) return;
      drawLinePlot(
        ctx,
        canvas.clientWidth,
        canvas.clientHeight,
        data.map((d) => ({ x: d.val * 100, y: d.u * 10000 })),
        { xLabel, yLabel: 'U', color: '#81c784' },
      );
    },
    [],
  );

  useEffect(() => {
    drawPot(potZRef.current, samplePotentialZ(state.omega, params).map((d) => ({ val: d.z, u: d.u })), 'z (cm)');
    drawPot(potRRef.current, samplePotentialR(state.omega, params).map((d) => ({ val: d.r, u: d.u })), 'r (cm)');
    const uresData = sampleUresCurve(state.pPsi, state.pPhi, params).map((d) => ({
      val: (d.theta * 180) / Math.PI,
      u: d.u * 1000,
    }));
    drawPot(uresRef.current, uresData, 'θ (°)');
  }, [state.omega, state.pPsi, state.pPhi, params, drawPot]);

  useEffect(() => {
    const canvas = thetaPlotRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const hist = thetaHistoryRef.current;
    const data = hist.map((p) => ({ x: p.t, y: p.theta }));
    drawLinePlot(ctx, w, h, data, { xLabel: 't (s)', yLabel: 'θ (°)', color: '#ce93d8' });

    if (hist.length > 1) {
      const tc = hist[hist.length - 1].thetaC;
      const ys = data.map((d) => d.y);
      const yMin = Math.min(...ys, 0, tc);
      const yMax = Math.max(...ys, tc * 1.2);
      const pad = 40;
      const plotH = h - pad * 2;
      const yRange = yMax - yMin || 1;
      const toY = (y: number) => pad + plotH - ((y - yMin) / yRange) * plotH;
      ctx.strokeStyle = '#66bb6a';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(pad, toY(tc));
      ctx.lineTo(w - pad, toY(tc));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#66bb6a';
      ctx.font = '10px sans-serif';
      ctx.fillText(`θ_c = ${tc.toFixed(1)}°`, pad + 4, toY(tc) - 4);
    }
  });

  const reset = () => {
    thetaHistoryRef.current = [];
    setRunning(true);
    setState(initGyroscopicState(params));
    setStatus('LEVITATING');
  };

  const preset = () => {
    const p = gyroscopicPreset();
    setParams(p);
    thetaHistoryRef.current = [];
    setRunning(true);
    setState(initGyroscopicState(p));
    setStatus('LEVITATING');
  };

  const nudge = () => {
    setState((s) => nudgeGyroscopic(s, params));
  };

  const spinPct = Math.max(0, Math.min(100, ((state.omega - wMin) / (wMax - wMin)) * 100));
  const tiltPct = Math.min(100, (state.theta / Math.max(thetaC, 0.01)) * 100);

  const thetaCAtParams = useMemo(
    () => criticalNutationAngle(params.spinRate, params),
    [params],
  );

  return (
    <div className="module">
      <ModuleHeader
        dimension="3D Gyroscopic"
        title="3D Gyroscopic Levitron"
        subtitle="Spin window and nutation cone — both must be satisfied for levitation."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid wide">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} />
          <div ref={containerRef} className="hero-canvas three-hero" data-figure="fig_gyro_stable" aria-label="Spinning top with tilt cone" />

          <div className="nutation-readouts">
            <div className={`nutation-stat ${insideCone ? 'ok' : 'warn'}`}>
              <span className="stat-label">θ(t)</span>
              <span className="stat-value">{thetaDeg.toFixed(1)}°</span>
            </div>
            <div className="nutation-stat">
              <span className="stat-label">θ_c</span>
              <span className="stat-value">{thetaCDeg.toFixed(1)}°</span>
            </div>
            <div className="nutation-stat">
              <span className="stat-label">θ / θ_c</span>
              <span className="stat-value">{(tiltPct).toFixed(0)}%</span>
            </div>
            <div className="nutation-stat">
              <span className="stat-label">At preset ω</span>
              <span className="stat-value">{((thetaCAtParams * 180) / Math.PI).toFixed(1)}°</span>
            </div>
          </div>

          <div className="stability-gauge">
            <div className="gauge-label">Spin window</div>
            <div className="gauge-bar">
              <div className="gauge-zone ok" style={{ left: '33%', width: '34%' }} />
              <div className="gauge-marker" style={{ left: `${spinPct}%` }} />
            </div>
            <div className="gauge-readout">
              ω = {state.omega.toFixed(1)} rps ({wMin.toFixed(0)} – {wMax.toFixed(0)})
            </div>
          </div>

          <div className="stability-gauge">
            <div className="gauge-label">Nutation vs allowable cone</div>
            <div className="gauge-bar">
              <div
                className={`gauge-fill ${insideCone ? 'ok' : 'warn'}`}
                style={{ width: `${Math.min(100, tiltPct)}%` }}
              />
              <div className="gauge-marker" style={{ left: '100%', opacity: 0.5 }} title="θ_c" />
            </div>
          </div>

          <div className="slider-grid">
            <SliderControl label="Top mass" value={params.mass * 1000} min={15} max={35} step={0.5} unit="g" onChange={(v) => setParams((p) => ({ ...p, mass: v / 1000 }))} />
            <SliderControl label="Base field strength" value={params.baseFieldStrength} min={0.5} max={1.5} step={0.05} onChange={(v) => setParams((p) => ({ ...p, baseFieldStrength: v }))} />
            <SliderControl label="Spin rate ω" value={params.spinRate} min={10} max={60} step={1} unit="rps" onChange={(v) => setParams((p) => ({ ...p, spinRate: v }))} />
            <SliderControl label="Launch height" value={params.launchHeight * 100} min={1.5} max={4} step={0.1} unit="cm" onChange={(v) => setParams((p) => ({ ...p, launchHeight: v / 100 }))} />
            <SliderControl label="Launch tilt θ₀" value={(params.nutationAngle * 180) / Math.PI} min={0} max={25} step={0.5} unit="°" onChange={(v) => setParams((p) => ({ ...p, nutationAngle: (v * Math.PI) / 180 }))} />
            <SliderControl label="Temperature" value={params.temperature} min={10} max={40} step={0.5} unit="°C" onChange={(v) => setParams((p) => ({ ...p, temperature: v }))} />
            <ToggleControl label="EM re-spin drive" checked={params.respinDrive} onChange={(v) => setParams((p) => ({ ...p, respinDrive: v }))} hint="Maintains ω — NOT what provides stability" />
          </div>

          <ButtonControl label="Nudge top (perturb θ)" onClick={nudge} />
          <ButtonControl
            label="Save figure"
            onClick={() => exportRendererPng(sceneRef.current?.renderer ?? null, 'fig_gyro_stable.png')}
          />

          <div className="secondary-panels three-col">
            <canvas ref={thetaPlotRef} className="sim-canvas small" data-figure="fig_gyro_theta_trace" />
            <canvas ref={uresRef} className="sim-canvas small" data-figure="fig_gyro_potential" />
            <canvas ref={potZRef} className="sim-canvas small" />
          </div>
          <p className="panel-caption">θ(t) · U_res(θ) well (θ_min &lt; θ &lt; θ_max) · U(z)</p>

          <div className="readouts">
            <span>U_res minimum: {diag.hasMinimum ? 'yes' : 'no'}</span>
            <span>p_ψ²/(4mglI_p cosθ) = {diag.spinStabilityRatio.toFixed(1)}</span>
            <span>θ range: {((diag.thetaMin * 180) / Math.PI).toFixed(1)}° – {((diag.thetaMax * 180) / Math.PI).toFixed(1)}°</span>
            <span>Height z = {(state.z * 100).toFixed(2)} cm</span>
          </div>
        </div>

        <PhysicsPanel
          experiment="Nudge the top with a small tilt impulse. Inside the green cone θ nodds and settles; past θ_c the axis diverges and it crashes. Warm the magnets or drop ω — watch θ_c shrink."
          citations={
            <p>
              Berry <CiteLink id={6} /> Simon et al. <CiteLink id={7} /> 8.223 project{' '}
              <CiteLink id={10} /> video <CiteLink id={11} /> <CiteLink id={9} />
            </p>
          }
        >
          <p>
            A spinning top has three Euler angles: <strong>ψ</strong> (spin about its symmetry axis),{' '}
            <strong>φ</strong> (precession about vertical), and <strong>θ</strong> (nutation — the tilt
            from upright). Fast spin gives gyroscopic rigidity that keeps θ nodding small.
          </p>
          <KatexBlock display math="I_1 \ddot{\theta} = \tau_{\mathrm{mag}}(\theta) + \tfrac{I_3 - I_1}{I_1}\,\dot{\phi}\,\dot{\psi}\,\sin\theta" />
          <p>
            The magnetic trap acts on <KatexBlock math="\mu \cos\theta" /> — as θ grows, restoring
            torque weakens. Above a critical angle <KatexBlock math="\theta_c" />, adiabatic following
            fails and the top tumbles. This is the same Lagrangian-top mechanics as in a classical
            mechanics course — and <KatexBlock math="\theta_c" /> is computable, not merely empirical.
          </p>
          <KatexBlock display math="U_{\mathrm{res}}(\theta)=\frac{p_\psi^2}{2I_s}+\frac{(p_\phi-p_\psi\cos\theta)^2}{2I_p\sin^2\theta}+V_{\mathrm{eff}}(\theta)" />
          <KatexBlock display math="\dot\varphi_{\mathrm{slow}}=\frac{mgl}{p_\psi},\quad \cos\theta_{\mathrm{stable}}=\frac{p_\phi}{p_\psi}" />
          <p>
            Bounded nutation requires <KatexBlock math="\theta_{\min}<\theta<\theta_{\max}" /> in the
            restoring well (MIT 8.223 project <CiteLink id={10} />). Both the spin-rate window and this
            nutation cone must hold — verify with the nudge button and tilt slider.
          </p>

          <div className="atom-trap-analogy">
            <h4>From toy to atom trap</h4>
            <p>
              Same adiabatic following — a neutral atom is a little gyroscope in a magnetic trap.
            </p>
          </div>
        </PhysicsPanel>
      </div>
    </div>
  );
}
