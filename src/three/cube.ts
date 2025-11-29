import * as THREE from "three";
import { gsap } from "gsap";
import { addGlyphDecalsToCube } from "./glyphs";

export type Department = {
  code: string;
  name: string;
  path: string;
  color: number;
  blurb: string;
};

export const DEPARTMENTS: Department[] = [
  {
    code: "R&D",
    name: "Research & Development",
    path: "/r-and-d",
    color: 0x7c3aed,
    blurb: "Prototype archives, classified schematics.",
  },
  {
    code: "SEC",
    name: "Security Operations",
    path: "/security",
    color: 0xff4d4d,
    blurb: "Threat intel, incident logs, counter-ops.",
  },
  {
    code: "FIN",
    name: "Finance Directorate",
    path: "/finance",
    color: 0xffa500,
    blurb: "Ledger mirrors, slush accounts, forecasts.",
  },
  {
    code: "AI",
    name: "AI Systems Lab",
    path: "/ai-systems",
    color: 0x00ffff,
    blurb: "Autonomous agents, oversight bypasses.",
  },
  {
    code: "OPS",
    name: "Field Operations",
    path: "/operations",
    color: 0xffff00,
    blurb: "Contractors, missions, supply routes.",
  },
  {
    code: "PR",
    name: "PR & Influence",
    path: "/influence",
    color: 0x66ccff,
    blurb: "Media scaffolds, narrative tuning.",
  },
  {
    code: "LGL",
    name: "Legal Instruments",
    path: "/legal",
    color: 0x00ff7f,
    blurb: "Hold-harmless, NDAs, arbitration kits.",
  },
  {
    code: "ARC",
    name: "Cold Archives",
    path: "/archives",
    color: 0xff00ff,
    blurb: "Legacy ops, deprecated doctrines.",
  },
];

function deptForIndex(i: number): Department {
  return DEPARTMENTS[i % DEPARTMENTS.length];
}

type PieceUserData = {
  offset: THREE.Vector3;
  department: Department;
  twinklePhase: number;
  orbitSpeed: number;
  wobbleMag: number;
};

export type CompanyGlyphOptions = {
  code?: string;
  color?: number;
  glow?: number;
  opacity?: number;
  sizeScale?: number;
  inset?: number;
};

export function createCube(
  ringCount: number,
  spacing: number,
  company: CompanyGlyphOptions = {}
) {
  const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const cubeMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f12,
    roughness: 0.25,
    metalness: 0.15,
    clearcoat: 0.8,
    clearcoatRoughness: 0.35,
    transmission: 0.25,
    transparent: true,
    opacity: 0.95,
    emissive: 0x00ffff,
    emissiveIntensity: 0.6,
  });

  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.name = "mainCube";
  cube.position.z = -(ringCount * spacing) - 2;

  const edgeMat = new THREE.LineBasicMaterial({
    color: 0xff00ff,
    transparent: true,
    opacity: 0.75,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(cubeGeometry, 30),
    edgeMat
  );
  cube.add(edges);

  const innerLight = new THREE.PointLight(0x66eeff, 2.2, 8, 2);
  const coreMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x88ffff })
  );
  innerLight.add(coreMesh);
  cube.add(innerLight);

  {
    const code = company.code ?? "CORP";
    const color = company.color ?? 0x00ffff;
    const glow = company.glow ?? 16;
    const opacity = company.opacity ?? 0.95;
    const sizeScale = company.sizeScale ?? 0.82;
    const inset = company.inset ?? 0.002;

    const faceSize = 1.5 * sizeScale;
    addGlyphDecalsToCube(cube, faceSize, color, code, {
      glow,
      opacity,
      inset,
    });
  }

  const startT = performance.now();
  const baseY = cube.position.y;
  let last = startT;

  cube.onBeforeRender = () => {
    const now = performance.now();
    const t = (now - startT) * 0.001;
    const dt = (now - last) * 0.001;
    last = now;

    cube.position.y = baseY + Math.sin(t * 1.2) * 0.15;
    cube.rotateY(0.2 * dt);
    cube.rotateX(0.1 * dt);

    (cube.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
      0.6 + Math.sin(t * 2.0) * 0.4;
    innerLight.intensity = 1.8 + Math.sin(t * 2.0) * 0.6;
    edgeMat.opacity = 0.55 + Math.sin(t * 3.2) * 0.25;
  };

  return { cube, cubeMaterial };
}

export function breakCubeIntoSmallerCubes(
  cube: THREE.Mesh,
  scene: THREE.Scene,
  cubePosition: THREE.Vector3
) {
  if (cube.parent) cube.parent.remove(cube);
  cube.onBeforeRender = () => {};

  cube.traverse((obj) => {
    const m = obj as THREE.Mesh;
    if ((m as THREE.Mesh).geometry) (m as THREE.Mesh).geometry.dispose?.();
    const mat = (m as THREE.Mesh).material as
      | THREE.Material
      | THREE.Material[]
      | undefined;
    if (Array.isArray(mat)) mat.forEach((mm) => mm.dispose?.());
    else mat?.dispose?.();
  });

  const smallCubeGroup = new THREE.Group();
  smallCubeGroup.name = "shatteredCube";
  smallCubeGroup.position.copy(cubePosition);
  scene.add(smallCubeGroup);

  const waveMat = new THREE.MeshBasicMaterial({
    color: 0x66eeff,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const wave = new THREE.Mesh(
    new THREE.TorusGeometry(0.6, 0.02, 12, 64),
    waveMat
  );
  smallCubeGroup.add(wave);
  gsap.fromTo(
    wave.scale,
    { x: 0.01, y: 0.01, z: 0.01 },
    { x: 8, y: 8, z: 8, duration: 0.9, ease: "power2.out" }
  );
  gsap.to(waveMat, {
    opacity: 0,
    duration: 0.9,
    ease: "power2.out",
    onComplete: () => {
      smallCubeGroup.remove(wave);
      wave.geometry.dispose();
      waveMat.dispose();
    },
  });

  const originalSize = 1.5;
  const subCubeSize = originalSize / 2;
  const halfSubCube = subCubeSize / 2;
  const offsets: Array<[number, number, number]> = [
    [-halfSubCube, -halfSubCube, -halfSubCube],
    [-halfSubCube, -halfSubCube, halfSubCube],
    [-halfSubCube, halfSubCube, -halfSubCube],
    [-halfSubCube, halfSubCube, halfSubCube],
    [halfSubCube, -halfSubCube, -halfSubCube],
    [halfSubCube, -halfSubCube, halfSubCube],
    [halfSubCube, halfSubCube, -halfSubCube],
    [halfSubCube, halfSubCube, halfSubCube],
  ];

  const pieceGeo = new THREE.BoxGeometry(subCubeSize, subCubeSize, subCubeSize);

  offsets.forEach((offset, index) => {
    const dept = deptForIndex(index);
    const color = dept.color;

    const mat = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.45,
      roughness: 0.35,
      metalness: 0.1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.3,
      transparent: true,
      opacity: 1,
    });

    const smallCube = new THREE.Mesh<
      THREE.BoxGeometry,
      THREE.MeshPhysicalMaterial
    >(pieceGeo, mat);
    smallCube.position.set(0, 0, 0);

    const edge = new THREE.LineSegments(
      new THREE.EdgesGeometry(pieceGeo, 30),
      new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    smallCube.add(edge);

    addGlyphDecalsToCube(smallCube, subCubeSize * 0.9, color, dept.code, {
      glow: 16,
      opacity: 0.95,
      inset: 0.002,
    });

    const userData: PieceUserData = {
      offset: new THREE.Vector3(...offset),
      department: dept,
      twinklePhase: Math.random() * Math.PI * 2,
      orbitSpeed: 0.3 + Math.random() * 0.5,
      wobbleMag: 0.08 + Math.random() * 0.08,
    };
    smallCube.userData = userData;

    const cubeContainer = new THREE.Group();
    cubeContainer.add(smallCube);
    smallCubeGroup.add(cubeContainer);

    gsap.to(cubeContainer.position, {
      duration: 1.15,
      delay: index * 0.03,
      x: offset[0] * 4,
      y: offset[1] * 4,
      z: offset[2] * 4,
      ease: "power3.out",
    });

    gsap.fromTo(
      cubeContainer.rotation,
      {
        x: Math.random() * Math.PI,
        y: Math.random() * Math.PI,
        z: Math.random() * Math.PI,
      },
      { x: 0, y: 0, z: 0, duration: 1.2, ease: "power2.out" }
    );

    const vibrationMagnitude = 0.13;
    gsap.to(smallCube.position, {
      duration: 0.0023,
      x: `+=${(Math.random() - 0.5) * vibrationMagnitude}`,
      y: `+=${(Math.random() - 0.5) * vibrationMagnitude}`,
      z: `+=${(Math.random() - 0.5) * vibrationMagnitude}`,
      repeat: -1,
      yoyo: true,
      ease: "power1.inOut",
    });

    const t0 = performance.now() * 0.001 + Math.random() * 10;
    cubeContainer.onBeforeRender = () => {
      const t = performance.now() * 0.001 - t0;
      const d = smallCube.userData as PieceUserData;

      const wob = Math.sin(t * 2.2 + d.twinklePhase) * d.wobbleMag;
      smallCube.position.x += Math.sin(t * 11.0) * 0.0008;
      smallCube.position.y += Math.cos(t * 9.7) * 0.0008;
      cubeContainer.rotation.z += 0.001 * d.orbitSpeed;

      (smallCube.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
        0.5 + (Math.sin(t * 3.0 + d.twinklePhase) * 0.5 + 0.5) * 0.8;

      (edge.material as THREE.LineBasicMaterial).opacity =
        0.5 +
        (Math.sin(t * 4.2 + d.twinklePhase) * 0.5 + 0.5) * 0.4 +
        wob * 0.5;
    };
  });

  const sphereLight = new THREE.PointLight(0xffffff, 3.2, 20);
  sphereLight.position.set(0, 0, 0);
  smallCubeGroup.add(sphereLight);

  const sphereGeometry = new THREE.SphereGeometry(subCubeSize * 0.3, 32, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.85,
  });
  const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphereLight.add(sphereMesh);

  gsap.fromTo(
    sphereMesh.scale,
    { x: 0.6, y: 0.6, z: 0.6 },
    { x: 1.4, y: 1.4, z: 1.4, duration: 0.8, ease: "power2.out" }
  );
  gsap.to(sphereMaterial, {
    opacity: 0.2,
    duration: 1.2,
    ease: "power2.out",
  });

  return smallCubeGroup;
}
