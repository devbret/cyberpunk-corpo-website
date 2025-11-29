import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { renderer } from "../three/renderer";
import { scene } from "../three/scene";
import { camera } from "../three/camera";
import { addPortalRings } from "../three/rings";
import { createCube, breakCubeIntoSmallerCubes } from "../three/cube";
import { createBinaryStarField } from "../three/binaryStarField";
import { addLights } from "../three/lights";
import { setupKeyEvents, setupMouseEvents } from "../three/events";
import { animate } from "../three/animate";
import { createEmberField } from "../three/embers";
import { setupGlitchComposer } from "../three/glitch";
import { createGodhead } from "../three/godhead";
import Hud from "../components/Hud";

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const smallCubeGroupRef = useRef<THREE.Group | null>(null);

  const glitchRef = useRef<ReturnType<typeof setupGlitchComposer> | null>(null);
  const glitchEnabledRef = useRef<boolean>(true);

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
      if (e.key.toLowerCase() === "g") {
        glitchEnabledRef.current = !glitchEnabledRef.current;
        glitchRef.current?.setEnabled(glitchEnabledRef.current);
        if (glitchEnabledRef.current) {
          glitchRef.current?.setAmount(0.35);
        } else {
          glitchRef.current?.setAmount(0.0);
        }
      }
    };
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
      // @ts-expect-error three allows null assignment
      scene.onBeforeRender = null;
      godhead.dispose();
    };
  }, []);

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
      <Hud showInitially />
    </div>
  );
};

export default ThreeScene;
