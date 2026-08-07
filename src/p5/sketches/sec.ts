import {
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

type Tracer = { x: number; y: number; px: number; py: number; life: number; hostile: boolean };

function createFlowField(env: SketchEnv) {
  const COUNT = 460;
  const tracers: Tracer[] = [];
  const reset = (t: Tracer, w: number, h: number, hostile: boolean) => {
    t.x = Math.random() * w;
    t.y = Math.random() * h;
    t.px = t.x;
    t.py = t.y;
    t.life = 40 + Math.random() * 150;
    t.hostile = hostile;
  };
  for (let i = 0; i < COUNT; i++) {
    const t: Tracer = { x: 0, y: 0, px: 0, py: 0, life: 0, hostile: false };
    reset(t, env.w, env.h, Math.random() < 0.06);
    tracers.push(t);
  }

  type Ping = { x: number; y: number; r: number };
  const pings: Ping[] = [];
  let sincePing = 0;

  env.g.background(4, 2, 6);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;

    g.noStroke();
    g.fill(4, 2, 6, 11 + alert * 14);
    g.rect(0, 0, w, h);

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, 1);
    const scale = 0.0055 + alert * 0.004;
    const speed = 34 + alert * 62;
    const zt = e.t * (0.06 + alert * 0.22);

    g.strokeWeight(1);
    for (const t of tracers) {
      const ang =
        p.noise(t.x * scale, t.y * scale, zt) * Math.PI * 4 +
        (t.hostile ? Math.PI : 0);
      t.px = t.x;
      t.py = t.y;
      t.x += Math.cos(ang) * speed * dt;
      t.y += Math.sin(ang) * speed * dt;
      t.life -= 1;

      if (t.hostile) g.stroke(hr, hg, hb, 210);
      else g.stroke(r, gg, bl, 165 + alert * 70);

      if (t.x < 0 || t.x > w || t.y < 0 || t.y > h || t.life <= 0) {
        reset(t, w, h, Math.random() < 0.06 + alert * 0.22);
      } else {
        g.line(t.px, t.py, t.x, t.y);
      }
    }

    sincePing += dt;
    if (sincePing > (alert > 0.5 ? 0.35 : 1.6)) {
      sincePing = 0;
      const hostile = tracers.find((t) => t.hostile);
      if (hostile) pings.push({ x: hostile.x, y: hostile.y, r: 1 });
      if (pings.length > 9) pings.shift();
    }
    g.noFill();
    for (let i = pings.length - 1; i >= 0; i--) {
      const q = pings[i];
      q.r += dt * 60;
      const a = Math.max(0, 200 - q.r * 2.6);
      if (a <= 0) {
        pings.splice(i, 1);
        continue;
      }
      g.stroke(hr, hg, hb, a);
      g.strokeWeight(1.4);
      g.circle(q.x, q.y, q.r * 2);
      g.line(q.x - q.r - 6, q.y, q.x - q.r + 4, q.y);
      g.line(q.x + q.r - 4, q.y, q.x + q.r + 6, q.y);
    }

    const hostileCount = tracers.reduce((s, t) => s + (t.hostile ? 1 : 0), 0);
    g.noStroke();
    g.fill(4, 2, 6, 200);
    g.rect(0, h - 26, w, 26);
    g.fill(hostileCount > 40 ? hr : r, hostileCount > 40 ? hg : gg, hostileCount > 40 ? hb : bl);
    g.textFont("monospace");
    g.textSize(13);
    g.textAlign(p.LEFT, p.CENTER);
    g.text(`VECTORS ${tracers.length}   HOSTILE ${hostileCount}`, 10, h - 13);
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(alert > 0.5 ? "TRACE ACTIVE" : "PASSIVE MONITOR", w - 10, h - 13);
  };
}

type Blip = { a: number; r: number; strength: number; hostile: boolean };

function createRadarFloor(env: SketchEnv) {
  const blips: Blip[] = [];
  for (let i = 0; i < 26; i++) {
    blips.push({
      a: Math.random() * Math.PI * 2,
      r: 0.1 + Math.random() * 0.42,
      strength: Math.random(),
      hostile: Math.random() < 0.12,
    });
  }
  let sweep = 0;
  env.g.background(3, 1, 5);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    const cx = w / 2;
    const cy = h / 2;
    const R = w * 0.46;

    g.noStroke();
    g.fill(3, 1, 5, 22);
    g.rect(0, 0, w, h);

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, 1);

    g.noFill();
    g.strokeWeight(1);
    g.stroke(r, gg, bl, 46);
    for (let i = 1; i <= 4; i++) g.circle(cx, cy, (R * 2 * i) / 4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.line(cx, cy, cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    }

    const prev = sweep;
    sweep += dt * (1.1 + alert * 2.6);
    g.noStroke();
    for (let k = 0; k < 16; k++) {
      const a0 = sweep - (k / 16) * 0.9;
      g.fill(r, gg, bl, 44 * (1 - k / 16));
      g.beginShape();
      g.vertex(cx, cy);
      for (let s = 0; s <= 4; s++) {
        const a = a0 - (s / 4) * 0.06;
        g.vertex(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      }
      g.endShape(p.CLOSE);
    }

    for (const b of blips) {
      const crossed =
        ((b.a - prev + Math.PI * 6) % (Math.PI * 2)) >
        ((b.a - sweep + Math.PI * 6) % (Math.PI * 2));
      if (crossed) b.strength = 1;
      b.strength = Math.max(0, b.strength - dt * 0.32);
      b.a += dt * 0.05 * (b.hostile ? 2.4 : 1);

      const x = cx + Math.cos(b.a) * b.r * R * 2;
      const y = cy + Math.sin(b.a) * b.r * R * 2;
      const s = b.strength;
      if (s <= 0.01) continue;
      g.noStroke();
      if (b.hostile) g.fill(hr, hg, hb, 220 * s);
      else g.fill(r, gg, bl, 190 * s);
      g.circle(x, y, 4 + s * 6);
      if (b.hostile && s > 0.4) {
        g.noFill();
        g.stroke(hr, hg, hb, 180 * s);
        g.strokeWeight(1);
        g.circle(x, y, 16 + (1 - s) * 26);
      }
    }

    floorVignette(g, w, h);
  };
}

export const SEC_SKETCHES: DeptSketches = {
  board: {
    label: "INTRUSION VECTOR FIELD // PERLIN ADVECTION",
    width: 528,
    height: 352,
    fps: 24,
    create: createFlowField,
  },
  floor: {
    label: "SCOPE FLOOR",
    width: 384,
    height: 384,
    fps: 14,
    create: createRadarFloor,
  },
};
