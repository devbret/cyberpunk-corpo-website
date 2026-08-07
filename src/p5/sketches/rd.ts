import {
  createPixelLayer,
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

const GW = 160;
const GH = 107;

function createReactionDiffusion() {
  const n = GW * GH;
  let a = new Float32Array(n).fill(1);
  let b = new Float32Array(n).fill(0);
  let a2 = new Float32Array(n).fill(1);
  let b2 = new Float32Array(n).fill(0);

  const seed = (count: number) => {
    for (let s = 0; s < count; s++) {
      const cx = 6 + Math.floor(Math.random() * (GW - 12));
      const cy = 6 + Math.floor(Math.random() * (GH - 12));
      const r = 2 + Math.floor(Math.random() * 4);
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const i = ((cy + y + GH) % GH) * GW + ((cx + x + GW) % GW);
          b[i] = 1;
        }
      }
    }
  };
  seed(16);

  const layer = createPixelLayer(GW, GH);
  const px = layer.data.data;
  let sinceSeed = 0;
  let warmup = 1500;

  const step = (feed: number, kill: number) => {
    const dA = 1.0;
    const dB = 0.5;
    for (let y = 0; y < GH; y++) {
      const yUp = ((y - 1 + GH) % GH) * GW;
      const yDn = ((y + 1) % GH) * GW;
      const yMid = y * GW;
      for (let x = 0; x < GW; x++) {
        const xL = (x - 1 + GW) % GW;
        const xR = (x + 1) % GW;
        const i = yMid + x;

        const lapA =
          a[i] * -1 +
          (a[yMid + xL] + a[yMid + xR] + a[yUp + x] + a[yDn + x]) * 0.2 +
          (a[yUp + xL] + a[yUp + xR] + a[yDn + xL] + a[yDn + xR]) * 0.05;
        const lapB =
          b[i] * -1 +
          (b[yMid + xL] + b[yMid + xR] + b[yUp + x] + b[yDn + x]) * 0.2 +
          (b[yUp + xL] + b[yUp + xR] + b[yDn + xL] + b[yDn + xR]) * 0.05;

        const av = a[i];
        const bv = b[i];
        const abb = av * bv * bv;

        a2[i] = av + (dA * lapA - abb + feed * (1 - av));
        b2[i] = bv + (dB * lapB + abb - (kill + feed) * bv);
        if (a2[i] < 0) a2[i] = 0;
        else if (a2[i] > 1) a2[i] = 1;
        if (b2[i] < 0) b2[i] = 0;
        else if (b2[i] > 1) b2[i] = 1;
      }
    }
    const ta = a;
    a = a2;
    a2 = ta;
    const tb = b;
    b = b2;
    b2 = tb;
  };

  return (e: SketchEnv) => {
    const { g, w, h, alert } = e;

    const feed = 0.0545 - alert * 0.0285;
    const kill = 0.062 - alert * 0.0068;
    const catchUp = warmup > 0 ? Math.min(60, warmup) : 0;
    warmup -= catchUp;
    const iterations = 8 + Math.round(alert * 8) + catchUp;
    for (let k = 0; k < iterations; k++) step(feed, kill);

    sinceSeed += e.dt;
    if (sinceSeed > (alert > 0.5 ? 0.6 : 5.5)) {
      sinceSeed = 0;
      seed(alert > 0.5 ? 4 : 1);
    }

    const [r, gg, bl] = tint(e.rgb, alert * 0.85);
    for (let i = 0; i < n; i++) {
      const v = b[i];
      const s = Math.min(1, Math.sqrt(v * 2.6));
      const o = i * 4;
      px[o] = 10 + r * s;
      px[o + 1] = 15 + gg * s;
      px[o + 2] = 24 + bl * s;
      px[o + 3] = 255;
    }
    layer.commit(g, w, h);

    g.noStroke();
    g.fill(4, 8, 14, 190);
    g.rect(0, h - 26, w, 26);
    g.fill(r, gg, bl);
    g.textFont("monospace");
    g.textSize(13);
    g.textAlign(e.p.LEFT, e.p.CENTER);
    g.text(
      `F ${feed.toFixed(4)}   K ${kill.toFixed(4)}   ITER ${iterations}`,
      10,
      h - 13,
    );
    g.textAlign(e.p.RIGHT, e.p.CENTER);
    g.text(alert > 0.5 ? "MITOTIC // UNCONTAINED" : "CORAL // STABLE", w - 10, h - 13);
  };
}

type Colony = { x: number; y: number; r: number; max: number; seedN: number; age: number };

function createColonies(env: SketchEnv) {
  const colonies: Colony[] = [];
  const spawn = (w: number, h: number, grown = false) => {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.pow(Math.random(), 0.6) * w * 0.42;
    const max = 16 + Math.random() * 58;
    colonies.push({
      x: w / 2 + Math.cos(ang) * rad,
      y: h / 2 + Math.sin(ang) * rad,
      r: grown ? max * (0.3 + Math.random() * 0.6) : 1,
      max,
      seedN: Math.random() * 1000,
      age: grown ? 2 + Math.random() * 9 : 0,
    });
  };
  for (let i = 0; i < 22; i++) spawn(env.w, env.h, true);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(6, 3, 12);

    const [r, gg, bl] = tint(e.rgb, alert * 0.7);

    for (let i = colonies.length - 1; i >= 0; i--) {
      const c = colonies[i];
      c.age += dt;
      c.r += dt * (3.5 + alert * 12) * (1 - c.r / c.max);
      if (c.r > c.max * 0.985 && c.age > 14) {
        colonies.splice(i, 1);
        continue;
      }

      const fade = Math.min(1, c.age * 0.5);
      g.noStroke();
      for (let ring = 0; ring < 3; ring++) {
        const rr = c.r * (1 - ring * 0.28);
        const alpha = (46 + ring * 58) * fade;
        g.fill(r, gg, bl, alpha);
        g.beginShape();
        for (let k = 0; k <= 26; k++) {
          const a = (k / 26) * Math.PI * 2;
          const wob =
            0.72 +
            p.noise(
              c.seedN + Math.cos(a) * 1.1,
              c.seedN + Math.sin(a) * 1.1,
              e.t * 0.12 + ring * 0.4,
            ) *
              0.7;
          g.vertex(c.x + Math.cos(a) * rr * wob, c.y + Math.sin(a) * rr * wob);
        }
        g.endShape(p.CLOSE);
      }

      g.fill(r, gg, bl, 150 * fade);
      g.circle(c.x, c.y, 2.4);
    }

    if (colonies.length < (alert > 0.5 ? 34 : 18) && Math.random() < 0.35) {
      spawn(w, h);
    }

    floorVignette(g, w, h);
  };
}

export const RD_SKETCHES: DeptSketches = {
  board: {
    label: "MORPHOGENESIS ARRAY // GRAY-SCOTT",
    width: 528,
    height: 352,
    fps: 20,
    create: createReactionDiffusion,
  },
  floor: {
    label: "CULTURE FLOOR",
    width: 384,
    height: 384,
    fps: 12,
    create: createColonies,
  },
};
