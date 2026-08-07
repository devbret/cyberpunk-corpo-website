import {
  createPixelLayer,
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

const GW = 132;
const GH = 88;

function createFrostGrowth() {
  const n = GW * GH;
  const grid = new Int32Array(n);
  let frozen = 0;
  let age = 0;
  let radius = 3;

  const cx = GW >> 1;
  const cy = GH >> 1;
  grid[cy * GW + cx] = 1;
  frozen = 1;

  const layer = createPixelLayer(GW, GH);
  const px = layer.data.data;

  const occupied = (x: number, y: number) =>
    x >= 0 && x < GW && y >= 0 && y < GH && grid[y * GW + x] !== 0;

  const touching = (x: number, y: number) =>
    occupied(x - 1, y) ||
    occupied(x + 1, y) ||
    occupied(x, y - 1) ||
    occupied(x, y + 1);

  const walk = (budget: number): number => {
    const a = Math.random() * Math.PI * 2;
    const spawnR = Math.min(radius + 3, Math.min(cx, cy) - 2);
    let x = Math.round(cx + Math.cos(a) * spawnR);
    let y = Math.round(cy + Math.sin(a) * spawnR);
    const killR = spawnR + 10;

    for (let step = 0; step < budget; step++) {
      if (touching(x, y)) {
        if (occupied(x, y)) return step;
        age++;
        grid[y * GW + x] = age;
        frozen++;
        const d = Math.hypot(x - cx, y - cy);
        if (d > radius) radius = d;
        return step;
      }
      const d = Math.hypot(x - cx, y - cy);
      const jump = d > radius + 2 ? Math.max(1, Math.floor((d - radius) * 0.6)) : 1;
      x += ((Math.random() * 3) | 0) * jump - jump;
      y += ((Math.random() * 3) | 0) * jump - jump;
      if (d > killR || x < 1 || y < 1 || x >= GW - 1 || y >= GH - 1) return step;
    }
    return budget;
  };

  const melt = (fraction: number) => {
    const cutoff = age * (1 - fraction);
    for (let i = 0; i < n; i++) {
      if (grid[i] > cutoff && Math.random() < 0.55) {
        grid[i] = 0;
        frozen--;
      }
    }
    radius = Math.max(3, radius * (1 - fraction * 0.45));
  };

  let lastAlert = 0;
  let warmup = 34;

  return (e: SketchEnv) => {
    const { g, p, w, h, alert } = e;

    if (alert > 0.5 && lastAlert <= 0.5) melt(0.4);
    lastAlert = alert;

    const catchUp = warmup > 0;
    if (catchUp) warmup--;
    let steps = 0;
    const cap = catchUp ? 140000 : 26000;
    while (steps < cap && frozen < n * 0.14) {
      steps += walk(260) + 1;
    }

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, alert);
    for (let i = 0; i < n; i++) {
      const v = grid[i];
      const o = i * 4;
      if (v === 0) {
        px[o] = 3;
        px[o + 1] = 8;
        px[o + 2] = 16;
        px[o + 3] = 255;
      } else {
        const k = 0.35 + 0.65 * (v / Math.max(1, age));
        px[o] = (r + (hr - r) * alert) * k + 40 * k;
        px[o + 1] = (gg + (hg - gg) * alert) * k + 55 * k;
        px[o + 2] = (bl + (hb - bl) * alert) * k + 70 * k;
        px[o + 3] = 255;
      }
    }
    layer.commit(g, w, h);

    g.noStroke();
    g.fill(3, 8, 16, 205);
    g.rect(0, h - 26, w, 26);
    g.fill(alert > 0.4 ? hr : r, alert > 0.4 ? hg : gg, alert > 0.4 ? hb : bl);
    g.textFont("monospace");
    g.textSize(13);
    g.textAlign(p.LEFT, p.CENTER);
    g.text(
      `LATTICE ${frozen}   R ${radius.toFixed(0)}`,
      10,
      h - 13,
    );
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(alert > 0.4 ? "THAW // LATTICE STRAIN" : "AGGREGATION NOMINAL", w - 10, h - 13);
  };
}

function createRimeFloor(env: SketchEnv) {
  type Branch = { x: number; y: number; a: number; len: number; gen: number };
  let branches: Branch[] = [];
  const drawn: Branch[] = [];

  const reseed = (w: number, h: number) => {
    branches = [];
    drawn.length = 0;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + Math.random() * 0.3;
      branches.push({ x: w / 2, y: h / 2, a, len: 7 + Math.random() * 5, gen: 0 });
    }
  };
  reseed(env.w, env.h);
  let lastAlert = 0;

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(2, 7, 14);

    if (alert > 0.5 && lastAlert <= 0.5) reseed(w, h);
    lastAlert = alert;

    const [r, gg, bl] = tint(e.rgb, alert * 0.5);

    const grow = Math.min(26, Math.ceil(dt * 90));
    for (let k = 0; k < grow && branches.length; k++) {
      const b = branches.shift();
      if (!b) break;
      const nx = b.x + Math.cos(b.a) * b.len;
      const ny = b.y + Math.sin(b.a) * b.len;
      drawn.push(b);
      if (
        b.gen < 9 &&
        Math.hypot(nx - w / 2, ny - h / 2) < w * 0.47 &&
        drawn.length < 2600
      ) {
        const wobble = (p.noise(nx * 0.01, ny * 0.01, e.t * 0.05) - 0.5) * 0.9;
        branches.push({
          x: nx,
          y: ny,
          a: b.a + wobble,
          len: b.len * 0.97,
          gen: b.gen + 1,
        });
        if (Math.random() < 0.22) {
          branches.push({
            x: nx,
            y: ny,
            a: b.a + (Math.random() < 0.5 ? 0.62 : -0.62),
            len: b.len * 0.72,
            gen: b.gen + 2,
          });
        }
      }
    }
    if (!branches.length && drawn.length > 2400) reseed(w, h);

    g.strokeCap(p.ROUND);
    for (const b of drawn) {
      const nx = b.x + Math.cos(b.a) * b.len;
      const ny = b.y + Math.sin(b.a) * b.len;
      const fade = 1 - b.gen / 11;
      g.stroke(r + 70 * fade, gg + 60 * fade, bl + 50 * fade, 80 + fade * 165);
      g.strokeWeight(Math.max(0.6, 2.6 - b.gen * 0.26));
      g.line(b.x, b.y, nx, ny);
    }

    g.noStroke();
    g.fill(r + 70, gg + 60, bl + 50, 150);
    g.circle(w / 2, h / 2, 8);

    floorVignette(g, w, h);
  };
}

export const CSG_SKETCHES: DeptSketches = {
  board: {
    label: "CRYO LATTICE // DIFFUSION-LIMITED AGGREGATION",
    width: 528,
    height: 352,
    fps: 16,
    create: createFrostGrowth,
  },
  floor: {
    label: "RIME FLOOR",
    width: 384,
    height: 384,
    fps: 12,
    create: createRimeFloor,
  },
};
