"use client";

import Image from "next/image";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Loader, useGLTF, useTexture } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DoubleSide, Mesh, MeshPhysicalMaterial, Object3D, Texture } from "three";

function HelmetModel({ tubeAngleRef }: { tubeAngleRef: React.MutableRefObject<number> }) {
  const helmet = useGLTF("/models/rubens.glb");

  const scene = useMemo(() => helmet.scene.clone(true), [helmet.scene]);
  const modelRef = useRef<Object3D>(null);
  const baseRotation = useMemo(() => ({ x: Math.PI / 8, y: Math.PI / 2 }), []);
  const glassMaterial = useMemo(
    () =>
      new MeshPhysicalMaterial({
        color: "#613309",
        metalness: 0.9,
        roughness: 0.3,
        envMapIntensity: 0.1,
        clearcoat: 0.3,
        clearcoatRoughness: 0.4,
      }),
    [],
  );

  useEffect(() => {
    const isMobile = window.innerWidth < 768;
    const scale = isMobile ? 0.042 : 0.05;

    scene.traverse((object) => {
      if (object instanceof Mesh) {
        object.scale.set(scale, scale, scale);
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
    obj.rotation.y = baseRotation.y - tubeAngleRef.current;
  });

  return (
    <group ref={modelRef} rotation={[baseRotation.x, baseRotation.y, 0]}>
      <primitive object={scene} position={[0.2, 0, -0.1]} />
    </group>
  );
}

function ImageTube({
  scrollTargetRef,
  spinVelocityRef,
  naturalDirRef,
  tubeAngleRef,
  onImageHover,
  onImageClick,
}: {
  scrollTargetRef: React.MutableRefObject<number>;
  spinVelocityRef: React.MutableRefObject<number>;
  naturalDirRef: React.MutableRefObject<number>;
  tubeAngleRef: React.MutableRefObject<number>;
  onImageHover: (projectName: string | null, texture: Texture | null, imageUrl: string | null) => void;
  onImageClick: (projectName: string, imageUrl: string, textureIndex: number) => void;
}) {
  const groupRef = useRef<Object3D>(null);
  const rowGroupRefs = useRef<Array<Object3D | null>>([]);
  const scrollCurrent = useRef(0);
  const angle = useRef(0);
  const isHovering = useRef(false);
  const speedMultiplier = useRef(1);

  const imageUrls = useMemo(
    () => [
      "/tube/img1.jpg",
      "/tube/img3.jpg",
      "/tube/img2.jpg",
      "/tube/img4.jpg",
      "/tube/img5.jpg",
      "/tube/img6.jpg",
      "/tube/img9.jpg",
    ],
    [],
  );

  const projectNames = useMemo(
    () => [
      "PROJECT ALPHA",
      "PROJECT BETA",
      "PROJECT GAMMA",
      "PROJECT DELTA",
      "PROJECT EPSILON",
      "PROJECT ZETA",
      "PROJECT ETA",
    ],
    [],
  );

  const textures = useTexture(imageUrls);

  const handleHover = useCallback((projectName: string | null, textureIndex: number | null) => {
    isHovering.current = projectName !== null;
    const texture = textureIndex !== null ? textures[textureIndex] : null;
    const imageUrl = textureIndex !== null ? imageUrls[textureIndex] : null;
    onImageHover(projectName, texture, imageUrl);
  }, [imageUrls, onImageHover, textures]);

  const cols = 6;
  const rows = 3;
  const radius = 4;
  const tileW = 0.72;
  const tileH = 1;
  const ySpacing = 2.7;
  const loopHeight = rows * ySpacing;
  const repeatCount = 3;
  const totalRows = rows * repeatCount;

  const rowSpeed = useMemo(() => {
    const speeds: number[] = [];
    for (let r = 0; r < rows; r++) {
      const t = rows <= 1 ? 0 : r / (rows - 1);
      speeds.push(0.65 + t * 0.9);
    }
    return speeds;
  }, [rows]);

  const rowPositions = useMemo(() => {
    const out: Array<{ rowIndex: number; y: number; baseRow: number; rowOffset: number }> = [];
    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const y = (rowIndex - (totalRows - 1) / 2) * ySpacing;
      const baseRow = rowIndex % rows;
      const rowOffset = baseRow % 2 === 0 ? 0 : 0.5;
      out.push({ rowIndex, y, baseRow, rowOffset });
    }
    return out;
  }, [rows, totalRows, ySpacing]);

  useFrame((_state, dt) => {
    scrollCurrent.current += (scrollTargetRef.current - scrollCurrent.current) * 0.12;

    if (scrollCurrent.current > loopHeight / 2) {
      scrollCurrent.current -= loopHeight;
      scrollTargetRef.current -= loopHeight;
    } else if (scrollCurrent.current < -loopHeight / 2) {
      scrollCurrent.current += loopHeight;
      scrollTargetRef.current += loopHeight;
    }

    const targetMultiplier = isHovering.current ? 0.05 : 1;
    speedMultiplier.current += (targetMultiplier - speedMultiplier.current) * 0.1;

    const damping = 0.92;
    spinVelocityRef.current *= Math.pow(damping, dt * 60);
    spinVelocityRef.current = Math.max(-2.0, Math.min(2.0, spinVelocityRef.current));

    const baseSpeed = naturalDirRef.current * 0.25 * speedMultiplier.current;
    angle.current += (baseSpeed + spinVelocityRef.current * speedMultiplier.current) * dt;
    tubeAngleRef.current = angle.current;

    const group = groupRef.current;
    if (!group) return;

    group.position.y = -scrollCurrent.current;

    for (let rowIndex = 0; rowIndex < totalRows; rowIndex++) {
      const rowObj = rowGroupRefs.current[rowIndex];
      if (!rowObj) continue;
      const baseRow = rowIndex % rows;
      rowObj.rotation.y = angle.current * rowSpeed[baseRow];
    }
  });

  return (
    <group ref={groupRef}>
      {rowPositions.map(({ rowIndex, y, baseRow, rowOffset }) => (
        <group
          key={rowIndex}
          position={[0, y, 0]}
          ref={(obj) => {
            rowGroupRefs.current[rowIndex] = obj;
          }}
        >
          {Array.from({ length: cols }).map((_, col) => {
            const theta = ((col + rowOffset) / cols) * Math.PI * 2;
            const x = Math.cos(theta) * radius;
            const z = Math.sin(theta) * radius;
            const ry = -(theta + Math.PI / 2);
            const texIndex = (baseRow * cols + col) % imageUrls.length;

            return (
              <mesh
                key={col}
                position={[x, 0, z]}
                rotation={[0, ry, 0]}
                onPointerEnter={() => handleHover(projectNames[texIndex], texIndex)}
                onPointerLeave={() => handleHover(null, null)}
                onClick={() => onImageClick(projectNames[texIndex], imageUrls[texIndex], texIndex)}
              >
                <planeGeometry args={[tileW, tileH]} />
                <meshBasicMaterial map={textures[texIndex]} toneMapped={false} side={DoubleSide} />
              </mesh>
            );
          })}
        </group>
      ))}
    </group>
  );
}

export function RubensScene() {
  const containerRef = useRef<HTMLDivElement>(null);
  const tubeScrollTarget = useRef(0);
  const tubeSpinVelocity = useRef(0);
  const tubeNaturalDir = useRef(1);
  const tubeAngle = useRef(0);
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);
  const [hoveredImageUrl, setHoveredImageUrl] = useState<string | null>(null);
  const [previousImageUrl, setPreviousImageUrl] = useState<string | null>(null);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [selectedProject, setSelectedProject] = useState<{
    name: string;
    imageUrl: string;
    index: number;
  } | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);

  const openOverlayTimeoutRef = useRef<number | null>(null);
  const closeOverlayTimeoutRef = useRef<number | null>(null);

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

  const onPointerEnter = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    cursorCurrent.current = { ...cursorTarget.current };
    cursorActive.current = true;
  }, []);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    setCursorPos({ x: event.clientX, y: event.clientY });

    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    cursorTarget.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const onPointerLeave = useCallback(() => {
    cursorActive.current = false;
  }, []);

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    tubeScrollTarget.current += event.deltaY * 0.002;
    tubeSpinVelocity.current += event.deltaY * 0.004;

    if (event.deltaY < 0) tubeNaturalDir.current = -1;
    else if (event.deltaY > 0) tubeNaturalDir.current = 1;
  }, []);

  const handleImageHover = useCallback(
    (projectName: string | null, _texture: Texture | null, imageUrl: string | null) => {
      setHoveredProject(projectName);
      if (imageUrl !== hoveredImageUrl) {
        setPreviousImageUrl(hoveredImageUrl);
        setHoveredImageUrl(imageUrl);
      }
    },
    [hoveredImageUrl],
  );

  const handleImageClick = useCallback(
    (projectName: string, imageUrl: string, textureIndex: number) => {
      setSelectedProject({ name: projectName, imageUrl, index: textureIndex });

      if (openOverlayTimeoutRef.current != null) window.clearTimeout(openOverlayTimeoutRef.current);
      openOverlayTimeoutRef.current = window.setTimeout(() => {
        setShowOverlay(true);
      }, 1500);
    },
    [],
  );

  const handleCloseProject = useCallback(() => {
    setShowOverlay(false);

    if (closeOverlayTimeoutRef.current != null) window.clearTimeout(closeOverlayTimeoutRef.current);
    closeOverlayTimeoutRef.current = window.setTimeout(() => {
      setSelectedProject(null);
    }, 1200);
  }, []);

  useEffect(() => {
    if (hoveredImageUrl && previousImageUrl) {
      const timer = setTimeout(() => {
        setPreviousImageUrl(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hoveredImageUrl, previousImageUrl]);

  useEffect(() => {
    return () => {
      if (openOverlayTimeoutRef.current != null) window.clearTimeout(openOverlayTimeoutRef.current);
      if (closeOverlayTimeoutRef.current != null) window.clearTimeout(closeOverlayTimeoutRef.current);
    };
  }, []);

  return (
    <div
      className="sceneRoot"
      ref={containerRef}
      onPointerEnter={onPointerEnter}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <h1 className="main-title">RUBENS EXPERIENCE</h1>

      {previousImageUrl && (
        <div
          className="background-image-blur background-image-previous"
          style={{ backgroundImage: `url(${previousImageUrl})` }}
        />
      )}
      {hoveredImageUrl && (
        <div
          className="background-image-blur background-image-current"
          style={{ backgroundImage: `url(${hoveredImageUrl})` }}
        />
      )}

      <Canvas
        camera={{ position: [0, 0, 6], fov: 50 }}
        gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
        dpr={[1, 2]}
        frameloop="always"
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, 0, 0);
          gl.setClearColor(0x000000, 0);
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />

          <Environment preset="studio" blur={10.5} />

          <ImageTube
            scrollTargetRef={tubeScrollTarget}
            spinVelocityRef={tubeSpinVelocity}
            naturalDirRef={tubeNaturalDir}
            tubeAngleRef={tubeAngle}
            onImageHover={handleImageHover}
            onImageClick={handleImageClick}
          />

          <HelmetModel tubeAngleRef={tubeAngle} />
        </Suspense>
      </Canvas>

      {selectedProject && (
        <div
          className={`project-single-view ${showOverlay ? "visible" : "hidden"}`}
          style={{ backgroundImage: `url(${selectedProject.imageUrl})` }}
        >
          <button className="close-button" onClick={handleCloseProject}>
            ✕
          </button>
          <div className="project-content">
            <Image
              src={selectedProject.imageUrl}
              alt={selectedProject.name}
              width={1200}
              height={800}
              sizes="(max-width: 768px) 90vw, 700px"
              style={{ width: "100%", height: "auto" }}
            />
            <h1>{selectedProject.name}</h1>
            <p>Description du projet {selectedProject.name}</p>
          </div>
        </div>
      )}

      <div className="project-info">
        <div className="info-left">
          <div className="brand">#RUBENS</div>
          <div className="tagline">#WEBGL</div>
          <div className="tech">BY MATD.EV</div>
        </div>
      </div>

      {hoveredProject && hoveredImageUrl && (
        <div
          className="project-label"
          style={{
            left: `${cursorPos.x + 20}px`,
            top: `${cursorPos.y + 20}px`,
          }}
        >
          <div className="project-thumbnail" style={{ backgroundImage: `url(${hoveredImageUrl})` }} />
          <div className="project-name">{hoveredProject}</div>
        </div>
      )}

      <div className="whiteEdgeGradient" aria-hidden="true" />
      <div className="customCursor" ref={cursorElRef} aria-hidden="true" />
      <Loader />
    </div>
  );
}

useGLTF.preload("/models/rubens.glb");