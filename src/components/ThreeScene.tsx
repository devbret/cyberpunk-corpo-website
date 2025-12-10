import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { renderer } from "../three/renderer";
import { scene } from "../three/scene";
import { camera } from "../three/camera";
import { addPortalRings } from "../three/rings";
import {
  createCube,
  breakCubeIntoSmallerCubes,
  Department,
} from "../three/cube";
import { createBinaryStarField } from "../three/binaryStarField";
import { addLights } from "../three/lights";
import { setupKeyEvents, setupMouseEvents } from "../three/events";
import { animate } from "../three/animate";
import { createEmberField } from "../three/embers";
import { setupGlitchComposer } from "../three/glitch";
import { createGodhead } from "../three/godhead";
import Hud from "../components/Hud";

function hexToRgb(hex: number) {
  const r = (hex >> 16) & 255;
  const g = (hex >> 8) & 255;
  const b = hex & 255;
  return { r, g, b };
}

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const smallCubeGroupRef = useRef<THREE.Group | null>(null);

  const glitchRef = useRef<ReturnType<typeof setupGlitchComposer> | null>(null);
  const glitchEnabledRef = useRef<boolean>(true);

  const [deptOpen, setDeptOpen] = useState(false);
  const [activeDept, setActiveDept] = useState<Department | null>(null);
  const [hudVisible, setHudVisible] = useState(true);

  const deptAnchorRef = useRef<THREE.Vector3 | null>(null);

  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    if (renderer.domElement.parentElement !== mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    const sizeToContainer = () => {
      if (!mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    sizeToContainer();

    scene.children
      .filter((child) => child.name === "mainCube")
      .forEach((child) => scene.remove(child));

    const { rings } = addPortalRings(scene);
    const { cube } = createCube(23, 4);
    cubeRef.current = cube;
    scene.add(cube);

    const { update: updateStars } = createBinaryStarField(scene, 4300);
    const ember = createEmberField(scene, { count: 2300 });

    const godhead = createGodhead({
      position: new THREE.Vector3(28, 18, -100),
      scale: 1.23,
    });
    scene.add(godhead.group);

    const clock = new THREE.Clock();
    scene.onBeforeRender = () => {
      const dt = clock.getDelta();
      updateStars(dt);
      ember.update(dt);
      godhead.update(dt);

      if (
        deptOpen &&
        deptAnchorRef.current &&
        mountRef.current &&
        modalRef.current
      ) {
        const v = deptAnchorRef.current.clone().project(camera);
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;

        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;

        modalRef.current.style.left = `${x}px`;
        modalRef.current.style.top = `${y}px`;
      }
    };

    addLights(scene);
    setupKeyEvents();

    const cleanupMouseEvents = setupMouseEvents(
      renderer.domElement,
      camera,
      cubeRef,
      smallCubeGroupRef,
      () => {
        if (!cubeRef.current) return;
        const cubePosition = cubeRef.current.position.clone();
        const smallCubeGroup = breakCubeIntoSmallerCubes(
          cubeRef.current,
          scene,
          cubePosition
        );
        cubeRef.current = null;
        smallCubeGroupRef.current = smallCubeGroup;
      },
      (dept, obj) => {
        if (!mountRef.current) return;

        setActiveDept(dept);
        setDeptOpen(true);

        const objPos = new THREE.Vector3();
        obj.getWorldPosition(objPos);
        const anchor = camera.position.clone().lerp(objPos, 0.55);
        deptAnchorRef.current = anchor;

        const v = anchor.clone().project(camera);
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;

        if (modalRef.current) {
          modalRef.current.style.left = `${x}px`;
          modalRef.current.style.top = `${y}px`;
        }
      }
    );

    const handleResize = () => sizeToContainer();
    window.addEventListener("resize", handleResize);

    const cameraTargetZRef = { value: 6 };

    const glitch = setupGlitchComposer(renderer, scene, camera);
    glitch.setAmount(0.0);
    glitch.setEnabled(true);
    glitchRef.current = glitch;
    glitchEnabledRef.current = true;

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();

      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
      )
        return;

      if (k === "g") {
        glitchEnabledRef.current = !glitchEnabledRef.current;
        glitchRef.current?.setEnabled(glitchEnabledRef.current);
        glitchRef.current?.setAmount(glitchEnabledRef.current ? 0.35 : 0.0);
      }

      if (k === "h") {
        setHudVisible((v) => !v);
      }
    };

    window.addEventListener("keydown", onKey);

    window.addEventListener("keydown", onKey);

    const renderWithGlitch = {
      render: () => glitch.render(1 / 60),
    } as unknown as typeof renderer;

    animate({
      renderer: renderWithGlitch,
      scene,
      camera,
      rings,
      cameraTargetZRef,
      ringCount: 23,
      spacing: 4,
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKey);
      cleanupMouseEvents();
      // @ts-expect-error three
      scene.onBeforeRender = null;
      godhead.dispose();
    };
  }, []);

  const rgb = activeDept
    ? hexToRgb(activeDept.color)
    : { r: 0, g: 255, b: 255 };
  const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b},`;

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {hudVisible && <Hud showInitially />}

      {deptOpen && activeDept && (
        <div
          ref={modalRef}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%, -50%)",
            width: 360,
            padding: "16px 18px",
            borderRadius: 12,

            background: `${glow}0.10)`,
            border: `1px solid ${glow}0.75)`,
            boxShadow: `0 0 18px ${glow}0.65), inset 0 0 22px ${glow}0.35)`,

            backdropFilter: "blur(6px)",
            color: "#eaffff",
            fontFamily: "system-ui, sans-serif",
            letterSpacing: "0.5px",
            pointerEvents: "auto",
            animation: "holoIn 220ms ease-out",
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 6 }}>
            {activeDept.code} / {activeDept.name}
          </div>

          <div style={{ fontSize: 15, lineHeight: 1.4, marginBottom: 10 }}>
            {activeDept.blurb}
          </div>

          <div style={{ fontSize: 13, opacity: 0.95, marginBottom: 12 }}>
            Welcome to the {activeDept.name} node. This panel will display
            mission details, live status, lore and internal docs.
          </div>

          <button
            onClick={() => {
              setDeptOpen(false);
              setActiveDept(null);
              deptAnchorRef.current = null;
            }}
            style={{
              width: "100%",
              padding: "8px 10px",
              borderRadius: 8,
              border: `1px solid ${glow}0.9)`,
              background: `${glow}0.15)`,
              color: "#f2ffff",
              cursor: "pointer",
              fontWeight: 700,
              letterSpacing: "0.8px",
              textTransform: "uppercase",
              boxShadow: `0 0 10px ${glow}0.75)`,
            }}
          >
            Close
          </button>
        </div>
      )}

      <style>{`
        @keyframes holoIn {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.96); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </div>
  );
};

export default ThreeScene;
