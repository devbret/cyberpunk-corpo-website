import {
  floorVignette,
  highlight,
  tint,
  type DeptSketches,
  type P5Graphics,
  type SketchEnv,
} from "./types";

function marchingSquares(
  g: P5Graphics,
  field: Float32Array,
  gw: number,
  gh: number,
  threshold: number,
  sx: number,
  sy: number,
): void {
  const at = (x: number, y: number) => field[y * gw + x];

  for (let y = 0; y < gh - 1; y++) {
    for (let x = 0; x < gw - 1; x++) {
      const a = at(x, y);
      const b = at(x + 1, y);
      const c = at(x + 1, y + 1);
      const d = at(x, y + 1);

      let idx = 0;
      if (a > threshold) idx |= 8;
      if (b > threshold) idx |= 4;
      if (c > threshold) idx |= 2;
      if (d > threshold) idx |= 1;
      if (idx === 0 || idx === 15) continue;

      const lerp = (p: number, q: number) => {
        const den = q - p;
        return Math.abs(den) < 1e-6 ? 0.5 : (threshold - p) / den;
      };
      const top = { x: (x + lerp(a, b)) * sx, y: y * sy };
      const right = { x: (x + 1) * sx, y: (y + lerp(b, c)) * sy };
      const bottom = { x: (x + lerp(d, c)) * sx, y: (y + 1) * sy };
      const left = { x: x * sx, y: (y + lerp(a, d)) * sy };

      const seg = (p: { x: number; y: number }, q: { x: number; y: number }) =>
        g.line(p.x, p.y, q.x, q.y);

      switch (idx) {
        case 1:
        case 14:
          seg(left, bottom);
          break;
        case 2:
        case 13:
          seg(bottom, right);
          break;
        case 3:
        case 12:
          seg(left, right);
          break;
        case 4:
        case 11:
          seg(top, right);
          break;
        case 6:
        case 9:
          seg(top, bottom);
          break;
        case 7:
        case 8:
          seg(left, top);
          break;
        case 5:
          seg(left, top);
          seg(bottom, right);
          break;
        case 10:
          seg(left, bottom);
          seg(top, right);
          break;
      }
    }
  }
}

const GW = 66;
const GH = 44;

function createSurvey() {
  const field = new Float32Array(GW * GH);
  const sites = Array.from({ length: 6 }, () => ({
    x: 0.12 + Math.random() * 0.76,
    y: 0.15 + Math.random() * 0.7,
  }));
  let live = 0;
  let sinceSwitch = 0;

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(6, 10, 2);

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = highlight(e.rgb, alert);
    const z = e.t * (0.035 + alert * 0.11);

    for (let y = 0; y < GH; y++) {
      for (let x = 0; x < GW; x++) {
        field[y * GW + x] = p.noise(x * 0.075, y * 0.075, z);
      }
    }

    const sx = w / (GW - 1);
    const sy = (h - 34) / (GH - 1);

    g.noFill();
    for (let i = 1; i <= 8; i++) {
      const level = 0.28 + i * 0.048;
      const a = 34 + i * 15;
      g.stroke(r, gg, bl, a);
      g.strokeWeight(i % 4 === 0 ? 1.6 : 1);
      marchingSquares(g, field, GW, GH, level, sx, sy);
    }

    const scan = ((e.t * 0.16) % 1) * (h - 34);
    g.stroke(hr, hg, hb, 150);
    g.strokeWeight(1.6);
    g.line(0, scan, w, scan);
    g.noStroke();
    g.fill(hr, hg, hb, 26);
    g.rect(0, scan - 12, w, 12);

    sinceSwitch += dt;
    if (sinceSwitch > 4) {
      sinceSwitch = 0;
      live = (live + 1) % sites.length;
    }
    for (let i = 0; i < sites.length; i++) {
      const a = sites[i];
      const b = sites[(i + 2) % sites.length];
      const hot = i === live;
      g.stroke(
        hot ? hr : r,
        hot ? hg : gg,
        hot ? hb : bl,
        hot ? 190 : 70 + alert * 60,
      );
      g.strokeWeight(hot ? 1.8 : 1);
      const ax = a.x * w;
      const ay = a.y * (h - 34);
      const bx = b.x * w;
      const by = b.y * (h - 34);
      g.line(ax, ay, bx, by);

      const t = (e.t * (0.28 + alert * 0.5) + i * 0.17) % 1;
      g.noStroke();
      g.fill(hot ? hr : r, hot ? hg : gg, hot ? hb : bl, 235);
      g.circle(ax + (bx - ax) * t, ay + (by - ay) * t, hot ? 6 : 4);
    }

    for (let i = 0; i < sites.length; i++) {
      const s = sites[i];
      const x = s.x * w;
      const y = s.y * (h - 34);
      const hot = i === live;
      g.noFill();
      g.stroke(hot ? hr : r, hot ? hg : gg, hot ? hb : bl, 220);
      g.strokeWeight(1.4);
      const rr = hot ? 10 + Math.sin(e.t * 6) * 2.5 : 7;
      g.circle(x, y, rr * 2);
      g.line(x - rr - 4, y, x - rr + 2, y);
      g.line(x + rr - 2, y, x + rr + 4, y);
      g.noStroke();
      g.fill(hot ? hr : r, hot ? hg : gg, hot ? hb : bl, 220);
      g.textFont("monospace");
      g.textSize(9);
      g.textAlign(p.LEFT, p.CENTER);
      g.text(`OBJ-${i + 1}`, x + rr + 7, y);
    }

    g.noStroke();
    g.fill(6, 10, 2, 215);
    g.rect(0, h - 26, w, 26);
    g.fill(alert > 0.4 ? hr : r, alert > 0.4 ? hg : gg, alert > 0.4 ? hb : bl);
    g.textFont("monospace");
    g.textSize(13);
    g.textAlign(p.LEFT, p.CENTER);
    g.text(`GRID ${GW}×${GH}   ISO 8`, 10, h - 13);
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(alert > 0.4 ? `LANE HOT // OBJ-${live + 1}` : "SURVEY NOMINAL", w - 10, h - 13);
  };
}

const FGW = 52;
const FGH = 52;

function createTopoFloor() {
  const field = new Float32Array(FGW * FGH);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert } = e;
    g.background(5, 9, 2);

    const [r, gg, bl] = tint(e.rgb, alert * 0.6);
    const z = e.t * 0.02;
    for (let y = 0; y < FGH; y++) {
      for (let x = 0; x < FGW; x++) {
        field[y * FGW + x] = p.noise(x * 0.09, y * 0.09, z);
      }
    }

    const sx = w / (FGW - 1);
    const sy = h / (FGH - 1);
    g.noFill();
    for (let i = 1; i <= 9; i++) {
      g.stroke(r, gg, bl, 58 + i * 16);
      g.strokeWeight(i % 3 === 0 ? 1.5 : 1);
      marchingSquares(g, field, FGW, FGH, 0.26 + i * 0.045, sx, sy);
    }

    const cx = w / 2;
    const cy = h / 2;
    const a = e.t * (0.35 + alert * 0.9);
    g.stroke(r, gg, bl, 130);
    g.strokeWeight(1.6);
    g.line(cx, cy, cx + Math.cos(a) * w * 0.46, cy + Math.sin(a) * w * 0.46);
    g.noStroke();
    g.fill(r, gg, bl, 150);
    g.circle(cx, cy, 6);

    floorVignette(g, w, h);
  };
}

export const OPS_SKETCHES: DeptSketches = {
  board: {
    label: "THEATRE SURVEY // MARCHING SQUARES",
    width: 528,
    height: 352,
    fps: 18,
    create: createSurvey,
  },
  floor: {
    label: "TOPO FLOOR",
    width: 384,
    height: 384,
    fps: 10,
    create: createTopoFloor,
  },
};
