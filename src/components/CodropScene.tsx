"use client";

import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { Environment, Loader, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DoubleSide,
  Mesh,
  MeshPhysicalMaterial,
  Object3D,
  ShaderMaterial,
  Vector2,
} from "three";

function AlwaysInvalidate() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    let raf = 0;

    const tick = () => {
      invalidate();
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [invalidate]);

  return null;
}

function GridPlaneLight({
  targetCenterUv,
}: {
  targetCenterUv: React.MutableRefObject<Vector2>;
}) {
  const meshRef = useRef<Mesh>(null);
  const uniforms = useMemo(
    () => ({
      uGridScale: { value: 28.0 },
      uLineWidth: { value: 0.5 },
      uEdgeWidth: { value: 0.14 },
      uEdgeAmp: { value: 1.35 },
      uCenterRadius: { value: 0.22 },
      uCenterAmp: { value: 0.9 },
      uCenter: { value: new Vector2(0.5, 0.5) },
      uTime: { value: 0.0 },
      uScrollSpeed: { value: 0.01 },
      uResolution: { value: new Vector2(1, 1) },
    }),
    [],
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const material = mesh.material as ShaderMaterial;

    material.uniforms.uTime.value = state.clock.getElapsedTime();
    (material.uniforms.uCenter.value as Vector2).lerp(targetCenterUv.current, 0.08);
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -5.2]}>
      <planeGeometry args={[18, 18, 512, 512]} />
      <shaderMaterial
        attach="material"
        args={[
          {
            uniforms,
              vertexShader: `
              varying vec2 vUv;
              
              uniform float uEdgeWidth;
              uniform float uEdgeAmp;
              uniform float uCenterRadius;
              uniform float uCenterAmp;
              uniform vec2 uCenter;

              void main() {
                vUv = uv;

                vec3 p = position;

                float dEdge = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
                float edgeMask = 1.0 - smoothstep(0.0, uEdgeWidth, dEdge);

                float dCenter = distance(vUv, uCenter);
                float centerMask = 1.0 - smoothstep(0.0, uCenterRadius, dCenter);

                float zOffset = edgeMask * uEdgeAmp + centerMask * uCenterAmp;
                p.z += zOffset;

                gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
              }
            `,
              fragmentShader: `
              varying vec2 vUv;
              
              uniform float uGridScale;
              uniform float uLineWidth;
              uniform float uTime;
              uniform float uScrollSpeed;
              uniform vec2 uResolution;

              float gridLine(float coord, float width) {
                float fw = fwidth(coord);
                float p = abs(fract(coord - 0.5) - 0.5);
                return 1.0 - smoothstep(width * fw, (width + 1.0) * fw, p);
              }

              void main() {
                vec2 uv = (vUv + vec2(uTime * uScrollSpeed, 0.0)) * uGridScale;
                float gx = gridLine(uv.x, uLineWidth);
                float gy = gridLine(uv.y, uLineWidth);
                float g = max(gx, gy);

                vec3 base = vec3(1.0);
                vec3 line = vec3(0.0);
                vec3 col = mix(base, line, g * 0.18);
                gl_FragColor = vec4(col, 1.0);
              }
            `,
            side: DoubleSide,
          },
        ]}
      />
    </mesh>
  );
}

function HelmetModel({ sphereAngleRef }: { sphereAngleRef: React.MutableRefObject<number> }) {
  const helmet = useGLTF("/models/helmet.glb");

  const scene = useMemo(() => helmet.scene.clone(true), [helmet.scene]);
  const modelRef = useRef<Object3D>(null);
  const baseRotation = useMemo(() => ({ x: Math.PI / 8, y: Math.PI / 2 }), []);
  const glassMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        thickness: 0.9,
        roughness: 0.0,
        metalness: 1,
        ior: 1.9,
        clearcoat: 0.1,
        clearcoatRoughness: 1.1,
        iridescence: 0,
        iridescenceIOR: 0,
        iridescenceThicknessRange: [100, 400],
        color: "transparent",
        transparent: true,
        depthWrite: true,
        side: DoubleSide,   
      }),
    [],
  );

  useEffect(() => {
    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.scale.set(0.7, 0.7, 0.7);
        object.material = glassMaterial;
        object.material.needsUpdate = true;
      }
    });

    return () => {
      glassMaterial.dispose();
    };
  }, [scene, glassMaterial]);

  useFrame(() => {
    const obj = modelRef.current;
    if (!obj) return;
    obj.rotation.x = baseRotation.x;
    obj.rotation.y = baseRotation.y - sphereAngleRef.current;
  });

  return <primitive ref={modelRef} object={scene} rotation={[baseRotation.x, baseRotation.y, 0]} />;
}

function ImageSphere({
  spinVelocityXRef,
  spinVelocityYRef,
  angleXRef,
  angleYRef,
  isDraggingRef,
  snapActiveRef,
  snapTargetXRef,
  snapTargetYRef,
  onTileDirs,
  onHoverStart,
  onHoverMove,
  onHoverEnd,
}: {
  spinVelocityXRef: React.MutableRefObject<number>;
  spinVelocityYRef: React.MutableRefObject<number>;
  angleXRef: React.MutableRefObject<number>;
  angleYRef: React.MutableRefObject<number>;
  isDraggingRef: React.MutableRefObject<boolean>;
  snapActiveRef: React.MutableRefObject<boolean>;
  snapTargetXRef: React.MutableRefObject<number>;
  snapTargetYRef: React.MutableRefObject<number>;
  onTileDirs: (dirs: Array<{ x: number; y: number; z: number }>) => void;
  onHoverStart: (projectName: string, event: ThreeEvent<PointerEvent>) => void;
  onHoverMove: (event: ThreeEvent<PointerEvent>) => void;
  onHoverEnd: () => void;
}) {
  const groupRef = useRef<Object3D>(null);

  const imageUrls = useMemo(
    () => [
      "/tube/im1.jpg",
      "/tube/im3.jpg",
      "/tube/im2.jpg",
      "/tube/im4.jpg",
      "/tube/im5.jpg",
      "/tube/im6.jpg",
      "/tube/im7.jpg",
      "/tube/im8.jpg",
      "/tube/im9.jpg",
    ],
    [],
  );

  const textures = useTexture(imageUrls);

  const projectNames = useMemo(() => {
    const fileToName: Record<string, string> = {
      "/tube/im1.jpg": "Project 1",
      "/tube/im2.jpg": "Project 2",
      "/tube/im3.jpg": "Project 3",
      "/tube/im4.jpg": "Project 4",
      "/tube/im5.jpg": "Project 5",
      "/tube/im6.jpg": "Project 6",
      "/tube/im7.jpg": "Project 7",
      "/tube/im8.jpg": "Project 8",
      "/tube/im9.jpg": "Project 9",
    };
    return imageUrls.map((url) => fileToName[url] ?? url);
  }, [imageUrls]);

  const radius = 4.25;
  const tileW = 0.72;
  const tileH = 1.0;
  const tileCount = imageUrls.length * 8;

  const tiles = useMemo(() => {
    const out: Array<{ x: number; y: number; z: number; texIndex: number }> = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5));
    const n = Math.max(1, tileCount);

    for (let i = 0; i < n; i++) {
      const t = n <= 1 ? 0.5 : i / (n - 1);
      const y = 1 - t * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;
      const x = Math.cos(theta) * r;
      const z = Math.sin(theta) * r;
      out.push({ x: x * radius, y: y * radius * 0.92, z: z * radius, texIndex: i % imageUrls.length });
    }

    return out;
  }, [imageUrls.length, radius, tileCount]);

  useEffect(() => {
    onTileDirs(
      tiles.map(({ x, y, z }) => {
        const len = Math.hypot(x, y, z) || 1;
        return { x: x / len, y: y / len, z: z / len };
      }),
    );
  }, [onTileDirs, tiles]);

  const wrapPi = useCallback((a: number) => {
    const twoPi = Math.PI * 2;
    let v = (a + Math.PI) % twoPi;
    if (v < 0) v += twoPi;
    return v - Math.PI;
  }, []);

  const stepAngle = useCallback(
    (current: number, target: number, alpha: number, wrap: boolean) => {
      const diff = wrap ? wrapPi(target - current) : target - current;
      return current + diff * alpha;
    },
    [wrapPi],
  );

  useFrame((_state, dt) => {
    const damping = 0.92;
    spinVelocityXRef.current *= Math.pow(damping, dt * 60);
    spinVelocityYRef.current *= Math.pow(damping, dt * 60);

    spinVelocityXRef.current = Math.max(-3.0, Math.min(3.0, spinVelocityXRef.current));
    spinVelocityYRef.current = Math.max(-3.0, Math.min(3.0, spinVelocityYRef.current));

    angleXRef.current += spinVelocityXRef.current * dt;
    angleYRef.current += spinVelocityYRef.current * dt;

    const maxPitch = 0.9;
    if (angleXRef.current > maxPitch) angleXRef.current = maxPitch;
    if (angleXRef.current < -maxPitch) angleXRef.current = -maxPitch;

    if (snapActiveRef.current && !isDraggingRef.current) {
      spinVelocityXRef.current *= 0.92;
      spinVelocityYRef.current *= 0.92;

      const alpha = 1 - Math.pow(0.92, dt * 60);
      angleXRef.current = stepAngle(angleXRef.current, snapTargetXRef.current, alpha, false);
      angleYRef.current = stepAngle(angleYRef.current, snapTargetYRef.current, alpha, true);

      const yawErr = Math.abs(wrapPi(snapTargetYRef.current - angleYRef.current));
      const pitchErr = Math.abs(snapTargetXRef.current - angleXRef.current);
      if (yawErr < 0.0025 && pitchErr < 0.0025) {
        angleXRef.current = snapTargetXRef.current;
        angleYRef.current += wrapPi(snapTargetYRef.current - angleYRef.current);
        spinVelocityXRef.current = 0;
        spinVelocityYRef.current = 0;
        snapActiveRef.current = false;
      }
    }

    const group = groupRef.current;
    if (group) {
      group.rotation.x = angleXRef.current;
      group.rotation.y = angleYRef.current;
    }
  });

  return (
    <group ref={groupRef}>
      {tiles.map(({ x, y, z, texIndex }, index) => {
        const projectName = projectNames[texIndex] ?? "";

        return (
          <mesh
            key={index}
            position={[x, y, z]}
            ref={(obj) => {
              if (!obj) return;
              obj.lookAt(0, 0, 0);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              onHoverStart(projectName, e);
            }}
            onPointerMove={(e) => {
              e.stopPropagation();
              onHoverMove(e);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              onHoverEnd();
            }}
          >
            <planeGeometry args={[tileW, tileH]} />
            <meshBasicMaterial map={textures[texIndex]} toneMapped={false} side={DoubleSide} />
          </mesh>
        );
      })}
    </group>
  );
}

export function CodropScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetCenterUv = useRef(new Vector2(0.5, 0.5));

  const sphereSpinVelocityX = useRef(0);
  const sphereSpinVelocityY = useRef(0);
  const sphereAngleX = useRef(0);
  const sphereAngleY = useRef(0);

  const isDraggingRef = useRef(false);
  const dragPointerIdRef = useRef<number | null>(null);
  const dragLastXRef = useRef(0);
  const dragLastYRef = useRef(0);
  const dragLastTRef = useRef(0);

  const tileDirsRef = useRef<Array<{ x: number; y: number; z: number }>>([]);
  const snapActiveRef = useRef(false);
  const snapTargetXRef = useRef(0);
  const snapTargetYRef = useRef(0);
  const snapWheelTimeoutRef = useRef<number | null>(null);

  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const tooltipElRef = useRef<HTMLDivElement | null>(null);
  const tooltipTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipCurrent = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const tooltipRaf = useRef<number | null>(null);

  const cursorElRef = useRef<HTMLDivElement | null>(null);
  const cursorTarget = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cursorCurrent = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const cursorActive = useRef(false);
  const cursorRaf = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const el = cursorElRef.current;
      if (el) {
        const lerp = 0.14;
        cursorCurrent.current.x += (cursorTarget.current.x - cursorCurrent.current.x) * lerp;
        cursorCurrent.current.y += (cursorTarget.current.y - cursorCurrent.current.y) * lerp;

        const x = cursorCurrent.current.x + 8;
        const y = cursorCurrent.current.y + 8;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) translate(-50%, -50%)`;
        el.style.opacity = cursorActive.current ? "1" : "0";
      }

      cursorRaf.current = requestAnimationFrame(tick);
    };

    cursorRaf.current = requestAnimationFrame(tick);
    return () => {
      if (cursorRaf.current != null) cancelAnimationFrame(cursorRaf.current);
    };
  }, []);

  const setTooltipFromClientPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    tooltipTarget.current = { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  useEffect(() => {
    const tick = () => {
      const el = tooltipElRef.current;
      if (el) {
        const lerp = 0.18;
        tooltipCurrent.current.x += (tooltipTarget.current.x - tooltipCurrent.current.x) * lerp;
        tooltipCurrent.current.y += (tooltipTarget.current.y - tooltipCurrent.current.y) * lerp;

        const x = tooltipCurrent.current.x + 12;
        const y = tooltipCurrent.current.y - 18;
        el.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
      }

      tooltipRaf.current = requestAnimationFrame(tick);
    };

    tooltipRaf.current = requestAnimationFrame(tick);
    return () => {
      if (tooltipRaf.current != null) cancelAnimationFrame(tooltipRaf.current);
    };
  }, []);

  const onImageHoverStart = useCallback(
    (projectName: string, event: ThreeEvent<PointerEvent>) => {
      if (isDraggingRef.current) return;
      setHoveredProject(projectName);
      setTooltipFromClientPoint(event.nativeEvent.clientX, event.nativeEvent.clientY);
      tooltipCurrent.current = { ...tooltipTarget.current };
    },
    [setTooltipFromClientPoint],
  );

  const onImageHoverMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      if (isDraggingRef.current) return;
      setTooltipFromClientPoint(event.nativeEvent.clientX, event.nativeEvent.clientY);
    },
    [setTooltipFromClientPoint],
  );

  const onImageHoverEnd = useCallback(() => {
    setHoveredProject(null);
  }, []);

  const onPointerEnter = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    cursorCurrent.current = { ...cursorTarget.current };
    cursorActive.current = true;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    if (isDraggingRef.current && dragPointerIdRef.current === event.pointerId) {
      const dx = event.clientX - dragLastXRef.current;
      const dy = event.clientY - dragLastYRef.current;
      const dtMs = event.timeStamp - dragLastTRef.current;

      dragLastXRef.current = event.clientX;
      dragLastYRef.current = event.clientY;
      dragLastTRef.current = event.timeStamp;

      const dragToAngle = 0.003;
      const deltaYaw = dx * dragToAngle;
      const deltaPitch = -dy * dragToAngle;

      sphereAngleY.current += deltaYaw;
      sphereAngleX.current += deltaPitch;

      const maxPitch = 0.9;
      if (sphereAngleX.current > maxPitch) sphereAngleX.current = maxPitch;
      if (sphereAngleX.current < -maxPitch) sphereAngleX.current = -maxPitch;

      if (dtMs > 0) {
        const dt = dtMs / 1000;
        sphereSpinVelocityX.current = Math.max(-4.0, Math.min(4.0, deltaPitch / dt));
        sphereSpinVelocityY.current = Math.max(-4.0, Math.min(4.0, deltaYaw / dt));
      }
    }

    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };

    const nx = (event.clientX - rect.left) / rect.width;
    const ny = (event.clientY - rect.top) / rect.height;
    const clampedX = Math.min(1, Math.max(0, nx));
    const clampedY = Math.min(1, Math.max(0, ny));

    const uvX = clampedX;
    const uvY = 1 - clampedY;

    const strength = 0.4;
    const cx = 0.5 + (uvX - 0.5) * strength;
    const cy = 0.5 + (uvY - 0.5) * strength;

    targetCenterUv.current.set(Math.min(1, Math.max(0, cx)), Math.min(1, Math.max(0, cy)));
  }, []);

  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    snapActiveRef.current = false;
    isDraggingRef.current = true;
    dragPointerIdRef.current = event.pointerId;
    dragLastXRef.current = event.clientX;
    dragLastYRef.current = event.clientY;
    dragLastTRef.current = event.timeStamp;

    setHoveredProject(null);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
    }
  }, []);

  const requestSnap = useCallback(() => {
    const dirs = tileDirsRef.current;
    if (!dirs.length) return;

    const currentPitch = sphereAngleX.current;
    const currentYaw = sphereAngleY.current;

    const maxPitch = 0.9;

    const wrapPi = (a: number) => {
      const twoPi = Math.PI * 2;
      let v = (a + Math.PI) % twoPi;
      if (v < 0) v += twoPi;
      return v - Math.PI;
    };

    let bestCost = Number.POSITIVE_INFINITY;
    let bestPitch = currentPitch;
    let bestYaw = currentYaw;

    for (let i = 0; i < dirs.length; i++) {
      const v = dirs[i];
      const z1 = Math.hypot(v.x, v.z);
      const desiredYaw = Math.atan2(-v.x, v.z);
      const desiredPitch = Math.atan2(v.y, z1);

      if (desiredPitch > maxPitch || desiredPitch < -maxPitch) continue;

      const dy = wrapPi(desiredYaw - currentYaw);
      const dx = desiredPitch - currentPitch;
      const cost = dy * dy + dx * dx * 1.4;

      if (cost < bestCost) {
        bestCost = cost;
        bestPitch = desiredPitch;
        bestYaw = currentYaw + dy;
      }
    }

    snapTargetXRef.current = bestPitch;
    snapTargetYRef.current = bestYaw;
    snapActiveRef.current = true;
  }, []);

  const endDrag = useCallback((event?: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    const pid = dragPointerIdRef.current;
    dragPointerIdRef.current = null;

    if (event && pid != null) {
      try {
        event.currentTarget.releasePointerCapture(pid);
      } catch {
      }
    }

    requestSnap();
  }, [requestSnap]);

  const onPointerLeave = useCallback(() => {
    targetCenterUv.current.set(0.5, 0.5);
    cursorActive.current = false;
    onImageHoverEnd();
    endDrag();
  }, [endDrag, onImageHoverEnd]);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    sphereSpinVelocityY.current += event.deltaY * 0.004;

    if (snapWheelTimeoutRef.current != null) {
      window.clearTimeout(snapWheelTimeoutRef.current);
    }
    snapWheelTimeoutRef.current = window.setTimeout(() => {
      if (!isDraggingRef.current) requestSnap();
    }, 140);
  }, [requestSnap]);

  return (
    <div
      className="sceneRoot sceneRoot--light"
      ref={containerRef}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerDown={onPointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <Canvas
        frameloop="always"
        camera={{ position: [0, 0, 6.5], fov: 50 }}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0);
        }}
      >
        <Suspense fallback={null}>
          <AlwaysInvalidate />
          <ambientLight intensity={0.65} />
          <directionalLight position={[5, 5, 5]} intensity={1} />

          <Environment preset="studio" blur={10.5} />

          <GridPlaneLight targetCenterUv={targetCenterUv} />

          <ImageSphere
            spinVelocityXRef={sphereSpinVelocityX}
            spinVelocityYRef={sphereSpinVelocityY}
            angleXRef={sphereAngleX}
            angleYRef={sphereAngleY}
            isDraggingRef={isDraggingRef}
            snapActiveRef={snapActiveRef}
            snapTargetXRef={snapTargetXRef}
            snapTargetYRef={snapTargetYRef}
            onTileDirs={(dirs) => {
              tileDirsRef.current = dirs;
            }}
            onHoverStart={onImageHoverStart}
            onHoverMove={onImageHoverMove}
            onHoverEnd={onImageHoverEnd}
          />

          <HelmetModel sphereAngleRef={sphereAngleY} />
        </Suspense>
      </Canvas>

      <div className="whiteEdgeGradient" aria-hidden="true" />

      {hoveredProject && (
        <div className="projectTooltip" ref={tooltipElRef} role="status" aria-live="polite">
          {hoveredProject}
        </div>
      )}

      <div className="customCursor" ref={cursorElRef} aria-hidden="true" />

      <Loader />
    </div>
  );
}

useGLTF.preload("/models/helmet.glb");
