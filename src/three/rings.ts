import * as THREE from "three";

export function createPortalRing() {
  const geometry = new THREE.TorusGeometry(2, 0.1, 16, 100);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  const ringMesh = new THREE.Mesh(geometry, material);

  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
  });
  const glowMesh = new THREE.Mesh(geometry.clone(), glowMaterial);
  glowMesh.scale.multiplyScalar(1.2);

  const group = new THREE.Group();
  group.add(ringMesh);
  group.add(glowMesh);
  return group;
}

export function addPortalRings(
  scene: THREE.Scene,
  ringCount = 23,
  spacing = 4
) {
  const rings: THREE.Group[] = [];
  for (let i = 0; i < ringCount; i++) {
    const ring = createPortalRing();
    ring.position.z = -i * spacing;
    scene.add(ring);
    rings.push(ring);
  }
  return rings;
}
