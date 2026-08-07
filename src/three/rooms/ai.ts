import * as THREE from "three";
import {
  createConduit,
  createLedBank,
  createLightShaft,
  createSignage,
  createSparkBurst,
} from "../roomFx";
import {
  glowMaterial,
  lineMaterial,
  panelWithEdges,
  ring,
  rnd,
  structMaterial,
  swell,
  type RoomCtx,
} from "./context";

const BRAIN_VERT = `
  uniform float uTime;
  uniform float uAmp;
  varying vec3 vNormal;
  varying float vPulse;
  void main() {
    vec3 p = position;
    float w =
      sin(p.x * 2.4 + uTime * 0.9) *
      sin(p.y * 2.9 - uTime * 1.1) *
      sin(p.z * 2.2 + uTime * 0.7);
    vPulse = w;
    p += normal * w * uAmp;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const BRAIN_FRAG = `
  uniform vec3  uColor;
  uniform float uHeat;
  varying vec3 vNormal;
  varying float vPulse;
  void main() {
    float rim = pow(1.0 - abs(vNormal.z), 2.0);
    vec3 col = uColor * (0.28 + rim * 1.5 + abs(vPulse) * 0.9 + uHeat);
    gl_FragColor = vec4(col, 0.30 + rim * 0.45);
  }
`;

const LAYER_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uIndex;
  uniform float uHeat;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
  void main() {
    vec2 cell = floor(vUv * vec2(24.0, 12.0));
    float n = hash(cell + floor(uTime * 3.0 + uIndex * 7.0));
    float act = step(0.55 - uHeat * 0.3, n);
    float edge = step(0.06, fract(vUv.x * 24.0)) * step(0.10, fract(vUv.y * 12.0));
    float a = act * edge * (0.22 + uHeat * 0.5);
    gl_FragColor = vec4(uColor * (0.7 + act * 1.6 + uHeat), a);
  }
`;

const PLAIN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

type Signal = { edge: number; p: number; speed: number; dir: number };

export function buildAIRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x03101a, 0.07);
  const edges = lineMaterial(ctx, 0.45);
  const glow = glowMaterial(ctx, 0.9);

  const brainMat = ctx.own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: BRAIN_VERT,
      fragmentShader: BRAIN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.1 },
        uHeat: { value: 0 },
        uColor: { value: ctx.color.clone() },
      },
    }),
  );

  const brain = ctx.add(new THREE.Group());
  brain.position.y = 0.5;
  const lobeGeo = ctx.own(new THREE.SphereGeometry(1, 32, 20));
  const LOBES: [number, number, number, number][] = [
    [0, 0, 0, 0.78],
    [0.5, 0.16, 0, 0.56],
    [-0.5, 0.16, 0, 0.56],
    [0.24, -0.38, 0.28, 0.46],
    [-0.24, -0.38, 0.28, 0.46],
    [0, 0.28, -0.5, 0.52],
    [0, -0.24, -0.42, 0.42],
    [0, 0.52, 0.18, 0.4],
  ];
  for (const [x, y, z, r] of LOBES) {
    const m = new THREE.Mesh(lobeGeo, brainMat);
    m.position.set(x, y, z);
    m.scale.setScalar(r);
    brain.add(m);
  }

  const brainLight = new THREE.PointLight(ctx.dept.color, 4.5, 16, 2);
  brain.add(brainLight);

  const cageMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      wireframe: true,
      transparent: true,
      opacity: 0.34,
    }),
  );
  const cage = new THREE.Mesh(
    ctx.own(new THREE.IcosahedronGeometry(2.05, 1)),
    cageMat,
  );
  brain.add(cage);

  const clamps: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(2.25, 0.045, 8, 80)),
      glow,
    );
    c.rotation.set((i * Math.PI) / 3, i * 0.7, 0);
    brain.add(c);
    clamps.push(c);
  }

  const NODES = 42;
  const nodePos: THREE.Vector3[] = [];
  for (let i = 0; i < NODES; i++) {
    const phi = Math.acos(-1 + (2 * i) / NODES);
    const theta = Math.sqrt(NODES * Math.PI) * phi;
    const r = 3.6 + rnd(-0.7, 0.7);
    nodePos.push(
      new THREE.Vector3(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.sin(phi) * Math.sin(theta) * 0.72 + 0.5,
        r * Math.cos(phi),
      ),
    );
  }

  const edgeList: [number, number][] = [];
  for (let i = 0; i < NODES; i++) {
    for (let j = i + 1; j < NODES; j++) {
      if (nodePos[i].distanceTo(nodePos[j]) < 2.5) edgeList.push([i, j]);
    }
  }

  const nodeGeo = ctx.own(new THREE.SphereGeometry(0.11, 10, 8));
  const nodeMat = ctx.own(
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const nodeMesh = new THREE.InstancedMesh(nodeGeo, nodeMat, NODES);
  nodeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < NODES; i++) {
    dummy.position.copy(nodePos[i]);
    dummy.updateMatrix();
    nodeMesh.setMatrixAt(i, dummy.matrix);
    nodeMesh.setColorAt(i, ctx.color);
  }
  ctx.add(nodeMesh);
  ctx.own(nodeMesh);

  const edgePos = new Float32Array(edgeList.length * 6);
  const edgeCol = new Float32Array(edgeList.length * 6);
  edgeList.forEach(([a, b], i) => {
    nodePos[a].toArray(edgePos, i * 6);
    nodePos[b].toArray(edgePos, i * 6 + 3);
  });
  const edgeGeo = ctx.own(new THREE.BufferGeometry());
  edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
  edgeGeo.setAttribute("color", new THREE.BufferAttribute(edgeCol, 3));
  const netEdges = new THREE.LineSegments(
    edgeGeo,
    ctx.own(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  ctx.add(netEdges);

  const MAX_SIGNALS = 220;
  const sigPos = new Float32Array(MAX_SIGNALS * 3);
  const sigGeo = ctx.own(new THREE.BufferGeometry());
  sigGeo.setAttribute("position", new THREE.BufferAttribute(sigPos, 3));
  const sigMat = ctx.own(
    new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.16,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const sigPoints = new THREE.Points(sigGeo, sigMat);
  sigPoints.frustumCulled = false;
  ctx.add(sigPoints);

  const activation = new Float32Array(NODES);
  const signals: Signal[] = [];
  const adjacency: number[][] = Array.from({ length: NODES }, () => []);
  edgeList.forEach(([a, b], i) => {
    adjacency[a].push(i);
    adjacency[b].push(i);
  });

  const fireFrom = (node: number, strength: number) => {
    activation[node] = Math.min(1.6, activation[node] + strength);
    for (const e of adjacency[node]) {
      if (signals.length >= MAX_SIGNALS) return;
      if (Math.random() > 0.42 * strength) continue;
      signals.push({
        edge: e,
        p: 0,
        speed: rnd(0.7, 1.7),
        dir: edgeList[e][0] === node ? 1 : -1,
      });
    }
  };

  const layers: THREE.ShaderMaterial[] = [];
  const layerStack = ctx.add(new THREE.Group());
  layerStack.position.set(0, 0.5, -8.6);
  for (let i = 0; i < 9; i++) {
    const mat = ctx.own(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: PLAIN_VERT,
        fragmentShader: LAYER_FRAG,
        uniforms: {
          uColor: { value: ctx.color.clone() },
          uTime: { value: 0 },
          uIndex: { value: i },
          uHeat: { value: 0 },
        },
      }),
    );
    const plane = new THREE.Mesh(ctx.own(new THREE.PlaneGeometry(4.4, 2.4)), mat);
    plane.position.set(0, (i - 4) * 0.46, i * 0.14);
    plane.rotation.x = -0.42;
    layerStack.add(plane);
    layers.push(mat);
  }

  const droneGeo = ctx.own(new THREE.TetrahedronGeometry(0.17, 0));
  const droneMat = glowMaterial(ctx, 0.9);
  const drones = Array.from({ length: 14 }, (_, i) => {
    const g = ctx.add(new THREE.Group());
    const m = new THREE.Mesh(droneGeo, droneMat);
    g.add(m);
    const halo = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(0.3, 0.012, 6, 24)),
      droneMat,
    );
    g.add(halo);
    return {
      g,
      halo,
      r: rnd(5.2, 8.4),
      y: rnd(-2.2, 3.6),
      speed: rnd(0.18, 0.55) * (i % 2 === 0 ? 1 : -1),
      phase: rnd(0, Math.PI * 2),
      tilt: rnd(-0.4, 0.4),
    };
  });

  ring(6, 10.6, -1.2, Math.PI / 6).forEach((p) => {
    const pillar = panelWithEdges(
      ctx,
      ctx.own(new THREE.BoxGeometry(1.05, 4.0, 0.62)),
      body,
      edges,
    );
    pillar.position.copy(p);
    pillar.lookAt(0, p.y, 0);
    ctx.add(pillar);

    const led = ctx.fx(
      createLedBank({ color: ctx.color, cols: 6, rows: 18, width: 0.8, height: 3.5 }),
      pillar,
    );
    led.object.position.z = 0.33;

    ctx.fx(
      createConduit({
        from: new THREE.Vector3(p.x, 2.2, p.z),
        to: new THREE.Vector3(p.x * 0.18, 1.4, p.z * 0.18),
        color: ctx.color,
        sag: 0.9,
        speed: 0.55,
        packets: 4,
      }),
    );
  });

  const TOKENS = 300;
  const tokPos = new Float32Array(TOKENS * 3);
  const tokSpeed = new Float32Array(TOKENS);
  for (let i = 0; i < TOKENS; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = 4 + Math.random() * 8;
    tokPos[i * 3] = Math.cos(a) * r;
    tokPos[i * 3 + 1] = rnd(-3, 6);
    tokPos[i * 3 + 2] = Math.sin(a) * r;
    tokSpeed[i] = rnd(0.4, 1.6);
  }
  const tokGeo = ctx.own(new THREE.BufferGeometry());
  tokGeo.setAttribute("position", new THREE.BufferAttribute(tokPos, 3));
  const tokens = new THREE.Points(
    tokGeo,
    ctx.own(
      new THREE.PointsMaterial({
        color: ctx.color,
        size: 0.07,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  tokens.frustumCulled = false;
  ctx.add(tokens);

  ctx.fx(createLightShaft({ color: ctx.color, height: 8.5, radius: 3.2 })).object.position.y =
    4.2;

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 0.2;
    s.object.position.set(Math.cos(a) * 12.2, rnd(1.5, 4), Math.sin(a) * 12.2);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 240 }));

  let heat = 0;
  let fireTimer = 0;
  let lastAlert = 0;
  const tmpColor = new THREE.Color();
  const white = new THREE.Color(0xffffff);

  ctx.tick((dt, t) => {
    brainMat.uniforms.uTime.value = t;
    layers.forEach((m) => {
      m.uniforms.uTime.value = t;
      m.uniforms.uHeat.value = heat;
    });

    brain.rotation.y += dt * 0.16;
    cage.rotation.y -= dt * 0.24;
    cage.rotation.x += dt * 0.09;
    clamps.forEach((c, i) => {
      c.rotation.z += dt * 0.3 * (i % 2 === 0 ? 1 : -1);
    });
    brainLight.intensity = 3.5 + Math.sin(t * 2.2) * 1 + heat * 7;

    fireTimer += dt;
    if (fireTimer > (heat > 0.4 ? 0.05 : 0.22)) {
      fireTimer = 0;
      fireFrom((Math.random() * NODES) | 0, 0.6 + heat * 0.6);
    }

    let live = 0;
    for (let i = signals.length - 1; i >= 0; i--) {
      const s = signals[i];
      s.p += s.speed * dt * (1 + heat * 1.6);
      const [a, b] = edgeList[s.edge];
      const from = s.dir === 1 ? nodePos[a] : nodePos[b];
      const to = s.dir === 1 ? nodePos[b] : nodePos[a];

      if (s.p >= 1) {
        const dest = s.dir === 1 ? b : a;
        activation[dest] = Math.min(1.6, activation[dest] + 0.85);
        signals.splice(i, 1);
        if (Math.random() < 0.32 + heat * 0.35) fireFrom(dest, 0.5 + heat * 0.4);
        continue;
      }
      if (live < MAX_SIGNALS) {
        sigPos[live * 3] = from.x + (to.x - from.x) * s.p;
        sigPos[live * 3 + 1] = from.y + (to.y - from.y) * s.p;
        sigPos[live * 3 + 2] = from.z + (to.z - from.z) * s.p;
        live++;
      }
    }
    for (let i = live; i < MAX_SIGNALS; i++) sigPos[i * 3 + 1] = 9999;
    (sigGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    for (let i = 0; i < NODES; i++) {
      activation[i] = Math.max(0, activation[i] - dt * 1.5);
      const a = Math.min(1, activation[i]);
      tmpColor.copy(ctx.color).lerp(white, a * 0.8).multiplyScalar(0.35 + a * 1.5);
      nodeMesh.setColorAt(i, tmpColor);
      dummy.position.copy(nodePos[i]);
      dummy.scale.setScalar(1 + a * 1.7);
      dummy.updateMatrix();
      nodeMesh.setMatrixAt(i, dummy.matrix);
    }
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;

    edgeList.forEach(([a, b], i) => {
      const ea = Math.min(1, activation[a]);
      const eb = Math.min(1, activation[b]);
      const base = 0.1 + heat * 0.15;
      tmpColor.copy(ctx.color).multiplyScalar(base + ea * 1.5);
      tmpColor.toArray(edgeCol, i * 6);
      tmpColor.copy(ctx.color).multiplyScalar(base + eb * 1.5);
      tmpColor.toArray(edgeCol, i * 6 + 3);
    });
    (edgeGeo.getAttribute("color") as THREE.BufferAttribute).needsUpdate = true;

    drones.forEach((d, i) => {
      const a = t * d.speed + d.phase;
      d.g.position.set(
        Math.cos(a) * d.r,
        d.y + Math.sin(t * 0.6 + i) * 0.5,
        Math.sin(a) * d.r,
      );
      d.g.rotation.y += dt * 1.6;
      d.g.rotation.x = d.tilt;
      d.halo.rotation.z += dt * 2.2;
      d.halo.scale.setScalar(1 + heat * 0.8);
    });

    const arr = (tokGeo.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    for (let i = 0; i < TOKENS; i++) {
      arr[i * 3 + 1] += tokSpeed[i] * dt * (1 + heat);
      if (arr[i * 3 + 1] > 6.5) arr[i * 3 + 1] = -3;
    }
    (tokGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;

    layerStack.position.y = 0.5 + Math.sin(t * 0.5) * 0.14;
  });

  ctx.alert((level) => {
    const s = swell(level);
    heat = s;
    brainMat.uniforms.uHeat.value = s * 1.3;
    brainMat.uniforms.uAmp.value = 0.1 + s * 0.3;
    cageMat.opacity = 0.34 * (1 - s * 0.85) * (Math.random() < s * 0.4 ? 0.2 : 1);
    brain.scale.setScalar(1 + s * 0.28);

    if (level > 0.5 && lastAlert <= 0.5) {
      sparks.fire(new THREE.Vector3(0, 0.5, 0));
      for (let i = 0; i < 12; i++) fireFrom((Math.random() * NODES) | 0, 1.4);
    }
    lastAlert = level;
  });
}
