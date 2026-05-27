import * as THREE from "three";
import type { Department } from "./cube";

export type RoomHandle = {
  update: (dt: number) => void;
  dispose: () => void;
};

type HeroResult = {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
};

function createRoomDust(
  scene: THREE.Scene,
  color: THREE.Color,
  count = 700,
): { update: (dt: number) => void; dispose: () => void } {
  const positions = new Float32Array(count * 3);
  const vels = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = 4 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    positions[i3 + 0] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.5;
    positions[i3 + 2] = r * Math.cos(phi);
    vels[i3 + 0] = (Math.random() - 0.5) * 0.35;
    vels[i3 + 1] = (Math.random() - 0.5) * 0.18;
    vels[i3 + 2] = (Math.random() - 0.5) * 0.35;
    sizes[i] = 0.04 + Math.random() * 0.12;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: color.clone() } },
    vertexShader: `
      attribute float aSize;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * (220.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.1, d) * 0.55;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });

  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);

  const update = (dt: number) => {
    const pa = geo.getAttribute("position") as THREE.BufferAttribute;
    const arr = pa.array as Float32Array;
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 0] += vels[i3 + 0] * dt;
      arr[i3 + 1] += vels[i3 + 1] * dt;
      arr[i3 + 2] += vels[i3 + 2] * dt;
      const x = arr[i3],
        y = arr[i3 + 1],
        z = arr[i3 + 2];
      if (x * x + y * y + z * z > 144) {
        arr[i3 + 0] *= -0.7;
        arr[i3 + 1] *= -0.7;
        arr[i3 + 2] *= -0.7;
      }
    }
    pa.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(pts);
    geo.dispose();
    mat.dispose();
  };

  return { update, dispose };
}

function buildRDHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const coreGeo = new THREE.IcosahedronGeometry(1.05, 2);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.22,
    roughness: 0.08,
    metalness: 0.4,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(coreGeo, coreMat));
  disposes.push(() => {
    coreGeo.dispose();
    coreMat.dispose();
  });

  const icoPivots: THREE.Group[] = [];
  for (let i = 0; i < 2; i++) {
    const geo = new THREE.IcosahedronGeometry(1.55 + i * 0.95, 0);
    const mat = new THREE.MeshBasicMaterial({
      color,
      wireframe: true,
      transparent: true,
      opacity: 0.42 - i * 0.14,
    });
    const pivot = new THREE.Group();
    pivot.add(new THREE.Mesh(geo, mat));
    group.add(pivot);
    icoPivots.push(pivot);
    disposes.push(() => {
      geo.dispose();
      mat.dispose();
    });
  }

  const tabletGeo = new THREE.BoxGeometry(1.15, 0.7, 0.045);
  const tabletMat = new THREE.MeshPhysicalMaterial({
    color: 0x08020f,
    emissive: color,
    emissiveIntensity: 0.28,
    transparent: true,
    opacity: 0.78,
    roughness: 0.25,
    metalness: 0.55,
  });
  const tabletEdgeGeo = new THREE.EdgesGeometry(tabletGeo);
  const tabletEdgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.65,
  });
  const tabletGroups: { g: THREE.Group; baseY: number }[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const r = 3.6;
    const tg = new THREE.Group();
    tg.add(new THREE.Mesh(tabletGeo, tabletMat));
    tg.add(new THREE.LineSegments(tabletEdgeGeo, tabletEdgeMat));
    const by = Math.sin(i * 1.05) * 0.85;
    tg.position.set(Math.cos(angle) * r, by, Math.sin(angle) * r);
    tg.rotation.y = -angle + Math.PI / 2;
    group.add(tg);
    tabletGroups.push({ g: tg, baseY: by });
  }
  disposes.push(() => {
    tabletGeo.dispose();
    tabletMat.dispose();
    tabletEdgeGeo.dispose();
    tabletEdgeMat.dispose();
  });

  const flaskBodyGeo = new THREE.CylinderGeometry(0.16, 0.22, 0.62, 12);
  const flaskCapGeo = new THREE.SphereGeometry(0.18, 12, 8);
  const flaskMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0.2,
  });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const r = 2.2;
    const fg = new THREE.Group();
    fg.add(new THREE.Mesh(flaskBodyGeo, flaskMat));
    const cap = new THREE.Mesh(flaskCapGeo, flaskMat);
    cap.position.y = 0.42;
    fg.add(cap);
    fg.position.set(Math.cos(angle) * r, -1.0, Math.sin(angle) * r);
    group.add(fg);
  }
  disposes.push(() => {
    flaskBodyGeo.dispose();
    flaskCapGeo.dispose();
    flaskMat.dispose();
  });

  const glowGeo = new THREE.SphereGeometry(0.2, 16, 12);
  const glowMat = new THREE.MeshBasicMaterial({ color });
  group.add(new THREE.Mesh(glowGeo, glowMat));
  disposes.push(() => {
    glowGeo.dispose();
    glowMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    icoPivots[0].rotation.y += dt * 0.38;
    icoPivots[0].rotation.x += dt * 0.14;
    icoPivots[1].rotation.y -= dt * 0.25;
    icoPivots[1].rotation.z += dt * 0.1;
    coreMat.emissiveIntensity = 0.28 + Math.sin(t * 2.1) * 0.15;
    tabletGroups.forEach(({ g, baseY }, i) => {
      g.position.y = baseY + Math.sin(t * 0.75 + i * 1.05) * 0.18;
      g.rotation.y += dt * 0.06 * (i % 2 === 0 ? 1 : -1);
    });
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildSecHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const ringGeo = new THREE.TorusGeometry(2.0, 0.028, 8, 80);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const rings: THREE.Mesh[] = [];
  for (let i = 0; i < 14; i++) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI,
    );
    group.add(ring);
    rings.push(ring);
  }
  disposes.push(() => {
    ringGeo.dispose();
    ringMat.dispose();
  });

  const eyeGeo = new THREE.SphereGeometry(0.52, 32, 24);
  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0c0408,
    emissive: color,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.9,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  group.add(new THREE.Mesh(eyeGeo, eyeMat));
  disposes.push(() => {
    eyeGeo.dispose();
    eyeMat.dispose();
  });

  const irisGeo = new THREE.TorusGeometry(0.62, 0.065, 14, 64);
  const irisMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  group.add(new THREE.Mesh(irisGeo, irisMat));
  disposes.push(() => {
    irisGeo.dispose();
    irisMat.dispose();
  });

  const towerShaftGeo = new THREE.CylinderGeometry(0.045, 0.065, 3.0, 8);
  const camHeadGeo = new THREE.SphereGeometry(0.18, 12, 10);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x0c0810,
    roughness: 0.4,
    metalness: 0.88,
    emissive: color,
    emissiveIntensity: 0.1,
  });
  const camMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.7,
    roughness: 0.2,
    metalness: 0.6,
  });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const r = 4.5;
    const tg = new THREE.Group();
    tg.add(new THREE.Mesh(towerShaftGeo, towerMat));
    const cam = new THREE.Mesh(camHeadGeo, camMat);
    cam.position.y = 1.65;
    tg.add(cam);
    tg.position.set(Math.cos(angle) * r, -1.4, Math.sin(angle) * r);
    group.add(tg);
  }
  disposes.push(() => {
    towerShaftGeo.dispose();
    camHeadGeo.dispose();
    towerMat.dispose();
    camMat.dispose();
  });

  const beamGeo = new THREE.PlaneGeometry(5.0, 0.016);
  const beamMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beamRoot = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.y = (i / 3) * Math.PI;
    beamRoot.add(beam);
  }
  group.add(beamRoot);
  disposes.push(() => {
    beamGeo.dispose();
    beamMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    group.rotation.y += dt * 0.12;
    rings.forEach((r, i) => {
      r.rotation.z += dt * (0.08 + i * 0.012) * (i % 2 === 0 ? 1 : -1);
    });
    beamRoot.rotation.y += dt * 1.5;
    eyeMat.emissiveIntensity = 0.4 + Math.sin(t * 3.2) * 0.28;
    irisMat.opacity = 0.6 + Math.sin(t * 2.5) * 0.32;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildFinHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const sphereGeo = new THREE.SphereGeometry(0.85, 32, 24);
  const sphereMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.2,
    roughness: 0.08,
    metalness: 0.95,
    clearcoat: 0.85,
    clearcoatRoughness: 0.06,
  });
  group.add(new THREE.Mesh(sphereGeo, sphereMat));
  disposes.push(() => {
    sphereGeo.dispose();
    sphereMat.dispose();
  });

  const barHeights = [2.6, 1.5, 3.4, 2.1, 3.9, 1.3, 2.7, 3.1];
  const barMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.18,
    roughness: 0.22,
    metalness: 0.7,
  });
  const capGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.055, 8);
  const capMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const bars: { mesh: THREE.Mesh; baseY: number }[] = [];
  for (let i = 0; i < 8; i++) {
    const h = barHeights[i];
    const barGeo = new THREE.CylinderGeometry(0.22, 0.22, h, 8);
    const bar = new THREE.Mesh(barGeo, barMat);
    const angle = (i / 8) * Math.PI * 2;
    const r = 3.3;
    const by = -3.2 + h / 2;
    bar.position.set(Math.cos(angle) * r, by, Math.sin(angle) * r);
    group.add(bar);
    bars.push({ mesh: bar, baseY: by });

    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(Math.cos(angle) * r, by + h / 2 + 0.03, Math.sin(angle) * r);
    group.add(cap);
    disposes.push(() => barGeo.dispose());
  }
  disposes.push(() => {
    barMat.dispose();
    capGeo.dispose();
    capMat.dispose();
  });

  const coinGeo = new THREE.TorusGeometry(1.25, 0.055, 10, 52);
  const coinMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    metalness: 0.9,
    roughness: 0.1,
  });
  const coins: THREE.Mesh[] = [];
  for (let i = 0; i < 5; i++) {
    const coin = new THREE.Mesh(coinGeo, coinMat);
    coin.position.y = (i - 2) * 0.42;
    coin.rotation.x = Math.PI / 2 + (Math.random() - 0.5) * 0.15;
    coin.rotation.z = (Math.random() - 0.5) * 0.12;
    group.add(coin);
    coins.push(coin);
  }
  disposes.push(() => {
    coinGeo.dispose();
    coinMat.dispose();
  });

  const satGeo = new THREE.TorusGeometry(0.65, 0.045, 10, 36);
  const satMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
  });
  const satRoot = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const sat = new THREE.Mesh(satGeo, satMat);
    sat.position.set(
      Math.cos(angle) * 4.8,
      (i - 1) * 1.5,
      Math.sin(angle) * 4.8,
    );
    sat.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    satRoot.add(sat);
  }
  group.add(satRoot);
  disposes.push(() => {
    satGeo.dispose();
    satMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    satRoot.rotation.y += dt * 0.42;
    coins.forEach((c, i) => {
      c.rotation.z += dt * (0.1 + i * 0.02) * (i % 2 === 0 ? 1 : -1);
    });
    sphereMat.emissiveIntensity = 0.16 + Math.sin(t * 1.5) * 0.1;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildAIHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const brainMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.32,
    transparent: true,
    opacity: 0.26,
    roughness: 0.15,
    metalness: 0.3,
    side: THREE.DoubleSide,
  });
  const brainOffsets: [number, number, number, number][] = [
    [0, 0, 0, 0.72],
    [0.45, 0.15, 0, 0.52],
    [-0.45, 0.15, 0, 0.52],
    [0.22, -0.35, 0.25, 0.42],
    [-0.22, -0.35, 0.25, 0.42],
    [0, 0.25, -0.45, 0.48],
    [0, -0.22, -0.38, 0.38],
  ];
  for (const [bx, by, bz, br] of brainOffsets) {
    const geo = new THREE.SphereGeometry(br, 20, 14);
    const mesh = new THREE.Mesh(geo, brainMat);
    mesh.position.set(bx, by, bz);
    group.add(mesh);
    disposes.push(() => geo.dispose());
  }
  disposes.push(() => brainMat.dispose());

  const nodeCount = 22;
  const positions: THREE.Vector3[] = [];
  const nodeMats: THREE.MeshBasicMaterial[] = [];
  const nodeGeo = new THREE.SphereGeometry(0.1, 8, 6);
  disposes.push(() => nodeGeo.dispose());

  for (let i = 0; i < nodeCount; i++) {
    const phi = Math.acos(-1 + (2 * i) / nodeCount);
    const theta = Math.sqrt(nodeCount * Math.PI) * phi;
    const r = 2.4 + (Math.random() - 0.5) * 0.9;
    const pos = new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta) * 0.7,
      r * Math.cos(phi),
    );
    positions.push(pos);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
    });
    const node = new THREE.Mesh(nodeGeo, mat);
    node.position.copy(pos);
    group.add(node);
    nodeMats.push(mat);
    disposes.push(() => mat.dispose());
  }

  const edgePoints: THREE.Vector3[] = [];
  for (let i = 0; i < nodeCount; i++) {
    for (let j = i + 1; j < nodeCount; j++) {
      if (positions[i].distanceTo(positions[j]) < 2.2) {
        edgePoints.push(positions[i].clone(), positions[j].clone());
      }
    }
  }
  const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
  const edgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.22,
  });
  group.add(new THREE.LineSegments(edgeGeo, edgeMat));
  disposes.push(() => {
    edgeGeo.dispose();
    edgeMat.dispose();
  });

  const pillarBodyGeo = new THREE.CylinderGeometry(0.065, 0.065, 5.5, 8);
  const pillarCapGeo = new THREE.SphereGeometry(0.13, 10, 8);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x020810,
    roughness: 0.6,
    metalness: 0.8,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  const pillarCapMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.9,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = 4.2;
    const pg = new THREE.Group();
    pg.add(new THREE.Mesh(pillarBodyGeo, pillarMat));
    const cap = new THREE.Mesh(pillarCapGeo, pillarCapMat);
    cap.position.y = 2.85;
    pg.add(cap);
    pg.position.set(Math.cos(angle) * r, -0.2, Math.sin(angle) * r);
    group.add(pg);
  }
  disposes.push(() => {
    pillarBodyGeo.dispose();
    pillarCapGeo.dispose();
    pillarMat.dispose();
    pillarCapMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    group.rotation.y += dt * 0.22;
    nodeMats.forEach((m, i) => {
      m.opacity = 0.35 + (Math.sin(t * 2.6 + i * 0.38) * 0.5 + 0.5) * 0.55;
    });
    brainMat.emissiveIntensity = 0.28 + Math.sin(t * 2.0) * 0.15;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildOpsHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const terrainGeo = new THREE.PlaneGeometry(13, 13, 24, 24);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posArr[i * 3 + 0];
    const y = posArr[i * 3 + 1];
    posArr[i * 3 + 2] =
      Math.sin(x * 0.45) * Math.cos(y * 0.45) * 1.1 +
      (Math.random() - 0.5) * 0.45;
  }
  posAttr.needsUpdate = true;
  terrainGeo.computeVertexNormals();
  const terrainMat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.28,
  });
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  terrain.position.y = -2.6;
  group.add(terrain);
  disposes.push(() => {
    terrainGeo.dispose();
    terrainMat.dispose();
  });

  const hexGeo = new THREE.CylinderGeometry(1.05, 1.05, 0.2, 6);
  const hexMat = new THREE.MeshPhysicalMaterial({
    color: 0x060e06,
    emissive: color,
    emissiveIntensity: 0.35,
    transparent: true,
    opacity: 0.82,
    roughness: 0.2,
    metalness: 0.7,
  });
  const hexDisplay = new THREE.Mesh(hexGeo, hexMat);
  hexDisplay.position.y = -2.0;
  group.add(hexDisplay);
  const hexEdgeGeo = new THREE.EdgesGeometry(hexGeo);
  const hexEdgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.8,
  });
  const hexEdge = new THREE.LineSegments(hexEdgeGeo, hexEdgeMat);
  hexEdge.position.y = -2.0;
  group.add(hexEdge);
  disposes.push(() => {
    hexGeo.dispose();
    hexMat.dispose();
    hexEdgeGeo.dispose();
    hexEdgeMat.dispose();
  });

  const dispGeo = new THREE.OctahedronGeometry(0.88, 0);
  const dispMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.4,
    transparent: true,
    opacity: 0.48,
    roughness: 0.15,
    metalness: 0.5,
  });
  const dispWireGeo = new THREE.EdgesGeometry(dispGeo);
  const dispWireMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.75,
  });
  const display = new THREE.Group();
  display.add(new THREE.Mesh(dispGeo, dispMat));
  display.add(new THREE.LineSegments(dispWireGeo, dispWireMat));
  display.position.y = 1.0;
  group.add(display);
  disposes.push(() => {
    dispGeo.dispose();
    dispMat.dispose();
    dispWireGeo.dispose();
    dispWireMat.dispose();
  });

  const bunkerMat = new THREE.MeshStandardMaterial({
    color: 0x080e06,
    roughness: 0.7,
    metalness: 0.55,
    emissive: color,
    emissiveIntensity: 0.1,
  });
  const bunkerSpecs = [
    { w: 1.1, h: 0.45, d: 0.65, a: 0, r: 4.8 },
    { w: 0.75, h: 0.55, d: 0.9, a: (Math.PI * 2) / 3, r: 4.2 },
    { w: 0.95, h: 0.38, d: 0.75, a: (Math.PI * 4) / 3, r: 5.0 },
  ];
  for (const { w, h, d, a, r } of bunkerSpecs) {
    const bg = new THREE.BoxGeometry(w, h, d);
    const bunker = new THREE.Mesh(bg, bunkerMat);
    bunker.position.set(Math.cos(a) * r, -2.85, Math.sin(a) * r);
    bunker.rotation.y = a;
    group.add(bunker);
    disposes.push(() => bg.dispose());
  }
  disposes.push(() => bunkerMat.dispose());

  const markerGeo = new THREE.ConeGeometry(0.1, 0.5, 6);
  const markerMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.88,
  });
  const markers: THREE.Mesh[] = [];
  const markerPhases: number[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const r = 1.8 + Math.random() * 2;
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.set(Math.cos(angle) * r, -1.5, Math.sin(angle) * r);
    group.add(marker);
    markers.push(marker);
    markerPhases.push(Math.random() * Math.PI * 2);
  }
  disposes.push(() => {
    markerGeo.dispose();
    markerMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    markers.forEach((m, i) => {
      m.position.y = -1.5 + Math.sin(t * 1.4 + markerPhases[i]) * 0.28;
    });
    display.rotation.y += dt * 0.52;
    display.rotation.x += dt * 0.3;
    hexDisplay.rotation.y += dt * 0.18;
    hexMat.emissiveIntensity = 0.28 + Math.sin(t * 1.8) * 0.14;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildPRHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const towerGeo = new THREE.CylinderGeometry(0.06, 0.22, 4.5, 10);
  const towerMat = new THREE.MeshStandardMaterial({
    color: 0x0a0c0a,
    roughness: 0.35,
    metalness: 0.9,
    emissive: color,
    emissiveIntensity: 0.12,
  });
  const tower = new THREE.Mesh(towerGeo, towerMat);
  tower.position.y = -0.4;
  group.add(tower);
  disposes.push(() => {
    towerGeo.dispose();
    towerMat.dispose();
  });

  const beaconGeo = new THREE.SphereGeometry(0.12, 10, 8);
  const beaconMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const beacon = new THREE.Mesh(beaconGeo, beaconMat);
  beacon.position.y = 1.9;
  group.add(beacon);
  disposes.push(() => {
    beaconGeo.dispose();
    beaconMat.dispose();
  });

  const screenGeo = new THREE.BoxGeometry(1.8, 1.1, 0.055);
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0x020a06,
    emissive: color,
    emissiveIntensity: 0.3,
    transparent: true,
    opacity: 0.82,
    roughness: 0.2,
    metalness: 0.5,
  });
  const screenEdgeGeo = new THREE.EdgesGeometry(screenGeo);
  const screenEdgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  const screenGroups: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 6;
    const r = 4.2;
    const sg = new THREE.Group();
    sg.add(new THREE.Mesh(screenGeo, screenMat));
    sg.add(new THREE.LineSegments(screenEdgeGeo, screenEdgeMat));
    sg.position.set(Math.cos(angle) * r, (i - 1) * 0.9, Math.sin(angle) * r);
    sg.rotation.y = -angle;
    group.add(sg);
    screenGroups.push(sg);
  }
  disposes.push(() => {
    screenGeo.dispose();
    screenMat.dispose();
    screenEdgeGeo.dispose();
    screenEdgeMat.dispose();
  });

  const ringGeo = new THREE.TorusGeometry(1.0, 0.022, 8, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const waveRings: { mesh: THREE.Mesh; phase: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.6;
    group.add(ring);
    waveRings.push({ mesh: ring, phase: (i / 5) * Math.PI * 2 });
  }
  disposes.push(() => {
    ringGeo.dispose();
    ringMat.dispose();
  });

  const dishGeo = new THREE.CircleGeometry(0.55, 20);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0x080e08,
    roughness: 0.4,
    metalness: 0.85,
    emissive: color,
    emissiveIntensity: 0.14,
    side: THREE.DoubleSide,
  });
  const dishRimGeo = new THREE.TorusGeometry(0.55, 0.028, 8, 24);
  const dishRimMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
  });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    const dg = new THREE.Group();
    dg.add(new THREE.Mesh(dishGeo, dishMat));
    dg.add(new THREE.Mesh(dishRimGeo, dishRimMat));
    dg.position.set(
      Math.cos(angle) * 3.8,
      (i - 1) * 0.9,
      Math.sin(angle) * 3.8,
    );
    dg.lookAt(new THREE.Vector3(0, 1.6, 0));
    group.add(dg);
  }
  disposes.push(() => {
    dishGeo.dispose();
    dishMat.dispose();
    dishRimGeo.dispose();
    dishRimMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    waveRings.forEach(({ mesh, phase }) => {
      const progress = (t * 0.8 + phase / (Math.PI * 2)) % 1.0;
      const s = 0.5 + progress * 3.8;
      mesh.scale.set(s, s, s);
      (mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(
        0,
        0.75 - progress * 0.75,
      );
    });
    group.rotation.y += dt * 0.1;
    beaconMat.opacity = 0.5 + Math.sin(t * 4.0) * 0.45;
    screenMat.emissiveIntensity = 0.22 + Math.sin(t * 1.2) * 0.12;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildLegalHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const poleGeo = new THREE.CylinderGeometry(0.05, 0.075, 5.0, 10);
  const poleMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f0c,
    roughness: 0.3,
    metalness: 0.9,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  group.add(new THREE.Mesh(poleGeo, poleMat));
  disposes.push(() => {
    poleGeo.dispose();
    poleMat.dispose();
  });

  const beamPivot = new THREE.Group();
  beamPivot.position.y = 2.1;
  group.add(beamPivot);

  const beamGeo = new THREE.BoxGeometry(5.8, 0.055, 0.055);
  const beamMat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.5,
    roughness: 0.25,
    metalness: 0.8,
  });
  beamPivot.add(new THREE.Mesh(beamGeo, beamMat));
  disposes.push(() => {
    beamGeo.dispose();
    beamMat.dispose();
  });

  const panGeo = new THREE.CylinderGeometry(0.8, 0.8, 0.065, 22);
  const panMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0f0a,
    roughness: 0.2,
    metalness: 0.9,
    emissive: color,
    emissiveIntensity: 0.15,
    clearcoat: 0.7,
    clearcoatRoughness: 0.15,
  });
  const panRimGeo = new THREE.TorusGeometry(0.82, 0.025, 8, 26);
  const panRimMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const side of [-1, 1] as const) {
    const chain = new THREE.Group();
    chain.position.x = side * 2.6;
    beamPivot.add(chain);

    const chainGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1.7, 0),
    ]);
    const chainMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.6,
    });
    chain.add(new THREE.Line(chainGeo, chainMat));
    disposes.push(() => {
      chainGeo.dispose();
      chainMat.dispose();
    });

    const pan = new THREE.Mesh(panGeo, panMat);
    pan.position.y = -1.7;
    chain.add(pan);

    const rim = new THREE.Mesh(panRimGeo, panRimMat);
    rim.position.y = -1.7;
    rim.rotation.x = Math.PI / 2;
    chain.add(rim);
  }
  disposes.push(() => {
    panGeo.dispose();
    panMat.dispose();
    panRimGeo.dispose();
    panRimMat.dispose();
  });

  const colGeo = new THREE.CylinderGeometry(0.18, 0.22, 5.5, 14);
  const colCapGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.18, 14);
  const colMat = new THREE.MeshStandardMaterial({
    color: 0x0c0f0a,
    roughness: 0.4,
    metalness: 0.75,
    emissive: color,
    emissiveIntensity: 0.065,
  });
  for (const cx of [-4.8, 4.8]) {
    const cg = new THREE.Group();
    cg.add(new THREE.Mesh(colGeo, colMat));
    const capTop = new THREE.Mesh(colCapGeo, colMat);
    capTop.position.y = 2.85;
    cg.add(capTop);
    const capBot = new THREE.Mesh(colCapGeo, colMat);
    capBot.position.y = -2.85;
    cg.add(capBot);
    cg.position.set(cx, -0.1, -1.5);
    group.add(cg);
  }
  disposes.push(() => {
    colGeo.dispose();
    colCapGeo.dispose();
    colMat.dispose();
  });

  const docGeo = new THREE.BoxGeometry(0.85, 1.1, 0.038);
  const docMat = new THREE.MeshPhysicalMaterial({
    color: 0x060e06,
    emissive: color,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.72,
    roughness: 0.3,
    metalness: 0.4,
  });
  const docEdgeGeo = new THREE.EdgesGeometry(docGeo);
  const docEdgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.55,
  });
  const docGroups: { g: THREE.Group; baseY: number }[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const r = 3.8;
    const dg = new THREE.Group();
    dg.add(new THREE.Mesh(docGeo, docMat));
    dg.add(new THREE.LineSegments(docEdgeGeo, docEdgeMat));
    const by = (Math.random() - 0.5) * 2.5;
    dg.position.set(Math.cos(angle) * r, by, Math.sin(angle) * r);
    dg.rotation.set(
      (Math.random() - 0.5) * 0.3,
      angle + Math.PI / 2,
      (Math.random() - 0.5) * 0.25,
    );
    group.add(dg);
    docGroups.push({ g: dg, baseY: by });
  }
  disposes.push(() => {
    docGeo.dispose();
    docMat.dispose();
    docEdgeGeo.dispose();
    docEdgeMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    beamPivot.rotation.z = Math.sin(t * 0.6) * 0.18;
    docGroups.forEach(({ g, baseY }, i) => {
      g.rotation.y += dt * (0.07 + i * 0.015);
      g.position.y = baseY + Math.sin(t * 0.65 + i) * 0.18;
    });
    group.rotation.y += dt * 0.07;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildColdHero(color: THREE.Color): HeroResult {
  const group = new THREE.Group();
  const disposes: (() => void)[] = [];

  const crystalGeo = new THREE.OctahedronGeometry(0.38, 0);
  const crystalMat = new THREE.MeshPhysicalMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.22,
    transparent: true,
    opacity: 0.55,
    metalness: 0.3,
    roughness: 0.1,
    clearcoat: 0.8,
    clearcoatRoughness: 0.15,
    side: THREE.DoubleSide,
  });
  const crystals: THREE.Mesh[] = [];
  const crystalBaseScaleY: number[] = [];
  for (let i = 0; i < 18; i++) {
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    const angle = (i / 18) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const r = 0.4 + Math.random() * 2.2;
    crystal.position.set(
      Math.cos(angle) * r,
      (Math.random() - 0.5) * 3.5,
      Math.sin(angle) * r,
    );
    const sy = 1.4 + Math.random() * 2.0;
    const sx = 0.32 + Math.random() * 0.38;
    crystal.scale.set(sx, sy, sx);
    crystal.rotation.set(
      (Math.random() - 0.5) * 0.4,
      Math.random() * Math.PI,
      (Math.random() - 0.5) * 0.4,
    );
    group.add(crystal);
    crystals.push(crystal);
    crystalBaseScaleY.push(sy);
  }
  disposes.push(() => {
    crystalGeo.dispose();
    crystalMat.dispose();
  });

  const podBodyGeo = new THREE.CylinderGeometry(0.55, 0.55, 2.2, 18);
  const podDomeGeo = new THREE.SphereGeometry(
    0.55,
    18,
    10,
    0,
    Math.PI * 2,
    0,
    Math.PI / 2,
  );
  const podMat = new THREE.MeshPhysicalMaterial({
    color: 0x040c14,
    roughness: 0.12,
    metalness: 0.88,
    emissive: color,
    emissiveIntensity: 0.18,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.88,
  });
  const podWireGeo = new THREE.EdgesGeometry(podBodyGeo);
  const podWireMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.45,
  });
  const pod = new THREE.Group();
  pod.add(new THREE.Mesh(podBodyGeo, podMat));
  const dome = new THREE.Mesh(podDomeGeo, podMat);
  dome.position.y = 1.1;
  pod.add(dome);
  pod.add(new THREE.LineSegments(podWireGeo, podWireMat));
  pod.position.y = 0.2;
  group.add(pod);
  disposes.push(() => {
    podBodyGeo.dispose();
    podDomeGeo.dispose();
    podMat.dispose();
    podWireGeo.dispose();
    podWireMat.dispose();
  });

  const rackGeo = new THREE.BoxGeometry(0.65, 2.8, 0.38);
  const rackMat = new THREE.MeshStandardMaterial({
    color: 0x050b12,
    roughness: 0.5,
    metalness: 0.82,
    emissive: color,
    emissiveIntensity: 0.08,
  });
  const rackEdgeGeo = new THREE.EdgesGeometry(rackGeo);
  const rackEdgeMat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.5,
  });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const r = 4.5;
    const rg = new THREE.Group();
    rg.add(new THREE.Mesh(rackGeo, rackMat));
    rg.add(new THREE.LineSegments(rackEdgeGeo, rackEdgeMat));
    rg.position.set(Math.cos(angle) * r, -1.4, Math.sin(angle) * r);
    rg.rotation.y = angle;
    group.add(rg);
  }
  disposes.push(() => {
    rackGeo.dispose();
    rackMat.dispose();
    rackEdgeGeo.dispose();
    rackEdgeMat.dispose();
  });

  const cageGeo = new THREE.IcosahedronGeometry(3.6, 1);
  const cageMat = new THREE.MeshBasicMaterial({
    color,
    wireframe: true,
    transparent: true,
    opacity: 0.07,
  });
  group.add(new THREE.Mesh(cageGeo, cageMat));
  disposes.push(() => {
    cageGeo.dispose();
    cageMat.dispose();
  });

  let t = 0;
  const update = (dt: number) => {
    t += dt;
    group.rotation.y += dt * 0.055;
    crystals.forEach((c, i) => {
      c.scale.y =
        crystalBaseScaleY[i] * (1 + Math.sin(t * 0.35 + i * 0.6) * 0.04);
    });
    podMat.emissiveIntensity = 0.14 + Math.sin(t * 1.2) * 0.08;
  };

  return { group, update, dispose: () => disposes.forEach((f) => f()) };
}

function buildHeroObject(dept: Department): HeroResult {
  const color = new THREE.Color(dept.color);
  switch (dept.code) {
    case "R&D":
      return buildRDHero(color);
    case "SEC":
      return buildSecHero(color);
    case "FIN":
      return buildFinHero(color);
    case "AI":
      return buildAIHero(color);
    case "OPS":
      return buildOpsHero(color);
    case "PR":
      return buildPRHero(color);
    case "LGL":
      return buildLegalHero(color);
    case "CSG":
      return buildColdHero(color);
    default:
      return buildRDHero(color);
  }
}

export function buildDeptRoom(
  dept: Department,
  scene: THREE.Scene,
): RoomHandle {
  const color = new THREE.Color(dept.color);
  const sceneObjects: THREE.Object3D[] = [];
  const disposeCallbacks: (() => void)[] = [];
  const updateCallbacks: ((dt: number) => void)[] = [];

  const addObj = (obj: THREE.Object3D) => {
    scene.add(obj);
    sceneObjects.push(obj);
  };

  const ambient = new THREE.AmbientLight(0x050510, 1.5);
  addObj(ambient);

  const deptLight = new THREE.PointLight(dept.color, 5.0, 28);
  deptLight.position.set(0, 4, 0);
  addObj(deptLight);

  const rimLight = new THREE.DirectionalLight(dept.color, 1.2);
  rimLight.position.set(-4, 3, -6);
  addObj(rimLight);

  const fillLight = new THREE.PointLight(0xffffff, 0.35, 40);
  fillLight.position.set(3, -2, 6);
  addObj(fillLight);

  const floorGeo = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x040912,
    roughness: 0.88,
    metalness: 0.35,
    emissive: color,
    emissiveIntensity: 0.02,
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.22;
  addObj(floor);
  disposeCallbacks.push(() => {
    floorGeo.dispose();
    floorMat.dispose();
  });

  const grid = new THREE.GridHelper(44, 44, dept.color, dept.color);
  const gridMats = Array.isArray(grid.material)
    ? grid.material
    : [grid.material];
  gridMats.forEach((m) => {
    const lm = m as THREE.LineBasicMaterial;
    lm.opacity = 0.14;
    lm.transparent = true;
  });
  grid.position.y = -3.2;
  addObj(grid);

  const stripMat = new THREE.MeshBasicMaterial({
    color: dept.color,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const stripH = new THREE.BoxGeometry(30, 0.04, 0.055);
  const stripV = new THREE.BoxGeometry(0.055, 0.04, 30);
  for (const [geo, x, z] of [
    [stripH, 0, -15],
    [stripH, 0, 15],
    [stripV, -15, 0],
    [stripV, 15, 0],
  ] as [THREE.BufferGeometry, number, number][]) {
    const s = new THREE.Mesh(geo, stripMat);
    s.position.set(x, -3.2, z);
    addObj(s);
  }
  disposeCallbacks.push(() => {
    stripH.dispose();
    stripV.dispose();
    stripMat.dispose();
  });

  const pillarGeo = new THREE.BoxGeometry(0.22, 9, 0.22);
  const pillarMat = new THREE.MeshStandardMaterial({
    color: 0x080e18,
    roughness: 0.55,
    metalness: 0.75,
    emissive: color,
    emissiveIntensity: 0.055,
  });
  const accentGeo = new THREE.BoxGeometry(0.28, 0.07, 0.28);
  const accentMat = new THREE.MeshBasicMaterial({
    color: dept.color,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const [px, pz] of [
    [-11, -11],
    [11, -11],
    [-11, 11],
    [11, 11],
  ] as [number, number][]) {
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(px, 1.3, pz);
    addObj(p);
    const a = new THREE.Mesh(accentGeo, accentMat);
    a.position.set(px, 6.1, pz);
    addObj(a);
  }
  disposeCallbacks.push(() => {
    pillarGeo.dispose();
    pillarMat.dispose();
    accentGeo.dispose();
    accentMat.dispose();
  });

  const dust = createRoomDust(scene, color);
  disposeCallbacks.push(dust.dispose);
  updateCallbacks.push(dust.update);

  const hero = buildHeroObject(dept);
  addObj(hero.group);
  disposeCallbacks.push(hero.dispose);
  updateCallbacks.push(hero.update);

  let t = 0;
  updateCallbacks.push((dt: number) => {
    t += dt;
    deptLight.intensity = 4.5 + Math.sin(t * 1.6) * 1.0;
  });

  return {
    update: (dt: number) => updateCallbacks.forEach((fn) => fn(dt)),
    dispose: () => {
      sceneObjects.forEach((obj) => scene.remove(obj));
      disposeCallbacks.forEach((fn) => fn());
    },
  };
}
