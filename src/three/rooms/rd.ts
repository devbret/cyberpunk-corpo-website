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

const SPECIMEN_VERT = `
  uniform float uTime;
  uniform float uAmp;
  uniform float uPhase;
  varying vec3 vNormal;
  varying float vDisp;
  void main() {
    vec3 p = position;
    float n =
      sin(p.x * 3.1 + uTime * 1.30 + uPhase) *
      cos(p.y * 2.7 - uTime * 0.90) *
      sin(p.z * 3.4 + uTime * 1.10);
    float n2 = sin(length(p) * 7.0 - uTime * 2.4) * 0.35;
    vDisp = n + n2;
    p += normal * vDisp * uAmp;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const SPECIMEN_FRAG = `
  uniform vec3  uColor;
  uniform float uHeat;
  varying vec3 vNormal;
  varying float vDisp;
  void main() {
    float rim = pow(1.0 - abs(vNormal.z), 2.2);
    vec3 col = uColor * (0.35 + rim * 1.7 + abs(vDisp) * 1.3 + uHeat);
    gl_FragColor = vec4(col, 0.62 + rim * 0.38);
  }
`;

function manipulator(
  ctx: RoomCtx,
  body: THREE.Material,
  glow: THREE.Material,
): { group: THREE.Group; pose: (reach: number, t: number, phase: number) => void } {
  const group = new THREE.Group();

  const baseGeo = ctx.own(new THREE.CylinderGeometry(0.3, 0.42, 0.34, 12));
  group.add(new THREE.Mesh(baseGeo, body));

  const shoulder = new THREE.Group();
  shoulder.position.y = 0.2;
  group.add(shoulder);

  const upperGeo = ctx.own(new THREE.BoxGeometry(0.19, 2.25, 0.19));
  const upper = new THREE.Mesh(upperGeo, body);
  upper.position.y = 1.12;
  shoulder.add(upper);

  const elbow = new THREE.Group();
  elbow.position.y = 2.25;
  shoulder.add(elbow);

  const foreGeo = ctx.own(new THREE.BoxGeometry(0.15, 1.75, 0.15));
  const fore = new THREE.Mesh(foreGeo, body);
  fore.position.y = 0.88;
  elbow.add(fore);

  const jointGeo = ctx.own(new THREE.SphereGeometry(0.15, 12, 10));
  elbow.add(new THREE.Mesh(jointGeo, glow));
  shoulder.add(new THREE.Mesh(jointGeo, glow));

  const wrist = new THREE.Group();
  wrist.position.y = 1.75;
  elbow.add(wrist);

  const clawGeo = ctx.own(new THREE.BoxGeometry(0.05, 0.42, 0.05));
  const fingers: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const f = new THREE.Mesh(clawGeo, body);
    f.position.set(Math.cos(a) * 0.13, 0.2, Math.sin(a) * 0.13);
    f.rotation.z = Math.cos(a) * 0.32;
    f.rotation.x = -Math.sin(a) * 0.32;
    wrist.add(f);
    fingers.push(f);
  }
  const tipGeo = ctx.own(new THREE.SphereGeometry(0.06, 8, 6));
  wrist.add(new THREE.Mesh(tipGeo, glow));

  const pose = (reach: number, t: number, phase: number) => {
    const idle = Math.sin(t * 0.7 + phase) * 0.12;
    shoulder.rotation.x = -0.42 - reach * 0.55 + idle;
    elbow.rotation.x = 0.95 + reach * 0.85 + idle * 0.6;
    wrist.rotation.x = -0.5 - reach * 0.3;
    group.rotation.y = Math.sin(t * 0.35 + phase) * 0.18;
    const grip = 0.3 + reach * 0.7;
    fingers.forEach((f, i) => {
      const a = (i / 3) * Math.PI * 2;
      f.rotation.z = Math.cos(a) * (0.6 - grip * 0.45);
      f.rotation.x = -Math.sin(a) * (0.6 - grip * 0.45);
    });
  };

  return { group, pose };
}

export function buildRDRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x0b0616, 0.06);
  const edges = lineMaterial(ctx, 0.55);
  const glow = glowMaterial(ctx, 0.85);

  const column = ctx.add(new THREE.Group());
  column.position.y = 0.35;

  const glassGeo = ctx.own(new THREE.CylinderGeometry(1.5, 1.5, 4.3, 40, 1, true));
  const glassMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: 0x14061f,
      emissive: ctx.color,
      emissiveIntensity: 0.14,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      roughness: 0.05,
      metalness: 0.25,
      side: THREE.DoubleSide,
    }),
  );
  column.add(new THREE.Mesh(glassGeo, glassMat));

  const collarGeo = ctx.own(new THREE.CylinderGeometry(1.68, 1.68, 0.36, 40));
  for (const y of [2.15, -2.15]) {
    const collar = new THREE.Mesh(collarGeo, body);
    collar.position.y = y;
    column.add(collar);
    const trim = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.7, 0.038, 8, 48)),
      glow,
    );
    trim.rotation.x = Math.PI / 2;
    trim.position.y = y;
    column.add(trim);
  }

  const ribGeo = ctx.own(new THREE.BoxGeometry(0.075, 4.3, 0.075));
  for (const p of ring(8, 1.55)) {
    const rib = new THREE.Mesh(ribGeo, body);
    rib.position.set(p.x, 0, p.z);
    column.add(rib);
  }

  const specimenMat = ctx.own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      vertexShader: SPECIMEN_VERT,
      fragmentShader: SPECIMEN_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uAmp: { value: 0.16 },
        uPhase: { value: 0 },
        uHeat: { value: 0 },
        uColor: { value: ctx.color.clone() },
      },
    }),
  );

  const forms = [
    ctx.own(new THREE.IcosahedronGeometry(0.92, 4)),
    ctx.own(new THREE.TorusKnotGeometry(0.62, 0.24, 128, 20)),
    ctx.own(new THREE.OctahedronGeometry(1.0, 3)),
    ctx.own(new THREE.DodecahedronGeometry(0.95, 2)),
  ];
  let formIndex = 0;
  const specimen = new THREE.Mesh(forms[0], specimenMat);
  column.add(specimen);

  const specimenLight = new THREE.PointLight(ctx.dept.color, 4.5, 12, 2);
  column.add(specimenLight);

  const gimbals: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.15 + i * 0.16, 0.022, 8, 72)),
      glow,
    );
    g.rotation.set(rnd(0, Math.PI), rnd(0, Math.PI), rnd(0, Math.PI));
    column.add(g);
    gimbals.push(g);
  }

  const cage = new THREE.Mesh(
    ctx.own(new THREE.IcosahedronGeometry(1.32, 1)),
    ctx.own(
      new THREE.MeshBasicMaterial({
        color: ctx.color,
        wireframe: true,
        transparent: true,
        opacity: 0.2,
      }),
    ),
  );
  column.add(cage);

  const arms = ring(4, 3.5, -3.05, Math.PI / 4).map((p) => {
    const m = manipulator(ctx, body, glow);
    m.group.position.copy(p);
    m.group.lookAt(0, -3.05, 0);
    m.group.rotateY(Math.PI);
    ctx.add(m.group);
    return m;
  });

  const flaskMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: ctx.color,
      emissive: ctx.color,
      emissiveIntensity: 0.45,
      transparent: true,
      opacity: 0.3,
      roughness: 0.08,
      metalness: 0.15,
      side: THREE.DoubleSide,
    }),
  );
  const flaskGeo = ctx.own(new THREE.CylinderGeometry(0.28, 0.34, 1.05, 16, 1, true));
  const flaskCapGeo = ctx.own(new THREE.SphereGeometry(0.3, 16, 10));
  const bubbleGeo = ctx.own(new THREE.SphereGeometry(0.035, 6, 5));
  const bubbles: { mesh: THREE.Mesh; speed: number; base: number }[] = [];

  ring(6, 5.6, -2.55, Math.PI / 7).forEach((p, i) => {
    const stand = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.36, 0.44, 0.6, 10)),
      body,
    );
    stand.position.set(p.x, -2.95, p.z);
    ctx.add(stand);

    const flask = new THREE.Group();
    flask.position.copy(p);
    flask.add(new THREE.Mesh(flaskGeo, flaskMat));
    const cap = new THREE.Mesh(flaskCapGeo, flaskMat);
    cap.position.y = 0.52;
    flask.add(cap);
    ctx.add(flask);

    for (let b = 0; b < 5; b++) {
      const mesh = new THREE.Mesh(bubbleGeo, glow);
      mesh.position.set(rnd(-0.16, 0.16), rnd(-0.5, 0.5), rnd(-0.16, 0.16));
      flask.add(mesh);
      bubbles.push({ mesh, speed: rnd(0.25, 0.6), base: i });
    }
  });

  const tabletGeo = ctx.own(new THREE.BoxGeometry(1.2, 0.76, 0.04));
  const tabletMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: 0x0a0316,
      emissive: ctx.color,
      emissiveIntensity: 0.32,
      transparent: true,
      opacity: 0.8,
      roughness: 0.22,
      metalness: 0.55,
    }),
  );
  const tablets = ring(7, 4.4, 0, 0.4).map((p, i) => {
    const g = panelWithEdges(ctx, tabletGeo, tabletMat, edges);
    g.position.copy(p).setY(Math.sin(i * 1.31) * 1.15);
    g.lookAt(0, g.position.y, 0);
    ctx.add(g);
    return { g, baseY: g.position.y, phase: i * 0.9 };
  });

  const door = ctx.add(new THREE.Group());
  door.position.set(0, 0.4, -13.4);

  door.add(
    new THREE.Mesh(ctx.own(new THREE.CylinderGeometry(4.4, 4.4, 0.5, 48)), body),
  );
  door.children[0].rotation.x = Math.PI / 2;

  const lockRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.5 + i * 0.95, 0.075, 10, 64)),
      glow,
    );
    r.position.z = 0.3;
    door.add(r);
    lockRings.push(r);
  }
  const boltGeo = ctx.own(new THREE.BoxGeometry(0.28, 0.9, 0.3));
  const bolts: THREE.Mesh[] = [];
  ring(8, 3.7).forEach((p) => {
    const bolt = new THREE.Mesh(boltGeo, body);
    bolt.position.set(p.x, p.z, 0.35);
    bolt.lookAt(0, 0, 0.35);
    bolt.rotateX(Math.PI / 2);
    door.add(bolt);
    bolts.push(bolt);
  });
  const doorSign = ctx.fx(createSignage("VAULT-7", ctx.color, 2.2), door);
  doorSign.object.position.set(0, 0, 0.42);

  const railGeo = ctx.own(new THREE.BoxGeometry(22, 0.16, 0.16));
  for (const x of [-3.4, 3.4]) {
    const rail = new THREE.Mesh(railGeo, body);
    rail.position.set(0, 6.4, x);
    rail.rotation.y = Math.PI / 2;
    ctx.add(rail);
  }
  const carriage = ctx.add(new THREE.Group());
  carriage.position.y = 6.2;
  carriage.add(
    new THREE.Mesh(ctx.own(new THREE.BoxGeometry(1.3, 0.34, 7.2)), body),
  );
  const hook = new THREE.Mesh(
    ctx.own(new THREE.ConeGeometry(0.14, 0.44, 8)),
    glow,
  );
  hook.position.y = -1.5;
  carriage.add(hook);
  const cableGeo = ctx.own(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1.4, 0),
    ]),
  );
  carriage.add(new THREE.Line(cableGeo, edges));

  const scrapMat = ctx.own(
    new THREE.MeshStandardMaterial({
      color: 0x120a1c,
      roughness: 0.7,
      metalness: 0.6,
      emissive: ctx.color,
      emissiveIntensity: 0.14,
    }),
  );
  const scrapGeos = [
    ctx.own(new THREE.TetrahedronGeometry(0.3)),
    ctx.own(new THREE.OctahedronGeometry(0.26)),
    ctx.own(new THREE.IcosahedronGeometry(0.22)),
  ];
  for (let i = 0; i < 26; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = rnd(6.5, 12.5);
    const s = new THREE.Mesh(scrapGeos[i % scrapGeos.length], scrapMat);
    s.position.set(Math.cos(a) * r, -3.05, Math.sin(a) * r);
    s.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
    s.scale.setScalar(rnd(0.6, 1.5));
    ctx.add(s);
  }

  ctx.fx(
    createLightShaft({ color: ctx.color, height: 7.2, radius: 2.9 }),
  ).object.position.y = 3.4;

  for (const p of ring(4, 1.7, 0, Math.PI / 4)) {
    ctx.fx(
      createConduit({
        from: new THREE.Vector3(p.x, 2.6, p.z),
        to: new THREE.Vector3(p.x * 3.2, 6.2, p.z * 3.2),
        color: ctx.color,
        sag: 0.4,
        speed: 0.42,
        packets: 3,
      }),
    );
  }

  const rackGeo = ctx.own(new THREE.BoxGeometry(0.9, 3.0, 0.5));
  ring(4, 9.5, -1.6, Math.PI / 4).forEach((p) => {
    const rack = panelWithEdges(ctx, rackGeo, body, edges);
    rack.position.copy(p);
    rack.lookAt(0, p.y, 0);
    ctx.add(rack);
    const led = ctx.fx(
      createLedBank({ color: ctx.color, cols: 4, rows: 12, width: 0.6, height: 2.5 }),
      rack,
    );
    led.object.position.z = 0.27;
  });

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 0.6;
    s.object.position.set(Math.cos(a) * 12.2, rnd(1.2, 3.6), Math.sin(a) * 12.2);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 220 }));

  let reach = 0;
  let cyclePunch = 0;
  let lastAlert = 0;

  ctx.tick((dt, t) => {
    specimenMat.uniforms.uTime.value = t;

    specimen.rotation.y += dt * 0.4;
    specimen.rotation.x += dt * 0.17;
    const breathe = 1 + Math.sin(t * 1.6) * 0.06 + cyclePunch * 0.55;
    specimen.scale.setScalar(breathe);
    specimenLight.intensity = 3.4 + Math.sin(t * 2.3) * 1.1 + cyclePunch * 9;

    gimbals.forEach((g, i) => {
      const d = i % 2 === 0 ? 1 : -1;
      g.rotation.x += dt * 0.32 * d;
      g.rotation.y += dt * 0.24 * -d;
      g.rotation.z += dt * 0.15 * d;
    });
    cage.rotation.y -= dt * 0.1;
    cage.rotation.z += dt * 0.06;

    arms.forEach((a, i) => a.pose(reach, t, i * 1.6));

    bubbles.forEach((b) => {
      b.mesh.position.y += b.speed * dt;
      if (b.mesh.position.y > 0.5) {
        b.mesh.position.y = -0.5;
        b.mesh.position.x = rnd(-0.16, 0.16);
        b.mesh.position.z = rnd(-0.16, 0.16);
      }
      b.mesh.position.x += Math.sin(t * 3 + b.base) * 0.0009;
    });

    tablets.forEach((tb, i) => {
      tb.g.position.y = tb.baseY + Math.sin(t * 0.7 + tb.phase) * 0.24;
      tb.g.rotation.y += dt * 0.055 * (i % 2 === 0 ? 1 : -1);
    });

    lockRings.forEach((r, i) => {
      r.rotation.z += dt * (0.12 + i * 0.07) * (i % 2 === 0 ? 1 : -1);
    });
    bolts.forEach((b, i) => {
      b.position.z = 0.35 + Math.sin(t * 0.8 + i * 0.6) * 0.06;
    });

    carriage.position.x = Math.sin(t * 0.24) * 7.5;
    hook.position.y = -1.5 + Math.sin(t * 0.55) * 0.35;

    if (cyclePunch > 0) cyclePunch = Math.max(0, cyclePunch - dt * 1.6);
  });

  ctx.alert((level) => {
    const s = swell(level);
    reach = s;
    specimenMat.uniforms.uAmp.value = 0.16 + s * 0.5;
    specimenMat.uniforms.uHeat.value = s * 1.4;
    glassMat.emissiveIntensity = 0.14 + s * 0.9;

    if (level > 0.5 && lastAlert <= 0.5) {
      formIndex = (formIndex + 1) % forms.length;
      specimen.geometry = forms[formIndex];
      cyclePunch = 1;
      sparks.fire(new THREE.Vector3(0, 0.35, 0));
    }
    lastAlert = level;
  });
}
