import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { ArrowRight, ChevronDown, FastForward, Sparkles } from 'lucide-react';
import { useControlCentre } from '../context/ControlCentreContext.tsx';

function createBallastTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#0d1524';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4200; i++) {
    const x = (i * 73) % 256;
    const y = (i * 137) % 256;
    const v = 18 + (i % 26);
    ctx.fillStyle = `rgb(${v}, ${v + 8}, ${v + 20})`;
    ctx.fillRect(x, y, 2, 2);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 60);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const CinematicIntro: React.FC = () => {
  const { enterControlCentre, reducedMotion, setReducedMotion, startDemoMode } =
    useControlCentre();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<number>(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [webglFailed, setWebglFailed] = useState(false);

  // Track pinned scroll progress across the 280vh intro runway
  useEffect(() => {
    const onScroll = () => {
      const el = containerRef.current;
      if (!el) return;
      const maxScroll = Math.max(1, el.offsetHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / maxScroll));
      progressRef.current = p;
      setScrollProgress(p);
      if (p >= 0.985) {
        enterControlCentre();
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [enterControlCentre]);

  // Three.js 3D Railway Corridor -> Telemetry Grid Morph
  useEffect(() => {
    if (reducedMotion || webglFailed) return;
    const host = canvasHostRef.current;
    if (!host) return;

    // Detect software WebGL cleanly without crashing
    let isSoftwareGl = false;
    try {
      const probe = document.createElement('canvas');
      const gl = probe.getContext('webgl2') || probe.getContext('webgl');
      if (!gl) {
        setWebglFailed(true);
        return;
      }
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const rendererStr = ext
        ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))
        : '';
      isSoftwareGl = /SwiftShader|llvmpipe|Software|Mesa/i.test(rendererStr);
    } catch {
      setWebglFailed(true);
      return;
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: isSoftwareGl ? 'default' : 'high-performance',
        alpha: false,
      });
    } catch {
      setWebglFailed(true);
      return;
    }

    const width = host.clientWidth || window.innerWidth;
    const height = host.clientHeight || window.innerHeight;
    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    renderer.setSize(width, height, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#060B14');
    scene.fog = new THREE.FogExp2('#060B14', 0.0115);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.2, 420);
    camera.position.set(0, 5.2, 22);
    camera.lookAt(0, 2.2, -55);

    // Three-point architectural lighting (consistent across hardware & software GL)
    const hemi = new THREE.HemisphereLight('#7dd3fc', '#0b1324', 0.9);
    scene.add(hemi);
    const key = new THREE.DirectionalLight('#e0f2fe', 1.7);
    key.position.set(16, 28, 18);
    scene.add(key);
    const rim = new THREE.DirectionalLight('#38bdf8', 0.95);
    rim.position.set(-18, 12, -30);
    scene.add(rim);

    // Track corridor group
    const corridorGroup = new THREE.Group();
    scene.add(corridorGroup);

    const ballastTex = createBallastTexture();
    const groundGeo = new THREE.PlaneGeometry(68, 280);
    const groundMat = new THREE.MeshStandardMaterial({
      map: ballastTex,
      roughness: 0.92,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -105);
    corridorGroup.add(ground);

    // 4 parallel tracks (X positions)
    const trackXs = [-6.3, -2.1, 2.1, 6.3];
    const railGeo = new THREE.BoxGeometry(0.11, 0.16, 260);
    const railMat = new THREE.MeshStandardMaterial({
      color: '#cbd5e1',
      metalness: 0.88,
      roughness: 0.22,
      emissive: '#0c4a6e',
      emissiveIntensity: 0.22,
    });

    const railMeshes: THREE.Mesh[] = [];
    trackXs.forEach((tx) => {
      [-0.68, 0.68].forEach((offset) => {
        const rail = new THREE.Mesh(railGeo, railMat);
        rail.position.set(tx + offset, 0.14, -100);
        corridorGroup.add(rail);
        railMeshes.push(rail);
      });
    });

    // Instanced concrete sleepers (morph into geometric telemetry grid in Scene 3)
    const sleeperCountPerTrack = 110;
    const totalSleepers = trackXs.length * sleeperCountPerTrack;
    const sleeperGeo = new THREE.BoxGeometry(2.15, 0.1, 0.28);
    const sleeperMat = new THREE.MeshStandardMaterial({
      color: '#334155',
      roughness: 0.78,
      metalness: 0.15,
      emissive: '#0ea5e9',
      emissiveIntensity: 0.04,
    });
    const sleepers = new THREE.InstancedMesh(
      sleeperGeo,
      sleeperMat,
      totalSleepers
    );
    corridorGroup.add(sleepers);

    const sleeperBasePositions: Array<{ x: number; z: number; trackIdx: number }> =
      [];
    let sIdx = 0;
    const dummy = new THREE.Object3D();
    for (let t = 0; t < trackXs.length; t++) {
      for (let i = 0; i < sleeperCountPerTrack; i++) {
        const z = 18 - i * 2.1;
        sleeperBasePositions.push({ x: trackXs[t], z, trackIdx: t });
        dummy.position.set(trackXs[t], 0.05, z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        sleepers.setMatrixAt(sIdx++, dummy.matrix);
      }
    }
    sleepers.instanceMatrix.needsUpdate = true;

    // Instanced OHE Catenary Portals & Signal Aspects
    const gantryZs = [-12, -40, -68, -96, -124, -152, -180];
    const mastGeo = new THREE.BoxGeometry(0.24, 7.6, 0.24);
    const mastMat = new THREE.MeshStandardMaterial({
      color: '#475569',
      metalness: 0.65,
      roughness: 0.4,
    });
    const beamGeo = new THREE.BoxGeometry(19.6, 0.26, 0.24);
    const signalGreenMat = new THREE.MeshStandardMaterial({
      color: '#10b981',
      emissive: '#10b981',
      emissiveIntensity: 2.2,
      roughness: 0.2,
    });
    const signalAmberMat = new THREE.MeshStandardMaterial({
      color: '#f59e0b',
      emissive: '#f59e0b',
      emissiveIntensity: 2.0,
      roughness: 0.2,
    });
    const signalLensGeo = new THREE.SphereGeometry(0.18, 12, 12);

    const gantryGroup = new THREE.Group();
    gantryZs.forEach((gz, idx) => {
      const leftMast = new THREE.Mesh(mastGeo, mastMat);
      leftMast.position.set(-9.6, 3.8, gz);
      const rightMast = new THREE.Mesh(mastGeo, mastMat);
      rightMast.position.set(9.6, 3.8, gz);
      const beam = new THREE.Mesh(beamGeo, mastMat);
      beam.position.set(0, 7.2, gz);
      gantryGroup.add(leftMast, rightMast, beam);

      // Signal lenses mounted above each track
      trackXs.forEach((tx, tIdx) => {
        const lens = new THREE.Mesh(
          signalLensGeo,
          idx === 1 && tIdx === 1 ? signalAmberMat : signalGreenMat
        );
        lens.position.set(tx, 6.75, gz + 0.2);
        gantryGroup.add(lens);
      });
    });
    corridorGroup.add(gantryGroup);

    // Procedural Aerodynamic Vande Bharat Express Silhouette on Track 1 (X = -2.1)
    const trainGroup = new THREE.Group();
    const bodyGeo = new THREE.BoxGeometry(1.75, 2.1, 14.5);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: '#e2e8f0',
      metalness: 0.35,
      roughness: 0.28,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 1.35, 0);
    trainGroup.add(body);

    const stripeGeo = new THREE.BoxGeometry(1.79, 0.32, 14.2);
    const stripeMat = new THREE.MeshStandardMaterial({
      color: '#0284c7',
      emissive: '#0284c7',
      emissiveIntensity: 0.65,
      roughness: 0.3,
    });
    const stripe = new THREE.Mesh(stripeGeo, stripeMat);
    stripe.position.set(0, 1.08, 0);
    trainGroup.add(stripe);

    const noseGeo = new THREE.ConeGeometry(1.18, 3.6, 4);
    const nose = new THREE.Mesh(noseGeo, bodyMat);
    nose.rotation.x = Math.PI / 2;
    nose.rotation.y = Math.PI / 4;
    nose.scale.set(0.95, 1, 0.85);
    nose.position.set(0, 1.15, 8.65);
    trainGroup.add(nose);

    // Dark tinted cab windshield visor for unmistakable Vande Bharat nose profile
    const visorGeo = new THREE.BoxGeometry(1.42, 0.56, 1.35);
    const visorMat = new THREE.MeshStandardMaterial({
      color: '#070D19',
      metalness: 0.9,
      roughness: 0.12,
      emissive: '#0284c7',
      emissiveIntensity: 0.25,
    });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.62, 7.65);
    visor.rotation.x = 0.38;
    trainGroup.add(visor);

    const lampGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const lampMat = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      emissive: '#fef3c7',
      emissiveIntensity: 3.6,
    });
    [-0.46, 0.46].forEach((lx) => {
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(lx, 0.88, 9.75);
      trainGroup.add(lamp);
    });

    trainGroup.position.set(-2.1, 0.1, -38);
    corridorGroup.add(trainGroup);

    // Scene 3 Command Grid Plane (emerges during railway -> grid morph)
    const gridHelper = new THREE.GridHelper(110, 44, '#38bdf8', '#172844');
    gridHelper.position.set(0, 0.22, -60);
    const gridMats = Array.isArray(gridHelper.material)
      ? gridHelper.material
      : [gridHelper.material];
    gridMats.forEach((m) => {
      m.transparent = true;
      m.opacity = 0.0;
    });
    scene.add(gridHelper);

    // On-demand render scheduler
    let rafId = 0;
    let dirty = true;
    let ambientTime = 0;

    const renderScene = () => {
      const p = progressRef.current;

      // Scene 1 -> 2 -> 3 camera choreography
      // 0..0.62: glide down the corridor; 0.62..1.0: rise into command-grid overview
      const zoomPhase = Math.min(1, p / 0.62);
      const morphPhase = Math.max(0, (p - 0.58) / 0.42);
      const smoothMorph = morphPhase * morphPhase * (3 - 2 * morphPhase);

      const camZ = 22 - zoomPhase * 68 - smoothMorph * 12;
      const camY = 5.2 - zoomPhase * 1.4 + smoothMorph * 18.5;
      const camX = Math.sin(zoomPhase * Math.PI * 0.65) * 2.2 * (1 - smoothMorph);
      camera.position.set(camX, camY, camZ);
      camera.lookAt(0, 2.0 - smoothMorph * 1.8, camZ - 64);

      // Train cruises smoothly along Track 1 and fades into telemetry plane
      trainGroup.position.z = -38 + zoomPhase * 42 + Math.sin(ambientTime * 0.6) * 1.2;
      trainGroup.scale.setScalar(Math.max(0.01, 1 - smoothMorph * 0.85));

      // Morph sleepers: widen & glow into command grid cells during Scene 3
      sleeperMat.emissiveIntensity = 0.04 + smoothMorph * 0.55;
      for (let i = 0; i < totalSleepers; i++) {
        const base = sleeperBasePositions[i];
        const spreadX = base.x * (1 + smoothMorph * 1.35);
        dummy.position.set(spreadX, 0.05 + smoothMorph * 0.14, base.z);
        dummy.scale.set(1 + smoothMorph * 1.6, 1 - smoothMorph * 0.5, 1);
        dummy.updateMatrix();
        sleepers.setMatrixAt(i, dummy.matrix);
      }
      sleepers.instanceMatrix.needsUpdate = true;

      // Gantries retract upward as command grid materializes
      gantryGroup.position.y = smoothMorph * 16;
      gridMats.forEach((m) => {
        m.opacity = smoothMorph * 0.78;
      });
      railMat.emissiveIntensity = 0.22 + smoothMorph * 0.9;

      renderer.render(scene, camera);
    };

    const requestRender = () => {
      dirty = true;
      if (!rafId) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      rafId = 0;
      if (dirty) {
        dirty = false;
        renderScene();
      }
      // Subtle ambient shimmer on hardware GPUs only; software GL stays strictly event-driven
      if (!isSoftwareGl) {
        ambientTime += 0.016;
        dirty = true;
        rafId = window.requestAnimationFrame(tick);
      }
    };

    const onScrollRender = () => requestRender();
    const onResize = () => {
      const w = host.clientWidth || window.innerWidth;
      const h = host.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      requestRender();
    };

    window.addEventListener('scroll', onScrollRender, { passive: true });
    window.addEventListener('resize', onResize);
    requestRender();

    return () => {
      window.removeEventListener('scroll', onScrollRender);
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);

      // Full GPU disposal so the Control Centre starts with 0 lingering WebGL memory
      ballastTex.dispose();
      groundGeo.dispose();
      groundMat.dispose();
      railGeo.dispose();
      railMat.dispose();
      sleeperGeo.dispose();
      sleeperMat.dispose();
      mastGeo.dispose();
      mastMat.dispose();
      beamGeo.dispose();
      signalGreenMat.dispose();
      signalAmberMat.dispose();
      signalLensGeo.dispose();
      bodyGeo.dispose();
      bodyMat.dispose();
      stripeGeo.dispose();
      stripeMat.dispose();
      noseGeo.dispose();
      visorGeo.dispose();
      visorMat.dispose();
      lampGeo.dispose();
      lampMat.dispose();
      gridHelper.geometry.dispose();
      gridMats.forEach((m) => m.dispose());
      envRT.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, [reducedMotion, webglFailed]);

  // Determine current narrative scene (1..4) from scroll progress
  const activeStage =
    scrollProgress < 0.28
      ? 1
      : scrollProgress < 0.62
        ? 2
        : scrollProgress < 0.88
          ? 3
          : 4;

  const stageCopy = [
    {
      index: '01 / CORRIDOR',
      title: 'RailRaksha Control Centre',
      subtitle:
        'AI-powered railway traffic control, predictive headway conflict detection, and explainable decision support for SIH-25022.',
    },
    {
      index: '02 / TELEMETRY',
      title: 'Four-Track Kinematic Awareness',
      subtitle:
        'Tracks 30 fixed blocks, station-throat compression (1.35×), weather braking penalties, and closing velocity across 8 trunk rakes.',
    },
    {
      index: '03 / INTELLIGENCE',
      title: 'Physical Track to Command Grid',
      subtitle:
        'Sleepers and routes resolve into SHAP & LIME explainability, counterfactual comparisons, and human-in-the-loop dispatch approval.',
    },
    {
      index: '04 / HANDOFF',
      title: 'Entering Operations Workspace',
      subtitle:
        'Academic decision-support prototype — human controller approval required for every plan.',
    },
  ][activeStage - 1];

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-[#060B14] text-slate-100"
      style={{ height: reducedMotion ? '100vh' : '280vh' }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden">
        {/* 3D WebGL Canvas or Crisp Architectural Fallback */}
        {!reducedMotion && !webglFailed ? (
          <div ref={canvasHostRef} className="absolute inset-0" />
        ) : (
          <div className="absolute inset-0 rail-grid-bg bg-gradient-to-b from-[#071121] via-[#060B14] to-[#04070E]">
            <svg
              className="h-full w-full opacity-55"
              viewBox="0 0 1440 900"
              preserveAspectRatio="xMidYMid slice"
              aria-hidden="true"
            >
              <line x1="720" y1="360" x2="180" y2="900" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.45" />
              <line x1="720" y1="360" x2="520" y2="900" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.65" />
              <line x1="720" y1="360" x2="920" y2="900" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.65" />
              <line x1="720" y1="360" x2="1260" y2="900" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.45" />
              {[440, 500, 580, 680, 800].map((y) => (
                <line
                  key={y}
                  x1="120"
                  y1={y}
                  x2="1320"
                  y2={y}
                  stroke="#1C2C47"
                  strokeWidth="1.5"
                />
              ))}
            </svg>
          </div>
        )}

        {/* Top Bar — Skip Intro & Reduced Motion (no backdrop-blur over WebGL) */}
        <header className="relative z-20 flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-sky-500/40 bg-[#0C1424] font-display text-sm font-bold text-sky-400">
              RR
            </div>
            <div>
              <span className="font-display text-base font-bold tracking-tight text-white">
                RailRaksha
              </span>
              <span className="ml-3 hidden font-mono text-xs text-slate-400 sm:inline">
                SIH-25022 · Academic Prototype
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setReducedMotion(!reducedMotion)}
              className="cursor-pointer rounded border border-[#1C2C47] bg-[#0C1424] px-3 py-1.5 font-mono text-xs text-slate-300 transition-colors hover:border-sky-500/60 hover:text-white"
            >
              {reducedMotion ? 'Enable 3D Motion' : 'Reduced Motion'}
            </button>
            <button
              type="button"
              onClick={enterControlCentre}
              className="flex cursor-pointer items-center gap-1.5 rounded border border-sky-500/50 bg-[#0C1424] px-3.5 py-1.5 text-xs font-semibold text-sky-300 transition-colors hover:bg-sky-500/15 hover:text-white"
            >
              <FastForward className="h-3.5 w-3.5" />
              Skip Intro
            </button>
          </div>
        </header>

        {/* Bottom-left Editorial Typography Overlay — leaves 3D corridor focal clear */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#060B14] via-[#060B14]/88 to-transparent px-6 pt-24 pb-8 md:px-10 md:pb-12">
          <div className="mx-auto flex max-w-7xl flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div className="pointer-events-auto max-w-2xl">
              <div className="mb-2 flex items-center gap-3 font-mono text-xs tracking-wider text-sky-400 uppercase">
                <span>{stageCopy.index}</span>
                <span className="text-slate-600">·</span>
                <span className="text-slate-400">
                  The NorthCap University · Ministry of Railways
                </span>
              </div>
              <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl md:text-6xl">
                {stageCopy.title}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300 sm:text-base">
                {stageCopy.subtitle}
              </p>

              <div className="mt-6 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={enterControlCentre}
                  className="inline-flex cursor-pointer items-center gap-2 rounded bg-sky-500 px-5 py-2.5 text-sm font-semibold text-[#040911] transition-colors hover:bg-sky-400"
                >
                  Enter Control Centre
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={startDemoMode}
                  className="inline-flex cursor-pointer items-center gap-2 rounded border border-[#24395C] bg-[#0C1424] px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:border-sky-500/60 hover:text-white"
                >
                  <Sparkles className="h-4 w-4 text-sky-400" />
                  Start 8-Step Viva Demo
                </button>
              </div>
            </div>

            {/* Scroll progress telemetry indicator */}
            {!reducedMotion && (
              <div className="pointer-events-auto flex flex-col items-start gap-2 md:items-end">
                <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
                  <ChevronDown className="h-3.5 w-3.5 text-sky-400" />
                  <span>Scroll to traverse corridor</span>
                  <span className="tabular-nums text-sky-300">
                    {Math.round(scrollProgress * 100)}%
                  </span>
                </div>
                <div className="h-1 w-48 overflow-hidden rounded-sm bg-[#142038]">
                  <div
                    className="h-full bg-sky-400 transition-all duration-100"
                    style={{ width: `${Math.max(4, Math.round(scrollProgress * 100))}%` }}
                  />
                </div>
                <div className="font-mono text-[11px] text-slate-500">
                  Academic Decision-Support Prototype · Not SIL-4 Signalling
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
