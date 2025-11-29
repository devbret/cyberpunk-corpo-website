import * as THREE from "three";

export function addLights(scene: THREE.Scene) {
  const ambientLight = new THREE.AmbientLight(0xa0e8ff, 0.25);
  scene.add(ambientLight);

  const keyLight = new THREE.PointLight(0x00ffff, 2.2, 30, 2);
  keyLight.position.set(5, 5, 5);
  scene.add(keyLight);

  const fillLight = new THREE.PointLight(0xff00ff, 1.5, 30, 2);
  fillLight.position.set(-5, 2, 5);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0xffffff, 1.5, 40, 2);
  rimLight.position.set(0, 5, -10);
  scene.add(rimLight);

  const hemiLight = new THREE.HemisphereLight(0x88ccff, 0x080820, 0.2);
  scene.add(hemiLight);

  const startT = performance.now();
  const animateLights = () => {
    const t = (performance.now() - startT) * 0.001;
    fillLight.position.x = -5 + Math.sin(t * 0.5) * 1.5;
    fillLight.position.y = 2 + Math.cos(t * 0.3) * 0.5;
    rimLight.intensity = 1.5 + Math.sin(t * 2.0) * 0.3;
  };
  scene.onBeforeRender = animateLights;
}
