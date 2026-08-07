import * as THREE from "three";
import {
  createLightShaft,
  createSignage,
  createSparkBurst,
  createTickerBand,
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

function makeDocumentTexture(color: THREE.Color): THREE.CanvasTexture {
  const w = 256;
  const h = 340;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D context not available");

  g.fillStyle = "rgba(6,14,6,0.94)";
  g.fillRect(0, 0, w, h);

  const hex = `#${color.getHexString()}`;
  g.strokeStyle = hex;
  g.lineWidth = 2;
  g.strokeRect(6, 6, w - 12, h - 12);

  g.fillStyle = hex;
  g.font = '700 15px "SFMono-Regular", Menlo, monospace';
  g.fillText("INSTRUMENT", 20, 34);
  g.fillRect(20, 42, w - 40, 1.5);

  let y = 62;
  while (y < h - 24) {
    const redacted = Math.random() < 0.42;
    const lineW = (w - 44) * (0.45 + Math.random() * 0.55);
    if (redacted) {
      g.fillStyle = "rgba(0,0,0,0.92)";
      g.fillRect(20, y - 8, lineW, 11);
      g.strokeStyle = "rgba(255,255,255,0.09)";
      g.lineWidth = 1;
      g.strokeRect(20, y - 8, lineW, 11);
    } else {
      g.fillStyle = "rgba(160,200,160,0.42)";
      g.fillRect(20, y - 5, lineW, 4);
    }
    y += 15;
  }

  g.strokeStyle = hex;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(20, h - 34);
  g.lineTo(w / 2, h - 34);
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildLegalRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x0a1206, 0.06);
  const edges = lineMaterial(ctx, 0.5);
  const glow = glowMaterial(ctx, 0.85);

  const scales = ctx.add(new THREE.Group());
  scales.position.y = -0.4;

  const plinth = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(1.15, 1.5, 0.7, 24)),
    body,
  );
  plinth.position.y = -2.5;
  scales.add(plinth);
  const plinthTrim = new THREE.Mesh(
    ctx.own(new THREE.TorusGeometry(1.2, 0.035, 8, 48)),
    glow,
  );
  plinthTrim.rotation.x = Math.PI / 2;
  plinthTrim.position.y = -2.16;
  scales.add(plinthTrim);

  const pole = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(0.06, 0.1, 5.0, 12)),
    body,
  );
  pole.position.y = 0.2;
  scales.add(pole);

  const beamPivot = new THREE.Group();
  beamPivot.position.y = 2.5;
  scales.add(beamPivot);

  const beam = new THREE.Mesh(
    ctx.own(new THREE.BoxGeometry(6.4, 0.07, 0.07)),
    ctx.own(
      new THREE.MeshStandardMaterial({
        color: ctx.color,
        emissive: ctx.color,
        emissiveIntensity: 0.55,
        roughness: 0.22,
        metalness: 0.85,
      }),
    ),
  );
  beamPivot.add(beam);
  const fulcrum = new THREE.Mesh(ctx.own(new THREE.OctahedronGeometry(0.22, 0)), glow);
  beamPivot.add(fulcrum);

  const panGeo = ctx.own(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 28));
  const panMat = ctx.own(
    new THREE.MeshPhysicalMaterial({
      color: 0x0a1208,
      roughness: 0.18,
      metalness: 0.92,
      emissive: ctx.color,
      emissiveIntensity: 0.18,
      clearcoat: 0.7,
    }),
  );
  const panRimGeo = ctx.own(new THREE.TorusGeometry(0.97, 0.028, 8, 32));

  const pans = ([-1, 1] as const).map((side) => {
    const chain = new THREE.Group();
    chain.position.x = side * 2.9;
    beamPivot.add(chain);

    const linePts: THREE.Vector3[] = [];
    for (const q of ring(3, 0.9, -1.9)) {
      linePts.push(new THREE.Vector3(0, 0, 0), q);
    }
    chain.add(
      new THREE.LineSegments(
        ctx.own(new THREE.BufferGeometry().setFromPoints(linePts)),
        edges,
      ),
    );

    const pan = new THREE.Group();
    pan.position.y = -1.9;
    pan.add(new THREE.Mesh(panGeo, panMat));
    const rim = new THREE.Mesh(panRimGeo, glow);
    rim.rotation.x = Math.PI / 2;
    pan.add(rim);
    chain.add(pan);

    return { chain, pan, load: 0 };
  });

  const docTextures = Array.from({ length: 4 }, () => ctx.own(makeDocumentTexture(ctx.color)));
  const docGeo = ctx.own(new THREE.PlaneGeometry(0.62, 0.82));
  const docMats = docTextures.map((t) =>
    ctx.own(
      new THREE.MeshBasicMaterial({
        map: t,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        toneMapped: false,
      }),
    ),
  );

  type Doc = {
    mesh: THREE.Mesh;
    from: THREE.Vector3;
    to: THREE.Vector3;
    p: number;
    speed: number;
    side: number;
    spin: number;
    landed: boolean;
  };
  const docs: Doc[] = [];
  const docPool = ctx.add(new THREE.Group());

  const launchDoc = () => {
    if (docs.length > 26) return;
    const a = rnd(0, Math.PI * 2);
    const from = new THREE.Vector3(Math.cos(a) * 11.5, rnd(-2, 4.5), Math.sin(a) * 11.5);
    const side = Math.random() < 0.5 ? -1 : 1;
    const mesh = new THREE.Mesh(docGeo, docMats[(Math.random() * docMats.length) | 0]);
    mesh.position.copy(from);
    docPool.add(mesh);
    docs.push({
      mesh,
      from,
      to: new THREE.Vector3(side * 2.9, 0.2, 0).add(
        new THREE.Vector3(rnd(-0.4, 0.4), 0, rnd(-0.4, 0.4)),
      ),
      p: 0,
      speed: rnd(0.22, 0.5),
      side,
      spin: rnd(-3, 3),
      landed: false,
    });
  };
  for (let i = 0; i < 8; i++) launchDoc();

  const seal = ctx.add(new THREE.Group());
  seal.position.set(0, 7.4, 0);
  const sealHead = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(1.5, 1.15, 0.85, 16)),
    body,
  );
  seal.add(sealHead);
  const sealFace = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(1.16, 1.16, 0.06, 16)),
    glow,
  );
  sealFace.position.y = -0.45;
  seal.add(sealFace);
  const sealShaft = new THREE.Mesh(
    ctx.own(new THREE.CylinderGeometry(0.24, 0.24, 3.4, 12)),
    body,
  );
  sealShaft.position.y = 2.1;
  seal.add(sealShaft);
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(
      ctx.own(new THREE.TorusGeometry(1.3 + i * 0.14, 0.03, 8, 40)),
      glow,
    );
    r.rotation.x = Math.PI / 2;
    r.position.y = -0.2 + i * 0.2;
    seal.add(r);
  }

  const colGeo = ctx.own(new THREE.CylinderGeometry(0.3, 0.36, 8.2, 20));
  const fluteGeo = ctx.own(new THREE.BoxGeometry(0.035, 8.2, 0.035));
  const capGeo = ctx.own(new THREE.CylinderGeometry(0.48, 0.48, 0.3, 20));
  ring(10, 11.4, 0, Math.PI / 10).forEach((p) => {
    const g = ctx.add(new THREE.Group());
    g.position.set(p.x, 1.0, p.z);
    g.add(new THREE.Mesh(colGeo, body));
    for (const q of ring(10, 0.31)) {
      const f = new THREE.Mesh(fluteGeo, body);
      f.position.set(q.x, 0, q.z);
      g.add(f);
    }
    for (const y of [4.25, -4.25]) {
      const cap = new THREE.Mesh(capGeo, body);
      cap.position.y = y;
      g.add(cap);
      const trim = new THREE.Mesh(
        ctx.own(new THREE.TorusGeometry(0.5, 0.02, 6, 24)),
        glow,
      );
      trim.rotation.x = Math.PI / 2;
      trim.position.y = y;
      g.add(trim);
    }
  });

  const boxGeo = ctx.own(new THREE.BoxGeometry(0.7, 0.42, 0.5));
  const boxMat = ctx.own(
    new THREE.MeshStandardMaterial({
      color: 0x0d1408,
      roughness: 0.75,
      metalness: 0.4,
      emissive: ctx.color,
      emissiveIntensity: 0.09,
    }),
  );
  ring(6, 12.6, -3.05, Math.PI / 6).forEach((p) => {
    const stack = ctx.add(new THREE.Group());
    stack.position.copy(p);
    stack.rotation.y = rnd(0, Math.PI);
    const layers = 4 + ((Math.random() * 4) | 0);
    for (let l = 0; l < layers; l++) {
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(boxGeo, boxMat);
        b.position.set((i - 1) * 0.74, 0.21 + l * 0.44, rnd(-0.05, 0.05));
        b.rotation.y = rnd(-0.06, 0.06);
        stack.add(b);
      }
    }
  });

  const inscription = ctx.fx(
    createTickerBand({
      text:
        "  NOTWITHSTANDING ANY PROVISION TO THE CONTRARY  ///  THE PARTY WAIVES ALL CLAIMS KNOWN AND UNKNOWN  ///  VENUE SHALL BE EXCLUSIVE  ///  TERMS REMAIN CONFIDENTIAL IN PERPETUITY  ",
      color: ctx.color,
      radius: 8.4,
      height: 0.5,
      speed: 0.02,
      repeats: 2,
    }),
  );
  inscription.object.position.y = -2.95;

  const upper = ctx.fx(
    createTickerBand({
      text: "  EXHIBIT SEALED BY ORDER  ///  DISCOVERY NARROWED  ///  JUDGMENT ENTERED  ///  ",
      color: ctx.color,
      radius: 12.4,
      height: 0.58,
      speed: -0.03,
      repeats: 3,
    }),
  );
  upper.object.position.y = 4.6;

  ctx.fx(createLightShaft({ color: ctx.color, height: 9, radius: 3.6 })).object.position.y =
    4.2;

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 1.1;
    s.object.position.set(Math.cos(a) * 12.2, rnd(0.5, 3.2), Math.sin(a) * 12.2);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 220 }));

  let sealDrop = 0;
  let ruling = 0;
  let lastAlert = 0;
  let spawnTimer = 0;
  const tmp = new THREE.Vector3();

  ctx.tick((dt, t) => {
    spawnTimer += dt;
    if (spawnTimer > 0.7) {
      spawnTimer = 0;
      launchDoc();
    }

    for (let i = docs.length - 1; i >= 0; i--) {
      const d = docs[i];
      if (!d.landed) {
        d.p += d.speed * dt;
        if (d.p >= 1) {
          d.landed = true;
          d.p = 1;
          const pan = pans[d.side === -1 ? 0 : 1];
          pan.load = Math.min(1.6, pan.load + 0.12);
        }
        const e = d.p * d.p * (3 - 2 * d.p);
        tmp.lerpVectors(d.from, d.to, e);
        tmp.y += Math.sin(e * Math.PI) * 2.4;
        d.mesh.position.copy(tmp);
        d.mesh.rotation.z += d.spin * dt * (1 - e * 0.8);
        d.mesh.rotation.x = (1 - e) * 1.2;
        (d.mesh.material as THREE.MeshBasicMaterial).opacity = 1;
      } else {
        const pan = pans[d.side === -1 ? 0 : 1];
        pan.pan.getWorldPosition(tmp);
        docPool.worldToLocal(tmp);
        d.mesh.position.lerp(
          tmp.add(new THREE.Vector3(d.to.x * 0.05, 0.12, d.to.z * 0.3)),
          Math.min(1, dt * 6),
        );
        d.mesh.rotation.x += (Math.PI / 2 - d.mesh.rotation.x) * Math.min(1, dt * 5);

        if (ruling > 0.6 || Math.random() < dt * 0.05) {
          docPool.remove(d.mesh);
          docs.splice(i, 1);
          pan.load = Math.max(0, pan.load - 0.12);
        }
      }
    }

    const diff = pans[1].load - pans[0].load;
    const targetTilt = THREE.MathUtils.clamp(diff * 0.42, -0.42, 0.42);
    beamPivot.rotation.z +=
      (targetTilt - beamPivot.rotation.z) * Math.min(1, dt * 2.2) +
      Math.sin(t * 0.9) * 0.0006;
    pans.forEach((p) => {
      p.chain.rotation.z = -beamPivot.rotation.z;
      p.pan.rotation.y += dt * 0.15;
    });

    fulcrum.rotation.y += dt * 0.8;
    scales.rotation.y += dt * 0.045;

    if (sealDrop > 0) {
      sealDrop = Math.max(0, sealDrop - dt * 1.9);
      const e = 1 - sealDrop;
      seal.position.y = 7.4 - Math.sin(Math.min(1, e * 1.6) * Math.PI * 0.5) * 4.6;
      seal.rotation.y += dt * 2.2;
    } else {
      seal.position.y = 7.4 + Math.sin(t * 0.7) * 0.18;
      seal.rotation.y += dt * 0.25;
    }
    (sealFace.material as THREE.MeshBasicMaterial).opacity =
      0.5 + Math.sin(t * 2.1) * 0.2 + ruling * 0.5;

    if (ruling > 0) ruling = Math.max(0, ruling - dt * 0.8);
  });

  ctx.alert((level) => {
    const s = swell(level);
    (beam.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.55 + s * 1.4;

    if (level > 0.5 && lastAlert <= 0.5) {
      sealDrop = 1;
      ruling = 1;
      sparks.fire(new THREE.Vector3(0, 2.4, 0));
      pans[Math.random() < 0.5 ? 0 : 1].load += 0.9;
      for (let i = 0; i < 6; i++) launchDoc();
    }
    lastAlert = level;
  });
}
