import * as THREE from "three";
import { keys } from "./events";

export interface AnimateConfig {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  rings: THREE.Group[];
  cameraTargetZRef: { value: number };
  ringCount: number;
  spacing: number;
}

export function animate(config: AnimateConfig) {
  const {
    renderer,
    scene,
    camera,
    rings,
    cameraTargetZRef,
    ringCount,
    spacing,
  } = config;
  const clock = new THREE.Clock();
  const keySpeed = 30.0;

  (function loop() {
    requestAnimationFrame(loop);
    const delta = clock.getDelta();

    if (keys.ArrowUp) cameraTargetZRef.value -= keySpeed * delta;
    if (keys.ArrowDown) cameraTargetZRef.value += keySpeed * delta;
    const cameraMinZ = -((ringCount - 1) * spacing) - 2;
    cameraTargetZRef.value = Math.max(
      cameraMinZ,
      Math.min(6, cameraTargetZRef.value)
    );
    camera.position.z += (cameraTargetZRef.value - camera.position.z) * 0.1;

    rings.forEach((ring) => {
      ring.rotation.z += delta * 0.2;
    });

    const mainCube = scene.getObjectByName("mainCube") as
      | THREE.Mesh
      | undefined;
    if (mainCube) {
      const cubeMaterial = mainCube.material as THREE.MeshStandardMaterial;
      const distanceToCube = Math.abs(mainCube.position.z - camera.position.z);
      const maxDistance = Math.abs(cameraMinZ - mainCube.position.z);
      cubeMaterial.emissiveIntensity = 1.0 - distanceToCube / maxDistance;
    }

    renderer.render(scene, camera);
  })();
}
