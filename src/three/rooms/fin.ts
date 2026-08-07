import * as THREE from "three";
import {
  createConduit,
  createLedBank,
  createLightShaft,
  createSignage,
  createSparkBurst,
  createTickerBand,
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

const SYMBOLS = ["KSN", "ARSC", "MTEK", "VNTA", "OROS", "HLWM", "DYNE", "PXIS"];

function tickerText(prices: number[], crash: number): string {
  return SYMBOLS.map((s, i) => {
    const p = prices[i];
    const d = (p - 50) / 50;
    const up = d >= 0 && crash < 0.4;
    return `${s} ${p.toFixed(2)} ${up ? "▲" : "▼"}${Math.abs(d * 100).toFixed(1)}%`;
  }).join("     ///     ");
}

export function buildFinRoom(ctx: RoomCtx): void {
  const body = structMaterial(ctx, 0x1a1004, 0.07);
  const edges = lineMaterial(ctx, 0.5);
  const glow = glowMaterial(ctx, 0.85);

  const core = ctx.add(new THREE.Group());
  core.position.y = 0.6;

  const bullion = new THREE.Mesh(
    ctx.own(new THREE.IcosahedronGeometry(1.05, 3)),
    ctx.own(
      new THREE.MeshPhysicalMaterial({
        color: ctx.color,
        emissive: ctx.color,
        emissiveIntensity: 0.28,
        roughness: 0.06,
        metalness: 1.0,
        clearcoat: 0.9,
        clearcoatRoughness: 0.04,
      }),
    ),
  );
  core.add(bullion);

  const globeMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      wireframe: true,
      transparent: true,
      opacity: 0.3,
    }),
  );
  const globe = new THREE.Mesh(
    ctx.own(new THREE.SphereGeometry(1.55, 24, 16)),
    globeMat,
  );
  core.add(globe);

  const coreLight = new THREE.PointLight(ctx.dept.color, 5, 18, 2);
  core.add(coreLight);

  const coinGeo = ctx.own(new THREE.TorusGeometry(1.35, 0.05, 10, 64));
  const coins: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Mesh(coinGeo, glow);
    c.position.y = (i - 3) * 0.36;
    c.rotation.x = Math.PI / 2 + rnd(-0.08, 0.08);
    core.add(c);
    coins.push(c);
  }

  const BARS = 16;
  const prices = new Float32Array(BARS).map(() => rnd(35, 68));
  const velocity = new Float32Array(BARS);

  const barMat = ctx.own(
    new THREE.MeshStandardMaterial({
      color: ctx.color,
      emissive: ctx.color,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.8,
    }),
  );
  const capMat = glowMaterial(ctx, 0.95);
  const barGeo = ctx.own(new THREE.BoxGeometry(0.46, 1, 0.46));
  const capGeo = ctx.own(new THREE.BoxGeometry(0.56, 0.06, 0.56));

  const bars = ring(BARS, 4.6, -3.2).map((p) => {
    const holder = ctx.add(new THREE.Group());
    holder.position.copy(p);
    const mesh = new THREE.Mesh(barGeo, barMat);
    holder.add(mesh);
    const cap = new THREE.Mesh(capGeo, capMat);
    holder.add(cap);
    return { mesh, cap };
  });

  const candleUpMat = glowMaterial(ctx, 0.7);
  const candleDownMat = ctx.own(
    new THREE.MeshBasicMaterial({
      color: 0xff3b5c,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const candleGeo = ctx.own(new THREE.BoxGeometry(0.16, 1, 0.16));
  const candles: { mesh: THREE.Mesh; h: number }[] = [];
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    const r = 8.4 + (i % 3) * 0.55;
    const mesh = new THREE.Mesh(candleGeo, i % 3 === 0 ? candleDownMat : candleUpMat);
    mesh.position.set(Math.cos(a) * r, -3.1, Math.sin(a) * r);
    ctx.add(mesh);
    candles.push({ mesh, h: rnd(0.4, 3.4) });
  }

  const CHART_PTS = 96;
  const chartPos = new Float32Array(CHART_PTS * 3);
  const history = new Float32Array(CHART_PTS).fill(0.5);
  for (let i = 0; i < CHART_PTS; i++) {
    chartPos[i * 3] = (i / (CHART_PTS - 1) - 0.5) * 7.4;
    chartPos[i * 3 + 1] = 0;
    chartPos[i * 3 + 2] = 0;
  }
  const chartGeo = ctx.own(new THREE.BufferGeometry());
  chartGeo.setAttribute("position", new THREE.BufferAttribute(chartPos, 3));
  const chartLine = new THREE.Line(chartGeo, lineMaterial(ctx, 0.95));

  const chartBoard = ctx.add(new THREE.Group());
  chartBoard.position.set(0, 2.9, -9.4);
  chartBoard.add(chartLine);
  chartBoard.add(
    new THREE.Mesh(
      ctx.own(new THREE.PlaneGeometry(8.2, 3.6)),
      ctx.own(
        new THREE.MeshBasicMaterial({
          color: 0x0d0803,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
        }),
      ),
    ),
  );
  const gridPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    const y = -1.6 + (i / 6) * 3.2;
    gridPts.push(new THREE.Vector3(-3.9, y, 0.01), new THREE.Vector3(3.9, y, 0.01));
  }
  for (let i = 0; i <= 10; i++) {
    const x = -3.9 + (i / 10) * 7.8;
    gridPts.push(new THREE.Vector3(x, -1.7, 0.01), new THREE.Vector3(x, 1.7, 0.01));
  }
  chartBoard.add(
    new THREE.LineSegments(
      ctx.own(new THREE.BufferGeometry().setFromPoints(gridPts)),
      lineMaterial(ctx, 0.12),
    ),
  );
  const chartFrame = new THREE.Mesh(
    ctx.own(new THREE.BoxGeometry(8.6, 4.0, 0.14)),
    body,
  );
  chartFrame.position.z = -0.12;
  chartBoard.add(chartFrame);

  const ticker = ctx.fx(
    createTickerBand({
      text: tickerText(Array.from(prices), 0),
      color: ctx.color,
      radius: 12.6,
      height: 0.72,
      speed: 0.05,
      repeats: 4,
    }),
  );
  ticker.object.position.y = 4.4;

  const ticker2 = ctx.fx(
    createTickerBand({
      text: "  SETTLEMENT COMPLETE  ///  AUDIT WINDOW SUPPRESSED  ///  OFFSHORE ROUTE NOMINAL  ///  NOTHING HAPPENED  ",
      color: ctx.color,
      radius: 12.4,
      height: 0.5,
      speed: -0.035,
      repeats: 3,
    }),
  );
  ticker2.object.position.y = -2.3;

  const nodeGeo = ctx.own(new THREE.OctahedronGeometry(0.44, 0));
  const offshore = ring(5, 10.2, 1.4, 0.5).map((p) => {
    const g = ctx.add(new THREE.Group());
    g.position.copy(p);
    g.add(new THREE.Mesh(nodeGeo, glow));
    g.add(
      new THREE.Mesh(
        ctx.own(new THREE.TorusGeometry(0.72, 0.02, 8, 32)),
        glow,
      ),
    );
    ctx.fx(
      createConduit({
        from: new THREE.Vector3(0, 0.6, 0),
        to: p.clone(),
        color: ctx.color,
        sag: 1.4,
        speed: 0.3,
        packets: 3,
      }),
    );
    return g;
  });

  const ingotGeo = ctx.own(new THREE.BoxGeometry(0.62, 0.2, 0.34));
  const ingotMat = ctx.own(
    new THREE.MeshStandardMaterial({
      color: ctx.color,
      emissive: ctx.color,
      emissiveIntensity: 0.22,
      roughness: 0.18,
      metalness: 0.95,
    }),
  );
  ring(4, 11.4, -3.0, Math.PI / 4).forEach((p) => {
    const stack = ctx.add(new THREE.Group());
    stack.position.copy(p);
    stack.lookAt(0, p.y, 0);
    for (let layer = 0; layer < 6; layer++) {
      const n = 6 - layer;
      for (let i = 0; i < n; i++) {
        const ing = new THREE.Mesh(ingotGeo, ingotMat);
        ing.position.set((i - (n - 1) / 2) * 0.68, layer * 0.21, 0);
        stack.add(ing);
      }
    }
    const cage = panelWithEdges(
      ctx,
      ctx.own(new THREE.BoxGeometry(4.6, 1.6, 1.2)),
      ctx.own(
        new THREE.MeshBasicMaterial({
          color: ctx.color,
          wireframe: true,
          transparent: true,
          opacity: 0.16,
        }),
      ),
      edges,
    );
    cage.position.y = 0.6;
    stack.add(cage);
  });

  const RAIN = 260;
  const rainPos = new Float32Array(RAIN * 3);
  const rainSpeed = new Float32Array(RAIN);
  for (let i = 0; i < RAIN; i++) {
    const a = rnd(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * 12;
    rainPos[i * 3] = Math.cos(a) * r;
    rainPos[i * 3 + 1] = rnd(-3, 7);
    rainPos[i * 3 + 2] = Math.sin(a) * r;
    rainSpeed[i] = rnd(1.4, 4.2);
  }
  const rainGeo = ctx.own(new THREE.BufferGeometry());
  rainGeo.setAttribute("position", new THREE.BufferAttribute(rainPos, 3));
  const rainMat = ctx.own(
    new THREE.PointsMaterial({
      color: ctx.color,
      size: 0.09,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  const rain = new THREE.Points(rainGeo, rainMat);
  rain.frustumCulled = false;
  ctx.add(rain);

  ctx.fx(createLightShaft({ color: ctx.color, height: 8, radius: 3.4 })).object.position.y =
    3.9;

  ring(3, 11.6, -1.6, Math.PI * 0.85).forEach((p) => {
    const rack = panelWithEdges(
      ctx,
      ctx.own(new THREE.BoxGeometry(0.95, 3.0, 0.5)),
      body,
      edges,
    );
    rack.position.copy(p);
    rack.lookAt(0, p.y, 0);
    ctx.add(rack);
    const led = ctx.fx(
      createLedBank({ color: ctx.color, cols: 4, rows: 12, width: 0.66, height: 2.5 }),
      rack,
    );
    led.object.position.z = 0.27;
  });

  ctx.lore.signage.forEach((text, i) => {
    const s = ctx.fx(createSignage(text, ctx.color, 1.5));
    const a = (i / ctx.lore.signage.length) * Math.PI * 2 + 0.9;
    s.object.position.set(Math.cos(a) * 12.3, rnd(1.6, 3.8), Math.sin(a) * 12.3);
    s.object.lookAt(0, s.object.position.y, 0);
  });

  const sparks = ctx.fx(createSparkBurst({ color: ctx.color, count: 200 }));

  let crash = 0;
  let lastAlert = 0;
  let tickAccum = 0;
  let tickerAccum = 0;

  ctx.tick((dt, t) => {
    tickAccum += dt;
    if (tickAccum > 0.09) {
      tickAccum = 0;
      for (let i = 0; i < BARS; i++) {
        velocity[i] += (rnd(-1, 1) * 1.4 - (prices[i] - 50) * 0.035) * 0.35;
        velocity[i] -= crash * 2.6;
        velocity[i] *= 0.86;
        prices[i] = THREE.MathUtils.clamp(prices[i] + velocity[i], 4, 96);
      }

      const avg = prices.reduce((s, p) => s + p, 0) / BARS / 100;
      history.copyWithin(0, 1);
      history[CHART_PTS - 1] = avg;
      const posArr = chartGeo.getAttribute("position") as THREE.BufferAttribute;
      const arr = posArr.array as Float32Array;
      for (let i = 0; i < CHART_PTS; i++) {
        arr[i * 3 + 1] = (history[i] - 0.5) * 3.1;
        arr[i * 3 + 2] = 0.05;
      }
      posArr.needsUpdate = true;
    }

    tickerAccum += dt;
    if (tickerAccum > 0.55) {
      tickerAccum = 0;
      ticker.setText(tickerText(Array.from(prices), crash));
    }

    bars.forEach((b, i) => {
      const h = 0.35 + (prices[i] / 100) * 6.4;
      b.mesh.scale.y += (h - b.mesh.scale.y) * Math.min(1, dt * 7);
      b.mesh.position.y = b.mesh.scale.y / 2;
      b.cap.position.y = b.mesh.scale.y + 0.03;
      const falling = velocity[i] < 0;
      (b.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.3;
      b.cap.visible = true;
      (b.cap.material as THREE.MeshBasicMaterial).opacity = falling ? 0.4 : 0.95;
    });

    candles.forEach((c, i) => {
      const target = c.h * (1 - crash * 0.7) * (0.7 + Math.sin(t * 0.6 + i) * 0.3 + 0.3);
      c.mesh.scale.y += (target - c.mesh.scale.y) * Math.min(1, dt * 3);
      c.mesh.position.y = -3.1 + c.mesh.scale.y / 2;
    });

    bullion.rotation.y += dt * 0.35;
    bullion.rotation.x += dt * 0.12;
    globe.rotation.y -= dt * 0.16;
    globe.rotation.z += dt * 0.05;
    coreLight.intensity = 4 + Math.sin(t * 1.5) * 1.2 - crash * 2.6;
    coins.forEach((c, i) => {
      c.rotation.z += dt * (0.12 + i * 0.02) * (i % 2 === 0 ? 1 : -1);
      c.position.y = (i - 3) * 0.36 + Math.sin(t * 0.9 + i * 0.5) * 0.05;
    });

    offshore.forEach((g, i) => {
      g.rotation.y += dt * 0.6;
      g.position.y = 1.4 + Math.sin(t * 0.8 + i * 1.2) * 0.3;
    });

    const arr = (rainGeo.getAttribute("position") as THREE.BufferAttribute)
      .array as Float32Array;
    for (let i = 0; i < RAIN; i++) {
      arr[i * 3 + 1] -= rainSpeed[i] * dt * (1 + crash * 2.5);
      if (arr[i * 3 + 1] < -3.1) arr[i * 3 + 1] = 7;
    }
    (rainGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
  });

  ctx.alert((level) => {
    const s = swell(level);
    crash = s;
    globeMat.color.lerpColors(ctx.color, new THREE.Color(0xff3b5c), s);
    rainMat.color.lerpColors(ctx.color, new THREE.Color(0xff3b5c), s);
    (chartLine.material as THREE.LineBasicMaterial).color.lerpColors(
      ctx.color,
      new THREE.Color(0xff3b5c),
      s,
    );

    if (level > 0.5 && lastAlert <= 0.5) {
      sparks.fire(new THREE.Vector3(0, 0.6, 0));
      for (let i = 0; i < BARS; i++) velocity[i] -= rnd(3, 9);
    }
    lastAlert = level;
  });
}
