import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import { drawDynamicalSideView, setupCanvas } from '../components/viz/drawHelpers';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { SliderControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { drawLinePlot, useSimLoop } from '../hooks/useSimLoop';
import {
  type DynamicalParams,
  type DynamicalState,
  classifyDynamical,
  deltaRCritical,
  displayFloaterZ,
  dynamicalPreset,
  findTrapEquilibriumZ,
  initDynamicalState,
  lockedSpinRatio,
  neodymiumSpinWindowEstimate,
  rotorOmega,
  sampleFloaterPotential,
  stepDynamical,
  trapStrength,
} from '../physics/dynamicalRotor';
import { PHYSICS_DT, clamp } from '../physics/integrators';
import { checkModule4 } from '../physics/startupCheck';
import type { StabilityStatus } from '../types';

/** Visual clearance between floater trap height and rotor in the 3D scene (m). */
const ROTOR_CLEARANCE = 0.038;

function rotorHeight(p: DynamicalParams): number {
  return p.rotorFloaterGap + ROTOR_CLEARANCE;
}

export function Module4Dynamical() {
  const [params, setParams] = useState<DynamicalParams>(() => dynamicalPreset());
  const [state, setState] = useState<DynamicalState>(() => initDynamicalState(dynamicalPreset()));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const potCanvasRef = useRef<HTMLCanvasElement>(null);
  const sideViewRef = useRef<HTMLCanvasElement>(null);
  const floaterRef = useRef<THREE.Group | null>(null);
  const rotorRef = useRef<THREE.Group | null>(null);
  const trapRingRef = useRef<THREE.Mesh | null>(null);
  const gapLineRef = useRef<THREE.Line | null>(null);
  const shadowRef = useRef<THREE.Mesh | null>(null);
  const sceneRef = useRef<{
    scene: THREE.Scene;
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
  } | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const dRc = deltaRCritical(params);
  const coupled = params.deltaR >= dRc;
  const zTrap = findTrapEquilibriumZ(params);
  const strength = trapStrength(params);
  const Rf = lockedSpinRatio(state.thetaF);
  const viewZf = displayFloaterZ(state);
  const rHeight = rotorHeight(params);

  useEffect(() => {
    checkModule4();
  }, []);

  useSimLoop({
    running: running && !state.crashed,
    dt: PHYSICS_DT,
    onStep: useCallback(
      (dt) => {
        setState((s) => {
          const next = stepDynamical(s, params, dt);
          setStatus(classifyDynamical(next, params));
          if (next.crashed) setRunning(false);
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

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.01,
      5,
    );
    camera.position.set(0.28, 0.045, 0.06);
    camera.lookAt(0, 0.04, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x334455, 0.7));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(1, 2, 0.5);
    scene.add(dir);

    const baseGeo = new THREE.CylinderGeometry(0.06, 0.065, 0.006, 48);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.5, roughness: 0.5 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0;
    scene.add(base);

    const shadowGeo = new THREE.CircleGeometry(0.012, 24);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.15 });
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.004;
    scene.add(shadow);
    shadowRef.current = shadow;

    const rotorGroup = new THREE.Group();
    rotorGroup.position.y = rotorHeight(paramsRef.current);
    const rotorBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.055, 0.012, 0.012),
      new THREE.MeshStandardMaterial({ color: 0xc62828, metalness: 0.4, roughness: 0.4 }),
    );
    const rotorBar2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.012, 0.012, 0.055),
      new THREE.MeshStandardMaterial({ color: 0x1565c0, metalness: 0.4, roughness: 0.4 }),
    );
    rotorGroup.add(rotorBar, rotorBar2);
    scene.add(rotorGroup);
    rotorRef.current = rotorGroup;

    const trapRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.018, 0.0012, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0x81c784, transparent: true, opacity: 0.55 }),
    );
    trapRing.rotation.x = Math.PI / 2;
    trapRing.position.y = paramsRef.current.rotorFloaterGap;
    scene.add(trapRing);
    trapRingRef.current = trapRing;

    const gapGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, paramsRef.current.rotorFloaterGap, 0),
      new THREE.Vector3(0, rotorHeight(paramsRef.current), 0),
    ]);
    const gapLine = new THREE.Line(
      gapGeo,
      new THREE.LineDashedMaterial({ color: 0x4fc3f7, dashSize: 0.008, gapSize: 0.005, transparent: true, opacity: 0.45 }),
    );
    gapLine.computeLineDistances();
    scene.add(gapLine);
    gapLineRef.current = gapLine;

    const floaterGroup = new THREE.Group();
    const floaterMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.012, 28, 28),
      new THREE.MeshStandardMaterial({ color: 0xe8f0ff, emissive: 0x336688, emissiveIntensity: 0.55 }),
    );
    const floaterGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.019, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.28 }),
    );
    floaterGroup.add(floaterGlow, floaterMesh);
    floaterGroup.position.set(0, params.rotorFloaterGap, 0);
    scene.add(floaterGroup);
    floaterRef.current = floaterGroup;

    sceneRef.current = { scene, renderer, camera };

    const onResize = () => {
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    const animate = () => {
      if (rotorRef.current) {
        rotorRef.current.rotation.y += rotorOmega(paramsRef.current) * (1 / 60);
      }
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

  useEffect(() => {
    if (rotorRef.current) {
      rotorRef.current.position.y = rHeight;
    }
    if (trapRingRef.current) {
      trapRingRef.current.position.y = zTrap;
      trapRingRef.current.visible = coupled;
      const mat = trapRingRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = coupled ? 0.55 : 0.1;
      mat.color.set(coupled ? 0x81c784 : 0xff8a65);
    }
    if (gapLineRef.current) {
      const pts = [
        new THREE.Vector3(0, viewZf, 0),
        new THREE.Vector3(0, rHeight, 0),
      ];
      gapLineRef.current.geometry.dispose();
      gapLineRef.current.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      gapLineRef.current.computeLineDistances();
      gapLineRef.current.visible = !state.crashed;
    }
  }, [rHeight, zTrap, coupled, viewZf, state.crashed]);

  useEffect(() => {
    const floater = floaterRef.current;
    const shadow = shadowRef.current;
    if (!floater) return;

    floater.position.set(
      clamp(state.xf, -0.06, 0.06),
      viewZf,
      clamp(state.yf, -0.06, 0.06),
    );
    floater.rotation.y = state.phiF;

    const glow = floater.children[0] as THREE.Mesh;
    const core = floater.children[1] as THREE.Mesh;
    const gm = glow.material as THREE.MeshBasicMaterial;
    const cm = core.material as THREE.MeshStandardMaterial;
    if (status === 'LEVITATING') {
      gm.opacity = 0.45;
      gm.color.set(0x4fc3f7);
      cm.emissive.set(0x336688);
    } else if (status === 'CRASHED') {
      gm.opacity = 0.08;
      gm.color.set(0xff5252);
      cm.emissive.set(0x441111);
    } else {
      gm.opacity = 0.2;
      gm.color.set(0xff8a65);
      cm.emissive.set(0x553322);
    }

    if (shadow) {
      shadow.position.x = state.xf;
      shadow.position.z = state.yf;
      shadow.scale.setScalar(0.8 + (state.zf - 0.02) * 5);
    }
  }, [state, status, viewZf]);

  useEffect(() => {
    const canvas = potCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);
    const data = sampleFloaterPotential(params).map((p) => ({
      x: p.z * 100,
      y: p.u * 10000,
    }));
    drawLinePlot(ctx, w, h, data, {
      xLabel: 'z_f (cm)',
      yLabel: 'U_f(z_f)',
      color: coupled ? '#81c784' : '#ff8a65',
    });
  }, [params, coupled]);

  useEffect(() => {
    const canvas = sideViewRef.current;
    if (!canvas) return;
    const ctx = setupCanvas(canvas);
    if (!ctx) return;
    drawDynamicalSideView(ctx, canvas.clientWidth, canvas.clientHeight, {
      zf: state.zf,
      zTrap,
      rotorY: rHeight,
      deltaR: params.deltaR,
      deltaRCritical: dRc,
      coupled,
      rotorRpm: params.rotorRpm,
    });
  }, [state.zf, zTrap, rHeight, params.deltaR, params.rotorRpm, dRc, coupled]);

  const reset = () => {
    setRunning(true);
    setState(initDynamicalState(params));
    setStatus(coupled ? 'LEVITATING' : 'DRIFTING');
  };

  const preset = () => {
    const p = dynamicalPreset();
    setParams(p);
    setRunning(true);
    setState(initDynamicalState(p));
    setStatus('LEVITATING');
  };

  return (
    <div className="module">
      <ModuleHeader
        dimension="3D Driven Rotation"
        title="3D Dynamical Levitron"
        subtitle="A motor spins the rotor; a separate passive floater below frequency-locks and hovers — no spin tuning on the floater."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid">
        <div className="sim-panel">
          <div className={`info-box ${coupled ? '' : 'readouts unstable'}`}>
            <strong>{coupled ? 'Coupled — levitating' : 'Decoupled — falling'}</strong>
            {' — '}
            {coupled
              ? `Floater bobs into the trap at z₀ = ${(zTrap * 100).toFixed(1)} cm (green ring). δ_R is above δ_R^c.`
              : `No trap — floater drops to the base. Raise δ_R above ${(dRc * 100).toFixed(2)} cm, or use Preset.`}
          </div>

          <SimControls onReset={reset} onPreset={preset} />
          <div ref={containerRef} className="hero-canvas three-hero" aria-label="Rotor and floater 3D scene" />
          <p className="panel-caption">Side view — rotor cross spins above; floater hovers on the green trap ring.</p>

          <div className="slider-grid">
            <SliderControl label="Rotor RPM" value={params.rotorRpm} min={5000} max={20000} step={100} onChange={(v) => setParams((p) => ({ ...p, rotorRpm: v }))} />
            <SliderControl label="Floater height z₀" value={params.rotorFloaterGap * 100} min={1.5} max={7} step={0.1} unit="cm" onChange={(v) => setParams((p) => ({ ...p, rotorFloaterGap: v / 100 }))} />
            <SliderControl label="Floater mass" value={params.floaterMass * 1000} min={0.5} max={15} step={0.2} unit="g" onChange={(v) => setParams((p) => ({ ...p, floaterMass: v / 1000 }))} />
            <SliderControl label="Floater moment" value={params.floaterMoment * 1000} min={0.2} max={2.5} step={0.05} onChange={(v) => setParams((p) => ({ ...p, floaterMoment: v / 1000 }))} />
            <SliderControl label="δ_R (rotor offset)" value={params.deltaR * 100} min={0.2} max={2.5} step={0.05} unit="cm" onChange={(v) => setParams((p) => ({ ...p, deltaR: v / 100 }))} />
            <SliderControl label="Rotor axis tilt" value={(params.rotorAxisTilt * 180) / Math.PI} min={0} max={30} step={0.5} unit="°" onChange={(v) => setParams((p) => ({ ...p, rotorAxisTilt: (v * Math.PI) / 180 }))} />
            <SliderControl label="Rotational drag ξ^R" value={params.rotationalDrag} min={0.001} max={0.12} step={0.002} onChange={(v) => setParams((p) => ({ ...p, rotationalDrag: v }))} />
            <SliderControl label="Translational drag ξ^T" value={params.translationalDrag} min={0.02} max={0.8} step={0.01} onChange={(v) => setParams((p) => ({ ...p, translationalDrag: v }))} />
          </div>

          <div className="secondary-panels">
            <div>
              <canvas ref={sideViewRef} className="sim-canvas small" aria-label="Side view schematic" />
              <p className="panel-caption">Side view — what each object is</p>
            </div>
            <div>
              <canvas ref={potCanvasRef} className="sim-canvas small" aria-label="Floater potential energy" />
              <p className="panel-caption">Floater potential U_f(z_f) — green well = trap</p>
            </div>
          </div>

          <div className="readouts">
            <span className={coupled ? '' : 'unstable'}>
              δ_R = {(params.deltaR * 100).toFixed(2)} cm · δ_R^c = {(dRc * 100).toFixed(2)} cm · trap{' '}
              {coupled ? `strength ${(strength * 100).toFixed(0)}%` : 'off'}
            </span>
            <span>Spin lock R_f ≈ {Rf.toFixed(3)} (target ≈ 1 when coupled)</span>
            <span>Floater height z_f = {(state.zf * 100).toFixed(2)} cm</span>
            <span>Rotor–floater gap = {((rHeight - state.zf) * 100).toFixed(1)} cm</span>
          </div>
        </div>

        <PhysicsPanel
          experiment="Preset hovers clearly. Crash it: drop δ_R below δ_R^c, crank floater mass up, or raise rotor axis tilt until spin lock breaks."
          citations={<p><CiteLink id={3} /> <CiteLink id={5} /> <CiteLink id={4} /></p>}
        >
          <p><strong>Two separate bodies:</strong> the motor spins only the rotor; the floater is a passive magnet that responds to the time-varying field.</p>
          <ol className="prose-steps">
            <li>Rotor spins at ω_R (RPM slider).</li>
            <li>When δ_R ≥ δ_R^c, the field geometry creates a vertical trap for the floater.</li>
            <li>The floater&apos;s spin ω_f locks to the rotor: R_f = ω_f/ω_R ≈ sin θ_f.</li>
            <li>Unlike Module 3, you do <em>not</em> hand-spin the floater — trapping comes from rotor drive.</li>
          </ol>
          <KatexBlock display math="R_f = \omega_f / \omega_R \approx \sin\theta_f" />
          <KatexBlock display math="\delta_R \geq \delta_R^c \Rightarrow \text{vertical trap (Doff et al.)}" />
          <KatexBlock display math={neodymiumSpinWindowEstimate()} />
        </PhysicsPanel>
      </div>
    </div>
  );
}
