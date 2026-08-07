import * as THREE from "three";
import {
  createConduit,
  createHoloScreen,
  createLedBank,
  createSignage,
  createSparkBurst,
  type HoloScreen,
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

type Threat = {
  mesh: THREE.Group;
  angle: number;
  radius: number;
  height: number;
  speed: number;
  state: number;
  life: number;
  reticle: THREE.Mesh;
};

const FENCE_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uAlert;
  varying vec2 vUv;
  void main() {
    float bars = step(0.72, fract(vUv.x * 96.0));
    float fall = fract(vUv.y * 3.0 - uTime * 0.9);
    float head = exp(-fall * 6.0);
    float fade = smoothstep(1.0, 0.1, vUv.y);
    float a = bars * fade * (0.16 + head * 0.5) * (0.55 + uAlert * 1.5);
    gl_FragColor = vec4(uColor * (1.0 + head * 1.8 + uAlert), a);
  }
`;

const FENCE_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export function buildSecRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x120610, 0.06);
  const edges = lineMaterial(ctx, 0.55);
  const glow = glowMaterial(ctx, 0.9);

  const eyeRig = ctx.add(new THREE.Group());
  eyeRig.position.y = 0.4;

  const sclera = new THREE.Mesh(
    ctx.own(new THREE.SphereGeometry(1.15, 48, 32)),
    ctx.own(
      new THREE.MeshPhysicalMaterial({
        color: 0x140409,
        emissive: ctx.color,
        emissiveIntensity: 0.35,
        roughness: 0.08,
        metalness: 0.92,
        clearcoat: 1,
        clearcoatRoughness: 0.05,
      }),
    ),
  );
  eyeRig.add(sclera);

  const gaze = new THREE.Group();
  eyeRig.add(gaze);

  const irisMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  const iris = new THREE.Mesh(
    ctx.own(new THREE.RingGeometry(0.34, 0.62, 48)),
    irisMat,
  );
  iris.position.z = 1.06;
  gaze.add(iris);

  const pupil = new THREE.Mesh(
    ctx.own(new THREE.CircleGeometry(0.3, 32)),
    ctx.own(new THREE.MeshBasicMaterial({ color: 0x08010a, toneMapped: false })),
  );
  pupil.position.z = 1.07;
  gaze.add(pupil);

  const lensGlow = new THREE.Mesh(
    ctx.own(new THREE.CircleGeometry(0.9, 32)),
    ctx.own(
      new THREE.MeshBasicMaterial({
        color: ctx.color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );
  lensGlow.position.z = 1.02;
  gaze.add(lensGlow);

  const eyeLight = new THREE.PointLight(ctx.dept.color, 4, 16, 2);
  gaze.add(eyeLight);
  eyeLight.position.z = 1.4;

  const gyros: THREE.Mesh[] = [];
  for (let i = 0; i < 16; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.7 + (i % 4) * 0.22, 0.016, 6, 72)),
      glow,
    );
    r.rotation.set(rnd(0, Math.PI), rnd(0, Math.PI), rnd(0, Math.PI));
    eyeRig.add(r);
    gyros.push(r);
  }

  const radar = ctx.add(new THREE.Group());
  radar.position.y = -3.15;

  const sweepGeo = ctx.own(new THREE.CircleGeometry(12.5, 64, 0, Math.PI * 0.28));
  const sweepMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const sweep = new THREE.Mesh(sweepGeo, sweepMat);
  sweep.rotation.x = -Math.PI / 2;
  radar.add(sweep);

  for (let i = 1; i <= 4; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.RingGeometry(i * 3.1 - 0.03, i * 3.1, 96)),
      ctx.own(
        new THREE.MeshBasicMaterial({
          color: ctx.color,
          transparent: true,
          opacity: 0.16,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    r.rotation.x = -Math.PI / 2;
    radar.add(r);
  }
  const gratPts: THREE.Vector3[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    gratPts.push(
      new THREE.Vector3(0, 0.01, 0),
      new THREE.Vector3(Math.cos(a) * 12.4, 0.01, Math.sin(a) * 12.4),
    );
  }
  radar.add(
    new THREE.LineSegments(
      ctx.own(new THREE.BufferGeometry().setFromPoints(gratPts)),
      lineMaterial(ctx, 0.16),
    ),
  );

  const towerHeads: { head: THREE.Group; beam: THREE.Mesh; base: THREE.Vector3 }[] =
    [];
  const beamGeo = ctx.own(new THREE.ConeGeometry(0.5, 11, 20, 1, true));
  const beamMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );

  ring(5, 10.4, -3.1, 0.3).forEach((p) => {
    const tower = ctx.add(new THREE.Group());
    tower.position.copy(p);

    const shaft = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.09, 0.16, 5.4, 10)),
      body,
    );
    shaft.position.y = 2.7;
    tower.add(shaft);

    for (const q of ring(3, 0.9)) {
      const wire = new THREE.Line(
        ctx.own(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(q.x, 0, q.z),
            new THREE.Vector3(0, 3.4, 0),
          ]),
        ),
        edges,
      );
      tower.add(wire);
    }

    const head = new THREE.Group();
    head.position.y = 5.4;
    tower.add(head);
    head.add(new THREE.Mesh(ctx.own(new THREE.BoxGeometry(0.42, 0.3, 0.66)), body));
    const lens = new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.15, 14, 10)), glow);
    lens.position.z = 0.36;
    head.add(lens);

    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.rotation.x = Math.PI / 2;
    beam.position.z = 5.5;
    head.add(beam);

    towerHeads.push({ head, beam, base: p.clone().setY(5.4) });
  });

  const turrets: { yaw: THREE.Group; pitch: THREE.Group; muzzle: THREE.Mesh }[] = [];
  ring(4, 6.6, 4.3, Math.PI / 4).forEach((p) => {
    const mount = ctx.add(new THREE.Group());
    mount.position.copy(p);
    mount.add(new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.4, 16, 12)), body));

    const yaw = new THREE.Group();
    mount.add(yaw);
    const pitch = new THREE.Group();
    yaw.add(pitch);

    const barrel = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.075, 0.1, 1.35, 10)),
      body,
    );
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = 0.6;
    pitch.add(barrel);

    const muzzle = new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.1, 10, 8)), glow);
    muzzle.position.z = 1.28;
    pitch.add(muzzle);

    const stalk = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.055, 0.055, 1.8, 8)),
      body,
    );
    stalk.position.y = 0.9;
    mount.add(stalk);

    turrets.push({ yaw, pitch, muzzle });
  });

  const fenceMat = ctx.own(
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: FENCE_VERT,
      fragmentShader: FENCE_FRAG,
      uniforms: {
        uColor: { value: ctx.color.clone() },
        uTime: { value: 0 },
        uAlert: { value: 0 },
      },
    }),
  );
  const fence = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(13, 13, 7.6, 96, 1, true)),
    fenceMat,
  );
  fence.position.y = 0.6;
  ctx.add(fence);

  const screens: HoloScreen[] = [];
  const CAMS = ["CAM 07 // LOBBY", "CAM 22 // SUB-LEVEL", "CAM 41 // DOCK", "CAM 58 // VAULT"];
  ring(4, 8.6, 2.6, Math.PI * 0.62).forEach((p, i) => {
    const s = ctx.fx(createHoloScreen({ color: ctx.color, width: 2.5, aspect: 1.55 }));
    s.object.position.copy(p);
    s.object.lookAt(0, p.y - 0.4, 0);
    s.setContent(CAMS[i], ["MOTION: NONE", "SIGNAL: ENCRYPTED"]);
    screens.push(s);

    const frame = new THREE.Mesh(
      ctx.own(new THREE.BoxGeometry(2.75, 1.85, 0.1)),
      body,
    );
    frame.position.copy(p).multiplyScalar(1.015);
    frame.lookAt(0, p.y - 0.4, 0);
    ctx.add(frame);
  });

  const strobeMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: 0xff2040,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const strobes = ring(6, 12.2, 5.2).map((p) => {
    const s = new THREE.Mesh(ctx.own(new THREE.SphereGeometry(0.3, 14, 10)), strobeMat);
    s.position.copy(p);
    ctx.add(s);
    const housing = new THREE.Mesh(
      ctx.own(new THREE.CylinderGeometry(0.34, 0.34, 0.2, 12)),
      body,
    );
    housing.position.copy(p).setY(p.y + 0.28);
    ctx.add(housing);
    return s;
  });

  const threats: Threat[] = [];
  const threatGeo = ctx.own(new THREE.OctahedronGeometry(0.2, 0));
  const threatMat = ctx.own(
    new THREE.MeshBasicMaterial({ color: 0xff3355, toneMapped: false }),
  );
  const reticleGeo = ctx.own(new THREE.RingGeometry(0.34, 0.4, 4));
  const reticleMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: 0xff3355,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const threatPool = ctx.add(new THREE.Group());

  const spawnThreat = () => {
    if (threats.length > 7) return;
    const g = new THREE.Group();
    g.add(new THREE.Mesh(threatGeo, threatMat));
    const reticle = new THREE.Mesh(reticleGeo, reticleMat.clone());
    ctx.own(reticle.material as THREE.Material);
    g.add(reticle);
    threatPool.add(g);
    threats.push({
      mesh: g,
      angle: rnd(0, Math.PI * 2),
      radius: 12.4,
      height: rnd(-1.5, 3.5),
      speed: rnd(0.55, 1.5),
      state: 0,
      life: 0,
      reticle,
    });
  };
  for (let i = 0; i < 3; i++) spawnThreat();

  const rackGeo = ctx.own(new THREE.BoxGeometry(1.0, 3.2, 0.55));
  ring(3, 11.2, -1.5, Math.PI * 1.15).forEach((p) => {
    const rack = panelWithEdges(ctx, rackGeo, body, edges);
    rack.position.copy(p);
    rack.lookAt(0, p.y, 0);
    ctx.add(rack);
    const led = ctx.fx(
      createLedBank({ color: ctx.color, cols: 5, rows: 14, width: 0.72, height: 2.7 }),
      rack,
    );
    led.object.position.z = 0.3;
  });

  for (const p of ring(5, 10.4, 0, 0.3)) {
    ctx.fx(
      createConduit({
        from: new THREE.Vector3(p.x * 0.15, -3.0, p.z * 0.15),
        to: new THREE.Vector3(p.x, 2.0, p.z),
        color: ctx.color,
        sag: 1.1,
        speed: 0.5,
        packets: 2,
      }),
    );
  }

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 1.4;
    s.object.position.set(Math.cos(a) * 12.4, rnd(1.4, 4.2), Math.sin(a) * 12.4);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: new THREE.Color(0xff3355), count: 180 }));

  const camWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  let alertLevel = 0;
  let spawnTimer = 0;
  let lastAlert = 0;

  ctx.tick((dt, t) => {
    fenceMat.uniforms.uTime.value = t;

    ctx.camera.getWorldPosition(camWorld);
    eyeRig.worldToLocal(tmp.copy(camWorld));
    gaze.quaternion.slerp(
      new THREE.Quaternion().setFromRotationMatrix(
        new THREE.Matrix4().lookAt(new THREE.Vector3(), tmp, THREE.Object3D.DEFAULT_UP),
      ),
      1 - Math.pow(0.002, dt),
    );
    const dilate = 1 + alertLevel * 0.55 + Math.sin(t * 3.1) * 0.05;
    pupil.scale.setScalar(dilate);
    irisMat.opacity = 0.6 + Math.sin(t * 2.4) * 0.28 + alertLevel * 0.3;
    eyeLight.intensity = 3 + Math.sin(t * 3.2) * 1 + alertLevel * 8;

    gyros.forEach((g, i) => {
      const s = 0.08 + (i % 5) * 0.035;
      g.rotation.z += dt * s * (i % 2 === 0 ? 1 : -1) * (1 + alertLevel * 2.5);
      g.rotation.x += dt * s * 0.5;
    });

    sweep.rotation.z -= dt * (0.85 + alertLevel * 2.2);
    sweepMat.opacity = 0.12 + alertLevel * 0.16;

    spawnTimer += dt;
    if (spawnTimer > (alertLevel > 0.4 ? 0.55 : 2.6)) {
      spawnTimer = 0;
      spawnThreat();
    }

    for (let i = threats.length - 1; i >= 0; i--) {
      const th = threats[i];
      th.life += dt;
      th.angle += dt * 0.16;

      if (th.state === 0) {
        th.radius -= th.speed * dt * (1 + alertLevel);
        if (th.radius < 5.5) {
          th.state = 1;
          th.life = 0;
        }
      } else if (th.state === 1) {
        (th.reticle.material as THREE.MeshBasicMaterial).opacity = Math.min(
          0.95,
          th.life * 3,
        );
        th.reticle.rotation.z += dt * 3.2;
        th.reticle.scale.setScalar(1 + Math.max(0, 1 - th.life * 2) * 1.8);
        if (th.life > 0.85) {
          th.state = 2;
          th.life = 0;
          sparks.fire(th.mesh.position.clone());
        }
      } else {
        th.mesh.scale.multiplyScalar(1 - dt * 6);
        if (th.life > 0.35) {
          threatPool.remove(th.mesh);
          threats.splice(i, 1);
          continue;
        }
      }

      th.mesh.position.set(
        Math.cos(th.angle) * th.radius,
        th.height,
        Math.sin(th.angle) * th.radius,
      );
      th.mesh.rotation.y += dt * 2.4;
      th.reticle.lookAt(camWorld);
    }

    const target =
      threats.find((th) => th.state === 1) ?? threats[0] ?? null;
    towerHeads.forEach((tw, i) => {
      if (target) {
        tw.head.lookAt(target.mesh.position);
      } else {
        const a = t * 0.35 + i * 1.3;
        tw.head.lookAt(Math.cos(a) * 9, -1, Math.sin(a) * 9);
      }
      (tw.beam.material as THREE.MeshBasicMaterial).opacity =
        0.07 + alertLevel * 0.16;
    });

    turrets.forEach((tu, i) => {
      const p = target
        ? target.mesh.position
        : new THREE.Vector3(Math.cos(t * 0.5 + i) * 8, -1, Math.sin(t * 0.5 + i) * 8);
      const local = tu.yaw.parent!.worldToLocal(p.clone());
      tu.yaw.rotation.y = Math.atan2(local.x, local.z);
      tu.pitch.rotation.x = -Math.atan2(local.y, Math.hypot(local.x, local.z));
      (tu.muzzle.material as THREE.MeshBasicMaterial).opacity =
        target?.state === 1 ? 0.4 + Math.random() * 0.6 : 0.5;
    });

    const strobeOn = alertLevel > 0.3 && Math.sin(t * 13) > 0;
    strobeMat.opacity = strobeOn ? 0.85 * alertLevel : 0;
    strobes.forEach((s, i) => {
      s.scale.setScalar(1 + (strobeOn ? Math.sin(t * 13 + i) * 0.3 : 0));
    });
  });

  ctx.alert((level) => {
    alertLevel = level;
    const s = swell(level);
    fenceMat.uniforms.uAlert.value = s;
    irisMat.color.lerpColors(ctx.color, new THREE.Color(0xff2040), s);

    if (level > 0.5 && lastAlert <= 0.5) {
      for (let i = 0; i < 4; i++) spawnThreat();
      screens.forEach((sc, i) =>
        sc.setContent(
          i === 0 ? "INTRUSION // TRACE ACTIVE" : CAMS[i],
          ["MOTION: CONFIRMED", "LOCKDOWN ENGAGED"],
          "#ff3b5c",
        ),
      );
    }
    if (level < 0.2 && lastAlert >= 0.2) {
      screens.forEach((sc, i) =>
        sc.setContent(CAMS[i], ["MOTION: NONE", "SIGNAL: ENCRYPTED"], `#${ctx.color.getHexString()}`),
      );
    }
    lastAlert = level;
  });
}
