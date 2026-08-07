import * as THREE from "three";
import {
  createConduit,
  createHoloScreen,
  createLedBank,
  createSignage,
  createSparkBurst,
  type Fx,
} from "../roomFx";
import {
  glowMaterial,
  lineMaterial,
  ring,
  rnd,
  structMaterial,
  swell,
  type RoomCtx,
} from "./context";

const TERRAIN_VERT = `
  varying vec2 vUv;
  varying vec3 vPos;
  void main() {
    vUv = uv;
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const TERRAIN_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uAlert;
  varying vec2 vUv;
  varying vec3 vPos;

  void main() {
    float scan = fract(uTime * 0.16);
    float d = abs(vUv.y - scan);
    float line = exp(-d * 60.0);

    float contour = abs(fract(vPos.z * 1.6) - 0.5);
    float band = smoothstep(0.06, 0.0, contour);

    float a = 0.14 + band * 0.3 + line * 0.9;
    gl_FragColor = vec4(uColor * (0.7 + line * 2.4 + uAlert), a * (0.6 + uAlert * 0.5));
  }
`;

export function buildOpsRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x0c1204, 0.07);
  const edges = lineMaterial(ctx, 0.5);
  const glow = glowMaterial(ctx, 0.9);

  const table = ctx.add(new THREE.Group());
  table.position.y = -2.2;

  const rimGeo = ctx.own(new THREE.CylinderGeometry(7.3, 7.6, 0.42, 48));
  const rim = new THREE.Mesh(rimGeo, body);
  rim.position.y = -0.34;
  table.add(rim);
  const rimTrim = new THREE.Mesh(
    ctx.own(new THREE.TorusGeometry(7.32, 0.05, 8, 96)),
    glow,
  );
  rimTrim.rotation.x = Math.PI / 2;
  rimTrim.position.y = -0.12;
  table.add(rimTrim);

  const legGeo = ctx.own(new THREE.CylinderGeometry(0.16, 0.22, 0.9, 8));
  for (const p of ring(6, 6.4)) {
    const leg = new THREE.Mesh(legGeo, body);
    leg.position.set(p.x, -0.98, p.z);
    table.add(leg);
  }

  const terrainGeo = ctx.own(new THREE.PlaneGeometry(14, 14, 56, 56));
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const posArr = posAttr.array as Float32Array;
  for (let i = 0; i < posAttr.count; i++) {
    const x = posArr[i * 3];
    const y = posArr[i * 3 + 1];
    const d = Math.hypot(x, y);
    posArr[i * 3 + 2] =
      (Math.sin(x * 0.52) * Math.cos(y * 0.46) * 1.25 +
        Math.sin(x * 0.19 + y * 0.23) * 0.7) *
      Math.max(0, 1 - d / 7.4);
  }
  posAttr.needsUpdate = true;
  terrainGeo.computeVertexNormals();

  const terrainMat = ctx.own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      wireframe: true,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: TERRAIN_VERT,
      fragmentShader: TERRAIN_FRAG,
      uniforms: {
        uColor: { value: ctx.color.clone() },
        uTime: { value: 0 },
        uAlert: { value: 0 },
      },
    }),
  );
  const terrain = new THREE.Mesh(terrainGeo, terrainMat);
  terrain.rotation.x = -Math.PI / 2;
  table.add(terrain);

  const SITES = 7;
  const sites = ring(SITES, 4.9, 0, 0.4).map((p, i) => {
    const h = Math.sin(p.x * 0.52) * Math.cos(p.z * 0.46) * 1.25;
    return new THREE.Vector3(p.x, h + 0.2, p.z).add(
      new THREE.Vector3(rnd(-0.5, 0.5), 0, rnd(-0.5, 0.5)).multiplyScalar(i % 2),
    );
  });

  const markerGeo = ctx.own(new THREE.ConeGeometry(0.16, 0.62, 6));
  const haloGeo = ctx.own(new THREE.RingGeometry(0.3, 0.4, 24));
  const markers = sites.map((p) => {
    const g = new THREE.Group();
    g.position.copy(p);
    const cone = new THREE.Mesh(markerGeo, glow);
    cone.position.y = 0.5;
    g.add(cone);
    const halo = new THREE.Mesh(haloGeo, glow);
    halo.rotation.x = -Math.PI / 2;
    g.add(halo);
    const beam = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.035, 0.035, 2.4, 6)),
      glow,
    );
    beam.position.y = 1.4;
    g.add(beam);
    table.add(g);
    return { g, halo, beam, phase: rnd(0, Math.PI * 2), hot: 0 };
  });

  const routes: Fx[] = [];
  for (let i = 0; i < SITES; i++) {
    const a = sites[i];
    const b = sites[(i + 1) % SITES];
    routes.push(
      ctx.fx(
        createConduit({
          from: a.clone(),
          to: b.clone(),
          color: ctx.color,
          sag: -1.5,
          radius: 0.022,
          speed: 0.28,
          packets: 2,
        }),
        table,
      ),
    );
  }
  for (let i = 0; i < 3; i++) {
    routes.push(
      ctx.fx(
        createConduit({
          from: sites[i].clone(),
          to: sites[(i + 3) % SITES].clone(),
          color: ctx.color,
          sag: -2.6,
          radius: 0.018,
          speed: 0.2,
          packets: 3,
        }),
        table,
      ),
    );
  }

  const hullGeo = ctx.own(new THREE.ConeGeometry(0.14, 0.62, 6));
  const wingGeo = ctx.own(new THREE.BoxGeometry(0.62, 0.03, 0.16));
  const dropships = Array.from({ length: 5 }, (_, i) => {
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, body);
    hull.rotation.x = Math.PI / 2;
    g.add(hull);
    const wing = new THREE.Mesh(wingGeo, body);
    g.add(wing);
    const engine = new THREE.Mesh(
      ctx.own(new THREE.SphereGeometry(0.075, 8, 6)),
      glow,
    );
    engine.position.z = -0.34;
    g.add(engine);
    table.add(g);

    const curve = new THREE.CatmullRomCurve3(
      [
        sites[i % SITES],
        sites[(i + 2) % SITES].clone().add(new THREE.Vector3(0, 2.4, 0)),
        sites[(i + 4) % SITES],
        sites[(i + 5) % SITES].clone().add(new THREE.Vector3(0, 1.8, 0)),
      ],
      true,
    );
    return { g, engine, curve, p: rnd(0, 1), speed: rnd(0.05, 0.1) };
  });

  const display = ctx.add(new THREE.Group());
  display.position.y = 2.6;
  const dispMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: ctx.color,
      emissive: ctx.color,
      emissiveIntensity: 0.42,
      transparent: true,
      opacity: 0.4,
      roughness: 0.12,
      metalness: 0.55,
    }),
  );
  const dispGeo = ctx.own(new THREE.OctahedronGeometry(1.0, 0));
  display.add(new THREE.Mesh(dispGeo, dispMat));
  display.add(
    new THREE.LineSegments(ctx.own(new THREE.EdgesGeometry(dispGeo)), edges),
  );
  const dispRings: THREE.Mesh[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.35 + i * 0.2, 0.014, 6, 56)),
      glow,
    );
    r.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3));
    display.add(r);
    dispRings.push(r);
  }
  const dispLight = new THREE.PointLight(ctx.dept.color, 3.4, 14, 2);
  display.add(dispLight);

  const dishPivot = ctx.add(new THREE.Group());
  dishPivot.position.set(-9.4, 1.2, -6.2);
  const dishArm = new THREE.Group();
  dishArm.rotation.x = -0.5;
  dishPivot.add(dishArm);
  const dish = new THREE.Mesh(
    ctx.own(new THREE.SphereGeometry(1.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.4)),
    ctx.own(
      new THREE.MeshStandardMaterial({
        color: 0x0d1206,
        roughness: 0.4,
        metalness: 0.85,
        emissive: ctx.color,
        emissiveIntensity: 0.12,
        side: THREE.DoubleSide,
      }),
    ),
  );
  dish.rotation.x = -Math.PI / 2;
  dishArm.add(dish);
  dishArm.add(
    new THREE.Mesh(ctx.own(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6)), body),
  );
  const feed = new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.09, 8, 6)), glow);
  feed.position.y = 0.55;
  dishArm.add(feed);
  dishPivot.add(
    new THREE.Mesh(ctx.own(new THREE.CylinderGeometry(0.16, 0.24, 4.2, 8)), body),
  ).position.y = -2.1;

  const bunkerMat = ctx.own(
    new THREE.MeshStandardMaterial({
      color: 0x0a0f05,
      roughness: 0.72,
      metalness: 0.5,
      emissive: ctx.color,
      emissiveIntensity: 0.08,
    }),
  );
  const beaconMat = glowMaterial(ctx, 0.9);
  const beacons: THREE.Mesh[] = [];
  ring(5, 11.2, -3.05, 0.7).forEach((p, i) => {
    const g = ctx.add(new THREE.Group());
    g.position.copy(p);
    g.lookAt(0, p.y, 0);

    const w = rnd(1.4, 2.4);
    g.add(new THREE.Mesh(ctx.own(new THREE.BoxGeometry(w, 0.62, 1.0)), bunkerMat)).position.y = 0.31;
    g.add(
      new THREE.Mesh(ctx.own(new THREE.BoxGeometry(w * 0.55, 0.34, 0.7)), bunkerMat),
    ).position.y = 0.79;

    const bagGeo = ctx.own(new THREE.SphereGeometry(0.17, 8, 6));
    for (let b = 0; b < 9; b++) {
      const bag = new THREE.Mesh(bagGeo, bunkerMat);
      bag.position.set(-w / 2 + (b / 8) * w, 0.1, 0.62);
      bag.scale.set(1, 0.7, 1.2);
      g.add(bag);
    }

    const beacon = new THREE.Mesh(
      ctx.own(new THREE.SphereGeometry(0.09, 8, 6)),
      beaconMat,
    );
    beacon.position.set(0, 1.05, 0);
    g.add(beacon);
    beacons.push(beacon);

    const mast = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 6)),
      body,
    );
    mast.position.set(w * 0.4, 1.5, 0);
    g.add(mast);

    if (i % 2 === 0) {
      const led = ctx.fx(
        createLedBank({ color: ctx.color, cols: 3, rows: 6, width: 0.5, height: 0.4 }),
        g,
      );
      led.object.position.set(0, 0.5, 0.51);
    }
  });

  const boards = ring(3, 9.8, 3.4, Math.PI * 0.55).map((p, i) => {
    const s = ctx.fx(createHoloScreen({ color: ctx.color, width: 2.8, aspect: 1.5 }));
    s.object.position.copy(p);
    s.object.lookAt(0, p.y - 0.8, 0);
    s.setContent(["LANE STATUS", "ASSET ROSTER", "THEATRE MAP"][i], [
      "ALL LANES NOMINAL",
      "NO FLAG FLOWN",
    ]);
    const frame = new THREE.Mesh(ctx.own(new THREE.BoxGeometry(3.05, 2.15, 0.12)), body);
    frame.position.copy(p).multiplyScalar(1.02);
    frame.lookAt(0, p.y - 0.8, 0);
    ctx.add(frame);
    return s;
  });

  const DUST = 340;
  const dPos = new Float32Array(DUST * 3);
  const dVel = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 12;
    dPos[i * 3] = Math.cos(a) * r;
    dPos[i * 3 + 1] = rnd(-3, 5);
    dPos[i * 3 + 2] = Math.sin(a) * r;
    dVel[i * 3] = rnd(0.3, 1.1);
    dVel[i * 3 + 1] = rnd(-0.05, 0.16);
    dVel[i * 3 + 2] = rnd(-0.25, 0.25);
  }
  const dustGeo = ctx.own(new THREE.BufferGeometry());
  dustGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(
    dustGeo,
    ctx.own(
      new THREE.PointsMaterial({
        color: ctx.color,
        size: 0.06,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  dust.frustumCulled = false;
  ctx.add(dust);

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 1.9;
    s.object.position.set(Math.cos(a) * 12.3, rnd(1.2, 3.4), Math.sin(a) * 12.3);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 190 }));

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  let alertLevel = 0;
  let lastAlert = 0;
  let dispatchTarget = 0;

  ctx.tick((dt, t) => {
    terrainMat.uniforms.uTime.value = t;

    markers.forEach((m, i) => {
      const live = i === dispatchTarget ? 1 : 0;
      m.hot = Math.max(0, m.hot - dt * 1.4);
      const pulse = Math.sin(t * 2.2 + m.phase) * 0.5 + 0.5;
      m.halo.scale.setScalar(1 + pulse * 0.8 + m.hot * 2.2);
      (m.halo.material as THREE.MeshBasicMaterial).opacity =
        0.25 + pulse * 0.3 + m.hot * 0.6;
      m.halo.rotation.z += dt * 0.8;
      m.beam.scale.y = 0.6 + pulse * 0.35 + live * 0.6 + m.hot;
      m.g.rotation.y += dt * 0.5;
    });

    dropships.forEach((d) => {
      d.p = (d.p + d.speed * dt * (1 + alertLevel * 1.6)) % 1;
      d.curve.getPointAt(d.p, tmp);
      d.curve.getTangentAt(d.p, tmp2);
      d.g.position.copy(tmp).add(new THREE.Vector3(0, 0.9, 0));
      d.g.lookAt(tmp.clone().add(tmp2));
      (d.engine.material as THREE.MeshBasicMaterial).opacity =
        0.6 + Math.random() * 0.4;
    });

    display.rotation.y += dt * 0.55;
    display.rotation.x = Math.sin(t * 0.4) * 0.18;
    display.position.y = 2.6 + Math.sin(t * 0.7) * 0.16;
    dispRings.forEach((r, i) => {
      r.rotation.z += dt * (0.3 + i * 0.12) * (i % 2 === 0 ? 1 : -1);
    });
    dispMat.emissiveIntensity = 0.34 + Math.sin(t * 1.9) * 0.14 + alertLevel * 0.6;
    dispLight.intensity = 3 + Math.sin(t * 2.1) * 0.9 + alertLevel * 5;

    dishPivot.rotation.y += dt * (0.42 + alertLevel * 1.2);
    dishArm.rotation.x = -0.5 + Math.sin(t * 0.33) * 0.25;
    (feed.material as THREE.MeshBasicMaterial).opacity =
      0.5 + Math.sin(t * 6) * 0.4;

    beacons.forEach((b, i) => {
      const on = Math.sin(t * (2.4 + i * 0.5)) > 0.4;
      (b.material as THREE.MeshBasicMaterial).opacity = on ? 0.95 : 0.12;
    });

    const arr = (dustGeo.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    for (let i = 0; i < DUST; i++) {
      arr[i * 3] += dVel[i * 3] * dt * (1 + alertLevel);
      arr[i * 3 + 1] += dVel[i * 3 + 1] * dt;
      arr[i * 3 + 2] += dVel[i * 3 + 2] * dt;
      if (arr[i * 3] > 12.5) arr[i * 3] = -12.5;
      if (arr[i * 3 + 1] > 5.5) arr[i * 3 + 1] = -3;
    }
    (dustGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });

  ctx.alert((level) => {
    alertLevel = swell(level);
    terrainMat.uniforms.uAlert.value = alertLevel;

    if (level > 0.5 && lastAlert <= 0.5) {
      dispatchTarget = (Math.random() * SITES) | 0;
      markers[dispatchTarget].hot = 1;
      sparks.fire(
        markers[dispatchTarget].g.position.clone().add(table.position),
      );
      boards.forEach((b, i) =>
        b.setContent(
          ["LANE HOT", "ASSETS COMMITTED", `OBJECTIVE ${dispatchTarget + 1}`][i],
          ["TASKING PUSHED", "BEACONS DARK"],
        ),
      );
    }
    if (level < 0.2 && lastAlert >= 0.2) {
      boards.forEach((b, i) =>
        b.setContent(["LANE STATUS", "ASSET ROSTER", "THEATRE MAP"][i], [
          "ALL LANES NOMINAL",
          "NO FLAG FLOWN",
        ]),
      );
    }
    lastAlert = level;
  });
}
