import * as THREE from "three";
import { gsap } from "gsap";

export function createCube(ringCount: number, spacing: number) {
  const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const cubeMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 1,
  });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.name = "mainCube";
  cube.position.z = -(ringCount * spacing) - 2;
  return { cube, cubeMaterial };
}

export function breakCubeIntoSmallerCubes(
  cube: THREE.Mesh,
  scene: THREE.Scene,
  cubePosition: THREE.Vector3
) {
  scene.children
    .filter((child) => child.name === "mainCube")
    .forEach((child) => scene.remove(child));

  const smallCubeGroup = new THREE.Group();
  smallCubeGroup.position.copy(cubePosition);
  scene.add(smallCubeGroup);

  const originalSize = 1.5;
  const subCubeSize = originalSize / 2;
  const halfSubCube = subCubeSize / 2;
  const offsets = [
    [-halfSubCube, -halfSubCube, -halfSubCube],
    [-halfSubCube, -halfSubCube, halfSubCube],
    [-halfSubCube, halfSubCube, -halfSubCube],
    [-halfSubCube, halfSubCube, halfSubCube],
    [halfSubCube, -halfSubCube, -halfSubCube],
    [halfSubCube, -halfSubCube, halfSubCube],
    [halfSubCube, halfSubCube, -halfSubCube],
    [halfSubCube, halfSubCube, halfSubCube],
  ];

  const colors = [
    0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500,
    0x800080,
  ];

  offsets.forEach((offset, index) => {
    const geometry = new THREE.BoxGeometry(
      subCubeSize,
      subCubeSize,
      subCubeSize
    );
    const material = new THREE.MeshStandardMaterial({
      color: colors[index],
      emissive: 0x000000,
      emissiveIntensity: 0.0,
      transparent: true,
      opacity: 1,
    });
    const smallCube = new THREE.Mesh(geometry, material);
    smallCube.position.set(0, 0, 0);
    smallCube.userData.offset = new THREE.Vector3(...offset);

    if (index === 0) {
      smallCube.userData.destination = "/about-us";
    }

    smallCubeGroup.add(smallCube);

    gsap.to(smallCube.position, {
      duration: 1,
      x: offset[0] * 4,
      y: offset[1] * 4,
      z: offset[2] * 4,
      ease: "power2.out",
    });
  });

  const sphereLight = new THREE.PointLight(0xffffff, 3, 20);
  sphereLight.position.set(0, 0, 0);
  smallCubeGroup.add(sphereLight);

  const sphereGeometry = new THREE.SphereGeometry(subCubeSize * 0.3, 32, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphereLight.add(sphereMesh);

  return smallCubeGroup;
}
