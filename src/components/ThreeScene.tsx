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

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const smallCubeGroupRef = useRef<THREE.Group | null>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    if (renderer.domElement.parentElement !== mountRef.current) {
      mountRef.current.appendChild(renderer.domElement);
    }

    scene.children
      .filter((child) => child.name === "mainCube")
      .forEach((child) => scene.remove(child));

    const rings = addPortalRings(scene);
    const { cube } = createCube(23, 4);
    cubeRef.current = cube;
    scene.add(cube);

    createBinaryStarField(scene);
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

    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);

    const cameraTargetZRef = { value: 6 };
    animate({
      renderer,
      scene,
      camera,
      rings,
      cameraTargetZRef,
      ringCount: 23,
      spacing: 4,
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      cleanupMouseEvents();
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default ThreeScene;
