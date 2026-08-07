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

const OCCUPANT_VERT = `
  uniform float uTime;
  uniform float uStir;
  uniform float uSeed;
  varying vec3 vNormal;
  varying float vD;
  void main() {
    vec3 p = position;
    float slow = uTime * (0.18 + uStir * 1.9);
    float w =
      sin(p.x * 2.6 + slow + uSeed) *
      sin(p.y * 3.1 - slow * 0.8) *
      sin(p.z * 2.3 + slow * 1.2);
    vD = w;
    p += normal * w * (0.06 + uStir * 0.42);
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const OCCUPANT_FRAG = `
  uniform vec3  uColor;
  uniform float uStir;
  varying vec3 vNormal;
  varying float vD;
  void main() {
    float rim = pow(1.0 - abs(vNormal.z), 2.4);
    vec3 warm = vec3(1.0, 0.35, 0.42);
    vec3 col = mix(uColor, warm, uStir * 0.7) * (0.22 + rim * 1.4 + abs(vD) * 0.7 + uStir);
    gl_FragColor = vec4(col, 0.35 + rim * 0.45 + uStir * 0.25);
  }
`;

const FROST_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uThaw;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
               mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }

  void main() {
    float n = noise(vUv * 14.0 + uTime * 0.02) * 0.6
            + noise(vUv * 34.0 - uTime * 0.01) * 0.4;
    float crystal = smoothstep(0.52, 0.86, n);
    float melt = smoothstep(uThaw * 1.3, uThaw * 1.3 + 0.35, vUv.y);
    float a = crystal * 0.24 * melt;
    vec3 rime = mix(vec3(0.62, 0.78, 0.95), uColor, 0.55);
    gl_FragColor = vec4(rime * (0.3 + crystal * 0.45), a);
  }
`;

const PLAIN_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function buildColdRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x050d18, 0.06);
  const edges = lineMaterial(ctx, 0.45);
  const glow = glowMaterial(ctx, 0.8);

  const podGlassMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: 0x061420,
      roughness: 0.06,
      metalness: 0.2,
      emissive: ctx.color,
      emissiveIntensity: 0.1,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      clearcoat: 1,
      side: THREE.DoubleSide,
    }),
  );
  const podShellGeo = ctx.own(new THREE.CylinderGeometry(0.92, 0.92, 3.0, 28, 1, true));
  const podDomeGeo = ctx.own(
    new THREE.SphereGeometry(0.92, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2),
  );
  const collarGeo = ctx.own(new THREE.CylinderGeometry(1.02, 1.02, 0.28, 28));
  const frostGeo = ctx.own(new THREE.CylinderGeometry(0.94, 0.94, 3.0, 28, 1, true));
  const occupantGeo = ctx.own(new THREE.IcosahedronGeometry(0.5, 4));

  type Pod = {
    group: THREE.Group;
    occupantMat: THREE.ShaderMaterial;
    frostMat: THREE.ShaderMaterial;
    light: THREE.PointLight;
    occupant: THREE.Mesh;
    seed: number;
  };

  const makePod = (scale: number, seed: number): Pod => {
    const group = new THREE.Group();
    group.scale.setScalar(scale);

    group.add(new THREE.Mesh(podShellGeo, podGlassMat));
    const dome = new THREE.Mesh(podDomeGeo, podGlassMat);
    dome.position.y = 1.5;
    group.add(dome);
    const base = new THREE.Mesh(podDomeGeo, podGlassMat);
    base.position.y = -1.5;
    base.rotation.x = Math.PI;
    group.add(base);

    for (const y of [1.5, -1.5]) {
      const collar = new THREE.Mesh(collarGeo, body);
      collar.position.y = y;
      group.add(collar);
      const trim = new THREE.Mesh(
        ctx.own(new THREE.TorusGeometry(1.04, 0.025, 8, 36)),
        glow,
      );
      trim.rotation.x = Math.PI / 2;
      trim.position.y = y;
      group.add(trim);
    }

    const ribGeo = ctx.own(new THREE.BoxGeometry(0.05, 3.0, 0.05));
    for (const p of ring(6, 0.95)) {
      const rib = new THREE.Mesh(ribGeo, body);
      rib.position.set(p.x, 0, p.z);
      group.add(rib);
    }

    const frostMat = ctx.own(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        vertexShader: PLAIN_VERT,
        fragmentShader: FROST_FRAG,
        uniforms: {
          uColor: { value: ctx.color.clone() },
          uTime: { value: rnd(0, 100) },
          uThaw: { value: 0 },
        },
      }),
    );
    group.add(new THREE.Mesh(frostGeo, frostMat));

    const occupantMat = ctx.own(
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        vertexShader: OCCUPANT_VERT,
        fragmentShader: OCCUPANT_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uStir: { value: 0 },
          uSeed: { value: seed },
          uColor: { value: ctx.color.clone() },
        },
      }),
    );
    const occupant = new THREE.Mesh(occupantGeo, occupantMat);
    group.add(occupant);

    const light = new THREE.PointLight(ctx.dept.color, 1.6, 9, 2);
    group.add(light);

    return { group, occupantMat, frostMat, light, occupant, seed };
  };

  const primary = makePod(1.55, 0);
  primary.group.position.y = 0.2;
  ctx.add(primary.group);

  const cageMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      wireframe: true,
      transparent: true,
      opacity: 0.14,
    }),
  );
  const cage = new THREE.Mesh(ctx.own(new THREE.IcosahedronGeometry(3.1, 2)), cageMat);
  cage.position.y = 0.2;
  ctx.add(cage);

  const restraints: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(2.5 + i * 0.14, 0.03, 8, 72)),
      glow,
    );
    r.rotation.set((i * Math.PI) / 4, i * 0.5, 0);
    r.position.y = 0.2;
    ctx.add(r);
    restraints.push(r);
  }

  const secondary = ring(6, 6.9, -1.0, Math.PI / 6).map((p, i) => {
    const pod = makePod(0.86, i + 1);
    pod.group.position.copy(p);
    ctx.add(pod.group);

    const base = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(1.05, 1.3, 0.5, 20)),
      body,
    );
    base.position.set(p.x, -2.85, p.z);
    ctx.add(base);

    ctx.fx(
      createConduit({
        from: new THREE.Vector3(p.x, -2.6, p.z),
        to: new THREE.Vector3(p.x * 0.14, -2.9, p.z * 0.14),
        color: ctx.color,
        sag: 0.35,
        speed: 0.16,
        packets: 1,
      }),
    );
    ctx.fx(
      createConduit({
        from: new THREE.Vector3(p.x, 1.5, p.z),
        to: new THREE.Vector3(p.x * 1.35, 5.6, p.z * 1.35),
        color: ctx.color,
        sag: 0.3,
        speed: 0.2,
        packets: 2,
      }),
    );

    const plate = ctx.fx(createSignage(`POD 0${i + 1}`, ctx.color, 0.9));
    plate.object.position.set(p.x * 1.16, -1.9, p.z * 1.16);
    plate.object.lookAt(0, -1.9, 0);
    return pod;
  });

  const allPods = [primary, ...secondary];

  const crystalGeo = ctx.own(new THREE.OctahedronGeometry(0.34, 0));
  const crystalMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: ctx.color,
      emissive: ctx.color,
      emissiveIntensity: 0.2,
      transparent: true,
      opacity: 0.42,
      roughness: 0.06,
      metalness: 0.25,
      transmission: 0.5,
      clearcoat: 1,
      side: THREE.DoubleSide,
    }),
  );
  const crystals: { mesh: THREE.Mesh; baseY: number; phase: number }[] = [];
  for (let i = 0; i < 54; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = 3.4 + Math.random() * 8.4;
    const m = new THREE.Mesh(crystalGeo, crystalMat);
    const sy = rnd(1.2, 3.4);
    m.position.set(Math.cos(a) * r, -3.05 + sy * 0.16, Math.sin(a) * r);
    m.scale.set(rnd(0.3, 0.7), sy, rnd(0.3, 0.7));
    m.rotation.set(rnd(-0.25, 0.25), rnd(0, Math.PI), rnd(-0.25, 0.25));
    ctx.add(m);
    crystals.push({ mesh: m, baseY: sy, phase: rnd(0, Math.PI * 2) });
  }
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = 4.5 + Math.random() * 7.5;
    const m = new THREE.Mesh(crystalGeo, crystalMat);
    m.position.set(Math.cos(a) * r, rnd(4.4, 6.4), Math.sin(a) * r);
    m.scale.set(rnd(0.25, 0.5), rnd(1.4, 3.2), rnd(0.25, 0.5));
    m.rotation.z = Math.PI;
    ctx.add(m);
  }

  const rackGeo = ctx.own(new THREE.BoxGeometry(1.1, 3.6, 0.62));
  ring(6, 11.9, -1.2, Math.PI / 6).forEach((p, i) => {
    const rack = panelWithEdges(ctx, rackGeo, body, edges);
    rack.position.copy(p);
    rack.lookAt(0, p.y, 0);
    ctx.add(rack);

    const led = ctx.fx(
      createLedBank({ color: ctx.color, cols: 5, rows: 16, width: 0.82, height: 3.2 }),
      rack,
    );
    led.object.position.z = 0.33;

    if (i % 2 === 0) {
      const frost = new THREE.Mesh(
        ctx.own(new THREE.PlaneGeometry(1.1, 3.6)),
        ctx.own(
          new THREE.ShaderMaterial({
            transparent: true,
            depthWrite: false,
            vertexShader: PLAIN_VERT,
            fragmentShader: FROST_FRAG,
            uniforms: {
              uColor: { value: ctx.color.clone() },
              uTime: { value: rnd(0, 50) },
              uThaw: { value: 0 },
            },
          }),
        ),
      );
      frost.position.z = 0.35;
      rack.add(frost);
    }
  });

  const fogTex = (() => {
    const s = 256;
    const c = document.createElement("canvas");
    c.width = c.height = s;
    const g = c.getContext("2d")!;
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, "rgba(255,255,255,0.30)");
    grd.addColorStop(0.55, "rgba(255,255,255,0.10)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    return ctx.own(tex);
  })();

  const fogMat = ctx.own(
    new THREE.MeshBasicMaterial({
      map: fogTex,
      color: ctx.color,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  const fogGeo = ctx.own(new THREE.PlaneGeometry(15, 15));
  const fogLayers = Array.from({ length: 5 }, (_, i) => {
    const m = new THREE.Mesh(fogGeo, fogMat);
    m.rotation.x = -Math.PI / 2;
    m.position.y = -2.95 + i * 0.34;
    m.rotation.z = rnd(0, Math.PI);
    ctx.add(m);
    return { m, spin: rnd(-0.05, 0.05), phase: rnd(0, Math.PI * 2) };
  });

  const FALL = 420;
  const fPos = new Float32Array(FALL * 3);
  const fSpeed = new Float32Array(FALL);
  for (let i = 0; i < FALL; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 12;
    fPos[i * 3] = Math.cos(a) * r;
    fPos[i * 3 + 1] = rnd(-3, 7);
    fPos[i * 3 + 2] = Math.sin(a) * r;
    fSpeed[i] = rnd(0.18, 0.7);
  }
  const fallGeo = ctx.own(new THREE.BufferGeometry());
  fallGeo.setAttribute("position", new THREE.BufferAttribute(fPos, 3));
  const fall = new THREE.Points(
    fallGeo,
    ctx.own(
      new THREE.PointsMaterial({
        color: 0xcfe8ff,
        size: 0.055,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  fall.frustumCulled = false;
  ctx.add(fall);

  ctx.fx(createLightShaft({ color: ctx.color, height: 8, radius: 3.0 })).object.position.y =
    4.0;

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 0.35;
    s.object.position.set(Math.cos(a) * 12.3, rnd(1.4, 3.8), Math.sin(a) * 12.3);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(
    createSparkBurst({ color: new THREE.Color(0xbfe4ff), count: 240, speed: 4 }),
  );

  let stir = 0;
  let lastAlert = 0;

  ctx.tick((dt, t) => {
    allPods.forEach((pod, i) => {
      pod.occupantMat.uniforms.uTime.value = t;
      pod.frostMat.uniforms.uTime.value += dt;
      pod.occupant.rotation.y += dt * (0.05 + (i === 0 ? stir * 1.4 : 0));
      pod.occupant.rotation.x += dt * 0.02;
      const localStir = i === 0 ? stir : stir * 0.16;
      pod.occupantMat.uniforms.uStir.value = localStir;
      pod.frostMat.uniforms.uThaw.value = localStir * 0.75;
      pod.occupant.scale.setScalar(1 + localStir * 0.5 + Math.sin(t * 0.5 + i) * 0.02);
      pod.light.intensity = 1.4 + Math.sin(t * 0.8 + i * 1.3) * 0.35 + localStir * 6;
      pod.group.rotation.y += dt * 0.03;
    });

    cage.rotation.y += dt * 0.04;
    cage.rotation.x -= dt * 0.02;
    restraints.forEach((r, i) => {
      r.rotation.z += dt * 0.06 * (i % 2 === 0 ? 1 : -1) * (1 + stir * 4);
      r.scale.setScalar(1 + stir * 0.09 * Math.sin(t * 14 + i));
    });

    crystals.forEach((c, i) => {
      c.mesh.scale.y = c.baseY * (1 + Math.sin(t * 0.28 + c.phase) * 0.035 - stir * 0.12);
      if (stir > 0.6 && i % 7 === 0) {
        c.mesh.rotation.z = Math.sin(t * 22 + i) * 0.02;
      }
    });

    fogLayers.forEach((f, i) => {
      f.m.rotation.z += f.spin * dt;
      f.m.position.y = -2.95 + i * 0.34 + Math.sin(t * 0.24 + f.phase) * 0.12;
    });
    fogMat.opacity = 0.3 - stir * 0.16;

    const arr = (fallGeo.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    for (let i = 0; i < FALL; i++) {
      arr[i * 3 + 1] -= fSpeed[i] * dt * (1 + stir * 3);
      arr[i * 3] += Math.sin(t * 0.4 + i) * 0.002;
      if (arr[i * 3 + 1] < -3.05) arr[i * 3 + 1] = 7;
    }
    (fallGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });

  ctx.alert((level) => {
    const s = swell(level);
    stir = s;
    cageMat.opacity = 0.14 + s * 0.4;
    crystalMat.emissiveIntensity = 0.2 + s * 0.5;

    if (level > 0.5 && lastAlert <= 0.5) {
      sparks.fire(new THREE.Vector3(0, 0.2, 0));
    }
    lastAlert = level;
  });
}
