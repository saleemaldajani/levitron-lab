import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CiteLink, KatexBlock } from '../components/KatexBlock';
import { ModuleHeader, PhysicsPanel } from '../components/PhysicsPanel';
import { SimControls } from '../components/SimControls';
import { SliderControl } from '../components/SliderControl';
import { StabilityBadge } from '../components/StabilityBadge';
import { drawLinePlot, useSimLoop } from '../hooks/useSimLoop';
import {
  DEFAULT_DYNAMICAL,
  type DynamicalParams,
  type DynamicalState,
  classifyDynamical,
  deltaRCritical,
  dynamicalPreset,
  initDynamicalState,
  lockedSpinRatio,
  neodymiumSpinWindowEstimate,
  rotorOmega,
  sampleFloaterPotential,
  stepDynamical,
} from '../physics/dynamicalRotor';
import { PHYSICS_DT } from '../physics/integrators';
import type { StabilityStatus } from '../types';

export function Module4Dynamical() {
  const [params, setParams] = useState<DynamicalParams>({ ...DEFAULT_DYNAMICAL });
  const [state, setState] = useState<DynamicalState>(() => initDynamicalState(DEFAULT_DYNAMICAL));
  const [status, setStatus] = useState<StabilityStatus>('LEVITATING');
  const [running, setRunning] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const potCanvasRef = useRef<HTMLCanvasElement>(null);
  const floaterRef = useRef<THREE.Group | null>(null);
  const rotorRef = useRef<THREE.Group | null>(null);
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
  const Rf = lockedSpinRatio(state.thetaF);

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
      42,
      container.clientWidth / container.clientHeight,
      0.01,
      5,
    );
    camera.position.set(0.12, 0.08, 0.18);
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
    rotorGroup.position.y = 0.09;
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

    const floaterGroup = new THREE.Group();
    const floaterMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0xe0e8ff, emissive: 0x224466, emissiveIntensity: 0.4 }),
    );
    const floaterGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.2 }),
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
    const floater = floaterRef.current;
    const shadow = shadowRef.current;
    if (!floater) return;

    floater.position.set(state.xf, state.zf, state.yf);
    floater.rotation.y = state.phiF;

    const glow = floater.children[0] as THREE.Mesh;
    const gm = glow.material as THREE.MeshBasicMaterial;
    gm.opacity = status === 'LEVITATING' ? 0.35 : status === 'CRASHED' ? 0.05 : 0.15;

    if (shadow) {
      shadow.position.x = state.xf;
      shadow.position.z = state.yf;
      shadow.scale.setScalar(0.8 + (state.zf - 0.02) * 5);
    }
  }, [state, status]);

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
        subtitle="Motor-driven rotor above — floater frequency-locks and hovers below."
        status={<StabilityBadge status={status} />}
      />

      <div className="module-grid">
        <div className="sim-panel">
          <SimControls onReset={reset} onPreset={preset} />
          <div ref={containerRef} className="hero-canvas three-hero" aria-label="Rotor and floater 3D scene" />

          <div className="slider-grid">
            <SliderControl label="Rotor RPM" value={params.rotorRpm} min={7500} max={17000} step={100} onChange={(v) => setParams((p) => ({ ...p, rotorRpm: v }))} />
            <SliderControl label="Rotor–floater gap" value={params.rotorFloaterGap * 100} min={2} max={5} step={0.1} unit="cm" onChange={(v) => setParams((p) => ({ ...p, rotorFloaterGap: v / 100 }))} />
            <SliderControl label="Floater mass" value={params.floaterMass * 1000} min={1} max={8} step={0.2} unit="g" onChange={(v) => setParams((p) => ({ ...p, floaterMass: v / 1000 }))} />
            <SliderControl label="Floater moment" value={params.floaterMoment * 1000} min={0.3} max={1.5} step={0.05} onChange={(v) => setParams((p) => ({ ...p, floaterMoment: v / 1000 }))} />
            <SliderControl label="δ_R" value={params.deltaR * 100} min={0.4} max={2} step={0.05} unit="cm" onChange={(v) => setParams((p) => ({ ...p, deltaR: v / 100 }))} />
            <SliderControl label="Rotor axis tilt" value={(params.rotorAxisTilt * 180) / Math.PI} min={0} max={15} step={0.5} unit="°" onChange={(v) => setParams((p) => ({ ...p, rotorAxisTilt: (v * Math.PI) / 180 }))} />
            <SliderControl label="Rotational drag ξ^R" value={params.rotationalDrag} min={0.005} max={0.08} step={0.005} onChange={(v) => setParams((p) => ({ ...p, rotationalDrag: v }))} />
            <SliderControl label="Translational drag ξ^T" value={params.translationalDrag} min={0.05} max={0.4} step={0.01} onChange={(v) => setParams((p) => ({ ...p, translationalDrag: v }))} />
          </div>

          <div className="secondary-panels">
            <canvas ref={potCanvasRef} className="sim-canvas small" />
          </div>

          <div className="readouts">
            <span>δ_R^c = {(dRc * 100).toFixed(2)} cm — {coupled ? 'trap forms' : 'decoupled'}</span>
            <span>R_f ≈ {Rf.toFixed(3)}</span>
            <span>z_f = {(state.zf * 100).toFixed(2)} cm</span>
          </div>
        </div>

        <PhysicsPanel
          experiment="Sweep δ_R below δ_R^c — floater falls out of trap. Watch it spin up into frequency lock above threshold."
          citations={<p><CiteLink id={3} /> <CiteLink id={5} /> <CiteLink id={4} /></p>}
        >
          <p>Trapping set by rotor geometry δ_R, not floater spin tuning.</p>
          <KatexBlock display math="R_f = \omega_f / \omega_R \approx \sin\theta_f" />
          <KatexBlock display math="\delta_R \geq \delta_R^c \Rightarrow \text{trap (arXiv eqs. 7–11)}" />
          <KatexBlock display math={neodymiumSpinWindowEstimate()} />
        </PhysicsPanel>
      </div>
    </div>
  );
}
