import * as THREE from "three";

export function addLights(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x00ffff, 1, 10);
  pointLight.position.set(0, 2, 2);
  scene.add(pointLight);
}
