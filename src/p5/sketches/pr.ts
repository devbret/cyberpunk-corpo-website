import {
  createPixelLayer,
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

const GW = 148;
const GH = 92;
const DISSENT: [number, number, number] = [255, 45, 111];

function createOpinionField() {
  const n = GW * GH;
  let cur = new Float32Array(n);
  let next = new Float32Array(n);
  for (let i = 0; i < n; i++) cur[i] = 0.22 + Math.random() * 0.3;

  const layer = createPixelLayer(GW, GH);
  const px = layer.data.data;
  const history: number[] = [];
  let sinceSeed = 0;

  const seed = (count: number, value: number) => {
    for (let s = 0; s < count; s++) {
      const cx = Math.floor(Math.random() * GW);
      const cy = Math.floor(Math.random() * GH);
      const r = 2 + Math.floor(Math.random() * 5);
      for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
          if (x * x + y * y > r * r) continue;
          const i = ((cy + y + GH) % GH) * GW + ((cx + x + GW) % GW);
          cur[i] = value;
        }
      }
    }
  };

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;

    for (let y = 0; y < GH; y++) {
      const up = ((y - 1 + GH) % GH) * GW;
      const dn = ((y + 1) % GH) * GW;
      const mid = y * GW;
      for (let x = 0; x < GW; x++) {
        const l = (x - 1 + GW) % GW;
        const r2 = (x + 1) % GW;
        const i = mid + x;
        const avg =
          (cur[mid + l] + cur[mid + r2] + cur[up + x] + cur[dn + x]) * 0.25;
        const v = cur[i] + (avg - cur[i]) * 0.34 - 0.0022 + (Math.random() - 0.5) * 0.012;
        next[i] = v < 0.04 ? 0.04 : v > 1 ? 1 : v;
      }
    }
    const t = cur;
    cur = next;
    next = t;

    sinceSeed += dt;
    if (sinceSeed > (alert > 0.5 ? 0.1 : 1.4)) {
      sinceSeed = 0;
      seed(alert > 0.5 ? 9 : 2, 1);
      if (alert < 0.3 && Math.random() < 0.4) seed(1, 0.05);
    }

    const [ar, ag, ab] = e.rgb;
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = cur[i];
      sum += v;
      const o = i * 4;
      px[o] = DISSENT[0] + (ar - DISSENT[0]) * v;
      px[o + 1] = DISSENT[1] + (ag - DISSENT[1]) * v;
      px[o + 2] = DISSENT[2] + (ab - DISSENT[2]) * v;
      px[o + 3] = 255;
    }
    layer.commit(g, w, h);

    const sentiment = sum / n;
    history.push(sentiment);
    if (history.length > 150) history.shift();

    const sh = 46;
    g.noStroke();
    g.fill(2, 10, 6, 205);
    g.rect(0, h - sh, w, sh);
    g.noFill();
    g.stroke(ar, ag, ab, 220);
    g.strokeWeight(1.6);
    g.beginShape();
    for (let i = 0; i < history.length; i++) {
      g.vertex(
        (i / Math.max(1, history.length - 1)) * w,
        h - 8 - history[i] * (sh - 18),
      );
    }
    g.endShape();

    g.noStroke();
    g.fill(ar, ag, ab);
    g.textFont("monospace");
    g.textSize(12);
    g.textAlign(p.LEFT, p.TOP);
    g.text(`SENTIMENT ${(sentiment * 100).toFixed(1)}%`, 10, h - sh + 6);
    g.textAlign(p.RIGHT, p.TOP);
    g.fill(alert > 0.4 ? DISSENT[0] : ar, alert > 0.4 ? 200 : ag, ab);
    g.text(
      alert > 0.4 ? "PUSH ACTIVE // ALL TIERS" : "ORGANIC DRIFT",
      w - 10,
      h - sh + 6,
    );
  };
}

function createReachFloor() {
  const SECTORS = 72;
  const reach = new Float32Array(SECTORS);
  for (let i = 0; i < SECTORS; i++) reach[i] = 0.2 + Math.random() * 0.2;
  let sincePush = 0;

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(2, 10, 6);

    const cx = w / 2;
    const cy = h / 2;
    const [ar, ag, ab] = e.rgb;

    sincePush += dt;
    if (sincePush > (alert > 0.5 ? 0.35 : 2.2)) {
      sincePush = 0;
      const start = Math.floor(Math.random() * SECTORS);
      const width = 4 + Math.floor(Math.random() * (alert > 0.5 ? 26 : 9));
      for (let k = 0; k < width; k++) {
        reach[(start + k) % SECTORS] = 1;
      }
    }
    for (let i = 0; i < SECTORS; i++) {
      reach[i] = Math.max(0.12, reach[i] - dt * 0.16);
    }

    g.noStroke();
    for (let i = 0; i < SECTORS; i++) {
      const a0 = (i / SECTORS) * Math.PI * 2;
      const a1 = ((i + 1) / SECTORS) * Math.PI * 2;
      const rr = w * 0.1 + reach[i] * w * 0.36;
      const v = reach[i];
      g.fill(
        DISSENT[0] + (ar - DISSENT[0]) * v,
        DISSENT[1] + (ag - DISSENT[1]) * v,
        DISSENT[2] + (ab - DISSENT[2]) * v,
        85 + v * 150,
      );
      g.beginShape();
      g.vertex(cx, cy);
      g.vertex(cx + Math.cos(a0) * rr, cy + Math.sin(a0) * rr);
      g.vertex(cx + Math.cos(a1) * rr, cy + Math.sin(a1) * rr);
      g.endShape(p.CLOSE);
    }

    g.noFill();
    g.strokeWeight(1);
    for (let i = 1; i <= 5; i++) {
      g.stroke(ar, ag, ab, 78);
      g.circle(cx, cy, (w * 0.92 * i) / 5);
    }

    const [hr, hg, hb] = tint(e.rgb, alert);
    g.stroke(hr, hg, hb, 120);
    g.strokeWeight(1.4);
    const pulse = ((e.t * 0.35) % 1) * w * 0.5;
    g.circle(cx, cy, pulse * 2);

    floorVignette(g, w, h);
  };
}

export const PR_SKETCHES: DeptSketches = {
  board: {
    label: "OPINION FIELD // CONSENSUS SIM",
    width: 528,
    height: 352,
    fps: 20,
    create: createOpinionField,
  },
  floor: {
    label: "REACH FLOOR",
    width: 384,
    height: 384,
    fps: 12,
    create: createReachFloor,
  },
};
