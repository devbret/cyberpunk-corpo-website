import * as THREE from "three";
import {
  createConduit,
  createHoloScreen,
  createSignage,
  createSparkBurst,
  createTickerBand,
  type HoloScreen,
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

const HEADLINES: Array<[string, string[]]> = [
  ["RECORD SAFETY QUARTER", ["ZERO INCIDENTS REPORTED", "INDEPENDENTLY VERIFIED"]],
  ["COMMUNITY FUND EXPANDS", ["LOCAL PARTNERS PRAISE ROLLOUT", "PHASE TWO APPROVED"]],
  ["CRITICS WITHDRAW CLAIMS", ["SOURCES FOUND UNRELIABLE", "MATTER CONSIDERED CLOSED"]],
  ["INNOVATION AWARD WON", ["THIRD CONSECUTIVE YEAR", "PANEL CITES VISION"]],
  ["WORKFORCE SENTIMENT HIGH", ["SURVEY PARTICIPATION 100%", "RESULTS SEALED"]],
  ["ROUTINE OPERATIONS RESUME", ["NOTHING OF NOTE OCCURRED", "PLEASE DISREGARD"]],
];

const PUSH_HEADLINES: Array<[string, string[]]> = [
  ["PUBLIC STANDS WITH US", ["OVERWHELMING SUPPORT", "ORGANIC AND UNPROMPTED"]],
  ["ALLEGATIONS UNFOUNDED", ["NO EVIDENCE EXISTS", "NEVER DID"]],
  ["A NEW ERA BEGINS", ["EVERYONE AGREES", "EVERYONE ALWAYS AGREED"]],
];

export function buildPRRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x041209, 0.07);
  const edges = lineMaterial(ctx, 0.5);
  const glow = glowMaterial(ctx, 0.9);

  const tower = ctx.add(new THREE.Group());
  tower.position.y = -3.2;

  const mast = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(0.07, 0.34, 7.4, 12)),
    body,
  );
  mast.position.y = 3.7;
  tower.add(mast);

  const braceGeo = ctx.own(new THREE.TorusGeometry(0.3, 0.014, 6, 20));
  for (let i = 0; i < 9; i++) {
    const b = new THREE.Mesh(braceGeo, glow);
    b.rotation.x = Math.PI / 2;
    b.position.y = 0.7 + i * 0.72;
    b.scale.setScalar(1 - i * 0.075);
    tower.add(b);
  }
  const guyPts: THREE.Vector3[] = [];
  for (const p of ring(3, 2.6)) {
    guyPts.push(new THREE.Vector3(p.x, 0, p.z), new THREE.Vector3(0, 6.2, 0));
  }
  tower.add(
    new THREE.LineSegments(
      ctx.own(new THREE.BufferGeometry().setFromPoints(guyPts)),
      edges,
    ),
  );

  const beacon = new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.2, 16, 12)), glow);
  beacon.position.y = 7.5;
  tower.add(beacon);
  const beaconLight = new THREE.PointLight(ctx.dept.color, 4, 20, 2);
  beaconLight.position.y = 7.5;
  tower.add(beaconLight);

  const waveGeo = ctx.own(new THREE.TorusGeometry(1, 0.02, 8, 96));
  const waves = Array.from({ length: 6 }, (_, i) => {
    const mat = ctx.own(
      new THREE.MeshBasicMaterial({
        color: ctx.color,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    const mesh = new THREE.Mesh(waveGeo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 4.3;
    ctx.add(mesh);
    return { mesh, mat, off: i / 6 };
  });

  const CROWD = 420;
  const crowdGeo = ctx.own(new THREE.CapsuleGeometry(0.075, 0.22, 4, 8));
  const crowdMat = ctx.own(
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, toneMapped: false }),
  );
  const crowd = new THREE.InstancedMesh(crowdGeo, crowdMat, CROWD);
  crowd.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  ctx.add(crowd);
  ctx.own(crowd);

  const crowdPos: THREE.Vector3[] = [];
  const opinion = new Float32Array(CROWD);
  const bob = new Float32Array(CROWD);
  for (let i = 0; i < CROWD; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = 3.2 + Math.sqrt(Math.random()) * 8.6;
    crowdPos.push(new THREE.Vector3(Math.cos(a) * r, -2.95, Math.sin(a) * r));
    opinion[i] = rnd(0.15, 0.6);
    bob[i] = rnd(0, Math.PI * 2);
  }
  const DISSENT = new THREE.Color(0xff2d6f);
  const tmpColor = new THREE.Color();
  const dummy = new THREE.Object3D();

  const screens: HoloScreen[] = [];
  const screenSlots: number[] = [];
  ring(8, 11.6, 0, Math.PI / 8).forEach((p, i) => {
    const y = 1.4 + Math.sin(i * 1.7) * 1.9;
    const s = ctx.fx(createHoloScreen({ color: ctx.color, width: 2.6, aspect: 1.6 }));
    s.object.position.set(p.x, y, p.z);
    s.object.lookAt(0, y - 0.3, 0);
    const [h, b] = HEADLINES[i % HEADLINES.length];
    s.setContent(h, b);
    screens.push(s);
    screenSlots.push(i % HEADLINES.length);

    const frame = new THREE.Mesh(ctx.own(new THREE.BoxGeometry(2.85, 1.9, 0.1)), body);
    frame.position.set(p.x, y, p.z).multiplyScalar(1.012);
    frame.position.y = y;
    frame.lookAt(0, y - 0.3, 0);
    ctx.add(frame);

    ctx.fx(
      createConduit({
        from: new THREE.Vector3(0, 3.6, 0),
        to: new THREE.Vector3(p.x * 0.94, y + 0.6, p.z * 0.94),
        color: ctx.color,
        sag: 0.5,
        speed: 0.6,
        packets: 2,
      }),
    );
  });

  const gauge = ctx.add(new THREE.Group());
  gauge.position.set(0, 5.4, -9.2);
  const gaugeArc = new THREE.Mesh(
    ctx.own(new THREE.RingGeometry(2.3, 2.55, 64, 1, Math.PI, Math.PI)),
    ctx.own(
      new THREE.MeshBasicMaterial({
        color: ctx.color,
        transparent: true,
        opacity: 0.22,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  gauge.add(gaugeArc);
  const gaugeFillMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const gaugeFill = new THREE.Mesh(
    new THREE.RingGeometry(2.3, 2.55, 64, 1, Math.PI, 0.1),
    gaugeFillMat,
  );
  gauge.add(gaugeFill);
  const needle = new THREE.Mesh(
    ctx.own(new THREE.BoxGeometry(2.2, 0.05, 0.05)),
    glow,
  );
  gauge.add(needle);
  const tickPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI + (i / 10) * Math.PI;
    tickPts.push(
      new THREE.Vector3(Math.cos(a) * 2.6, Math.sin(a) * 2.6, 0),
      new THREE.Vector3(Math.cos(a) * 2.9, Math.sin(a) * 2.9, 0),
    );
  }
  gauge.add(
    new THREE.LineSegments(
      ctx.own(new THREE.BufferGeometry().setFromPoints(tickPts)),
      lineMaterial(ctx, 0.5),
    ),
  );

  const dishes = ring(4, 11.4, -1.4, Math.PI / 5).map((p) => {
    const g = ctx.add(new THREE.Group());
    g.position.copy(p);
    g.add(
      new THREE.Mesh(ctx.own(new THREE.CylinderGeometry(0.14, 0.2, 3.2, 8)), body),
    ).position.y = -1.6;
    const head = new THREE.Group();
    g.add(head);
    const d = new THREE.Mesh(
      ctx.own(
        new THREE.SphereGeometry(0.85, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2.6),
      ),
      ctx.own(
        new THREE.MeshStandardMaterial({
          color: 0x061209,
          roughness: 0.35,
          metalness: 0.9,
          emissive: ctx.color,
          emissiveIntensity: 0.14,
          side: THREE.DoubleSide,
        }),
      ),
    );
    d.rotation.x = -Math.PI / 2;
    head.add(d);
    const rim = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(0.85, 0.022, 8, 32)),
      glow,
    );
    head.add(rim);
    return { head, phase: rnd(0, Math.PI * 2) };
  });

  const barnGeo = ctx.own(new THREE.CylinderGeometry(0.28, 0.4, 0.55, 8, 1, true));
  const lampGeo = ctx.own(new THREE.CircleGeometry(0.3, 16));
  const lampMat = glowMaterial(ctx, 0.8);
  const lamps = ring(7, 7.2, 6.0, 0.4).map((p) => {
    const g = ctx.add(new THREE.Group());
    g.position.copy(p);
    g.lookAt(0, 0, 0);
    g.add(new THREE.Mesh(barnGeo, body));
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.z = 0.2;
    g.add(lamp);
    const stalk = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6)),
      body,
    );
    stalk.position.y = 0.6;
    g.add(stalk);
    return { g, lamp, phase: rnd(0, Math.PI * 2) };
  });

  const ticker = ctx.fx(
    createTickerBand({
      text: "  BREAKING  ///  SOURCES CONFIRM  ///  EXPERTS AGREE  ///  NO COMMENT REQUESTED  ///  STORY DEVELOPING  ",
      color: ctx.color,
      radius: 12.5,
      height: 0.66,
      speed: 0.075,
      repeats: 4,
    }),
  );
  ticker.object.position.y = 3.6;

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 2.5;
    s.object.position.set(Math.cos(a) * 12.3, rnd(-1.8, 0.4), Math.sin(a) * 12.3);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 200 }));

  let sentiment = 0.5;
  let pushLevel = 0;
  let lastAlert = 0;
  let frontRadius = -1;

  ctx.tick((dt, t) => {
    waves.forEach((w) => {
      const p = ((t * 0.32 + w.off) % 1);
      const s = 0.6 + p * 11;
      w.mesh.scale.set(s, s, 1 + pushLevel * 2);
      w.mat.opacity = Math.max(0, (0.6 - p * 0.6) * (0.45 + pushLevel));
    });

    if (frontRadius >= 0) {
      frontRadius += dt * 9.5;
      if (frontRadius > 14) frontRadius = -1;
    }

    for (let i = 0; i < CROWD; i++) {
      const p = crowdPos[i];
      if (frontRadius >= 0) {
        const d = Math.hypot(p.x, p.z);
        if (Math.abs(d - frontRadius) < 0.9) {
          opinion[i] += (0.97 - opinion[i]) * 0.55;
        }
      }
      opinion[i] = Math.max(0.12, opinion[i] - dt * 0.035);

      dummy.position.set(
        p.x,
        p.y + Math.abs(Math.sin(t * 1.6 + bob[i])) * 0.06 * (0.4 + opinion[i]),
        p.z,
      );
      dummy.rotation.y = Math.atan2(-p.x, -p.z);
      dummy.rotation.z = Math.sin(t * 1.1 + bob[i]) * 0.05;
      dummy.scale.setScalar(0.85 + opinion[i] * 0.3);
      dummy.updateMatrix();
      crowd.setMatrixAt(i, dummy.matrix);

      tmpColor.copy(DISSENT).lerp(ctx.color, opinion[i]);
      tmpColor.multiplyScalar(0.5 + opinion[i] * 1.1);
      crowd.setColorAt(i, tmpColor);
    }
    crowd.instanceMatrix.needsUpdate = true;
    if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;

    let sum = 0;
    for (let i = 0; i < CROWD; i++) sum += opinion[i];
    sentiment += (sum / CROWD - sentiment) * Math.min(1, dt * 2);

    needle.rotation.z = Math.PI - sentiment * Math.PI;
    needle.position.set(
      Math.cos(Math.PI - sentiment * Math.PI) * 1.1,
      Math.sin(Math.PI - sentiment * Math.PI) * 1.1,
      0.05,
    );
    gaugeFill.geometry.dispose();
    gaugeFill.geometry = new THREE.RingGeometry(
      2.3,
      2.55,
      64,
      1,
      Math.PI,
      Math.max(0.02, sentiment * Math.PI),
    );

    (beacon.material as THREE.MeshBasicMaterial).opacity =
      0.45 + Math.sin(t * 4.2) * 0.45;
    beaconLight.intensity = 3 + Math.sin(t * 4.2) * 1.4 + pushLevel * 8;
    mast.rotation.y += dt * 0.05;

    dishes.forEach((d) => {
      d.head.lookAt(0, 4.2, 0);
      d.head.rotateX(Math.sin(t * 0.4 + d.phase) * 0.12);
    });

    lamps.forEach((l, i) => {
      (l.lamp.material as THREE.MeshBasicMaterial).opacity =
        0.55 + Math.sin(t * 2.6 + l.phase) * 0.3 + pushLevel * 0.3;
      l.g.rotation.z = Math.sin(t * 0.5 + i) * 0.1;
    });

    if (pushLevel > 0) pushLevel = Math.max(0, pushLevel - dt * 0.9);
  });

  ctx.alert((level) => {
    const s = swell(level);

    if (level > 0.5 && lastAlert <= 0.5) {
      pushLevel = 1;
      frontRadius = 0;
      sparks.fire(new THREE.Vector3(0, 4.3, 0));
      const [h, b] = PUSH_HEADLINES[(Math.random() * PUSH_HEADLINES.length) | 0];
      screens.forEach((sc) => sc.setContent(h, b));
      ticker.setText(`  ${h}  ///  ${b[0]}  ///  ${b[1]}  ///  `);
    }
    if (level < 0.2 && lastAlert >= 0.2) {
      screens.forEach((sc, i) => {
        screenSlots[i] = (screenSlots[i] + 3) % HEADLINES.length;
        const [h, b] = HEADLINES[screenSlots[i]];
        sc.setContent(h, b);
      });
      ticker.setText(
        "  BREAKING  ///  SOURCES CONFIRM  ///  EXPERTS AGREE  ///  NO COMMENT REQUESTED  ///  STORY DEVELOPING  ",
      );
    }
    gaugeFillMat.opacity = 0.85 + s * 0.15;
    lastAlert = level;
  });
}
