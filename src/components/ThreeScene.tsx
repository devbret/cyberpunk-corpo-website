import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { gsap } from "gsap";
import { useNavigate } from "react-router-dom";
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

type HubState = {
  initialized: boolean;
  rings: THREE.Group[];
  stars: ReturnType<typeof createBinaryStarField> | null;
  ember: ReturnType<typeof createEmberField> | null;
  godhead: ReturnType<typeof createGodhead> | null;
  cube: THREE.Mesh | null;
  smallCubeGroup: THREE.Group | null;
  preFlyPos: THREE.Vector3 | null;
  preFlyQuat: THREE.Quaternion | null;
};

const _hub: HubState = {
  initialized: false,
  rings: [],
  stars: null,
  ember: null,
  godhead: null,
  cube: null,
  smallCubeGroup: null,
  preFlyPos: null,
  preFlyQuat: null,
};

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const cubeRef = useRef<THREE.Mesh | null>(null);
  const smallCubeGroupRef = useRef<THREE.Group | null>(null);
  const glitchRef = useRef<ReturnType<typeof setupGlitchComposer> | null>(null);
  const glitchEnabledRef = useRef<boolean>(true);
  const [hudVisible, setHudVisible] = useState(true);

  const navigate = useNavigate();

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

    if (!_hub.initialized) {
      _hub.rings = addPortalRings(scene).rings;

      const { cube } = createCube(23, 4);
      _hub.cube = cube;
      scene.add(cube);

      _hub.stars = createBinaryStarField(scene, 4300);
      _hub.ember = createEmberField(scene, { count: 2300 });

      _hub.godhead = createGodhead({
        position: new THREE.Vector3(28, 18, -100),
        scale: 1.23,
      });
      scene.add(_hub.godhead.group);

      addLights(scene);
      setupKeyEvents();

      _hub.initialized = true;
    } else {
      if (_hub.preFlyPos && _hub.preFlyQuat) {
        camera.position.copy(_hub.preFlyPos);
        camera.quaternion.copy(_hub.preFlyQuat);
        _hub.preFlyPos = null;
        _hub.preFlyQuat = null;
      }
    }

    cubeRef.current = _hub.cube;
    smallCubeGroupRef.current = _hub.smallCubeGroup;

    const clock = new THREE.Clock();
    scene.onBeforeRender = () => {
      const dt = clock.getDelta();
      _hub.stars?.update(dt);
      _hub.ember?.update(dt);
      _hub.godhead?.update(dt);
    };

    const cameraTargetZRef = { value: camera.position.z };

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
          cubePosition,
        );
        cubeRef.current = null;
        _hub.cube = null;
        smallCubeGroupRef.current = smallCubeGroup;
        _hub.smallCubeGroup = smallCubeGroup;
      },
      (dept, obj) => {
        _hub.preFlyPos = camera.position.clone();
        _hub.preFlyQuat = camera.quaternion.clone();

        const targetPos = new THREE.Vector3();
        obj.getWorldPosition(targetPos);
        const camEnd = new THREE.Vector3(
          targetPos.x,
          targetPos.y,
          targetPos.z + 1.8,
        );

        cameraTargetZRef.value = camEnd.z;
        glitchRef.current?.setAmount(0.92);

        gsap.killTweensOf(camera.position);
        gsap.to(camera.position, {
          x: camEnd.x,
          y: camEnd.y,
          z: camEnd.z,
          duration: 0.7,
          ease: "power3.in",
          onComplete: () => { navigate(dept.path); },
        });
      },
    );

    const handleResize = () => sizeToContainer();
    window.addEventListener("resize", handleResize);

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

    const renderWithGlitch = {
      render: () => glitch.render(1 / 60),
    } as unknown as typeof renderer;

    const stopAnimate = animate({
      renderer: renderWithGlitch,
      scene,
      camera,
      rings: _hub.rings,
      cameraTargetZRef,
      ringCount: 23,
      spacing: 4,
    });

    return () => {
      stopAnimate();
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("keydown", onKey);
      cleanupMouseEvents();
      glitchRef.current?.dispose();
      scene.onBeforeRender = () => {};
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
      {hudVisible && <Hud showInitially />}
    </div>
  );
};

export default ThreeScene;
