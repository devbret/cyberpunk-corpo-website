import {
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

const TOKENS = 26;

function createAttention() {
  const attn = new Float32Array(TOKENS * TOKENS);
  const target = new Float32Array(TOKENS * TOKENS);
  const acts = new Float32Array(12);
  const stream: string[] = [];
  const GLYPHS = "▚▞▙▛▜▟◤◥◣◢▤▥▦▧";
  for (let i = 0; i < 34; i++) {
    stream.push(GLYPHS[(Math.random() * GLYPHS.length) | 0]);
  }
  let sinceRetarget = 0;

  const retarget = (alert: number) => {
    for (let i = 0; i < TOKENS; i++) {
      let sum = 0;
      for (let j = 0; j <= i; j++) {
        const dist = i - j;
        const local = Math.exp(-dist * (0.55 - alert * 0.44));
        const wander = Math.random() < 0.04 + alert * 0.3 ? Math.random() : 0;
        const v = local + wander;
        target[i * TOKENS + j] = v;
        sum += v;
      }
      for (let j = 0; j <= i; j++) target[i * TOKENS + j] /= sum || 1;
      for (let j = i + 1; j < TOKENS; j++) target[i * TOKENS + j] = 0;
    }
  };
  retarget(0);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(2, 8, 14);

    sinceRetarget += dt;
    if (sinceRetarget > (alert > 0.5 ? 0.22 : 1.1)) {
      sinceRetarget = 0;
      retarget(alert);
    }
    const ease = Math.min(1, dt * 4);
    for (let i = 0; i < attn.length; i++) {
      attn[i] += (target[i] - attn[i]) * ease;
    }

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, 1);

    const pad = 30;
    const size = Math.min(h - pad - 44, w * 0.52);
    const cell = size / TOKENS;
    const ox = pad;
    const oy = pad;

    g.noStroke();
    for (let i = 0; i < TOKENS; i++) {
      for (let j = 0; j < TOKENS; j++) {
        const v = attn[i * TOKENS + j];
        if (v < 0.004) continue;
        const s = Math.min(1, v * 4.2);
        const far = i - j > 6 ? Math.min(1, (i - j) / TOKENS) : 0;
        g.fill(
          r + (hr - r) * far,
          gg + (hg - gg) * far,
          bl + (hb - bl) * far,
          40 + s * 215,
        );
        g.rect(ox + j * cell, oy + i * cell, cell - 0.6, cell - 0.6);
      }
    }

    g.noFill();
    g.stroke(r, gg, bl, 90);
    g.strokeWeight(1);
    g.rect(ox - 1, oy - 1, size + 2, size + 2);

    const bx = ox + size + 26;
    const bw = w - bx - 16;
    for (let i = 0; i < acts.length; i++) {
      const drive =
        p.noise(i * 0.8, e.t * (0.5 + alert * 1.8)) * (0.5 + alert * 0.8) +
        alert * 0.25;
      acts[i] += (drive - acts[i]) * Math.min(1, dt * 3);
      const y = oy + i * ((size - 4) / acts.length);
      const bh = (size - 4) / acts.length - 4;
      g.noStroke();
      g.fill(r, gg, bl, 34);
      g.rect(bx, y, bw, bh);
      g.fill(
        r + (hr - r) * alert,
        gg + (hg - gg) * alert,
        bl + (hb - bl) * alert,
        210,
      );
      g.rect(bx, y, bw * Math.min(1, acts[i]), bh);
      g.fill(r, gg, bl, 150);
      g.textFont("monospace");
      g.textSize(9);
      g.textAlign(p.LEFT, p.CENTER);
      g.text(`L${(i + 1).toString().padStart(2, "0")}`, bx + 4, y + bh / 2);
    }

    const shift = Math.floor(e.t * (6 + alert * 22)) % stream.length;
    g.noStroke();
    g.fill(2, 8, 14, 225);
    g.rect(0, h - 40, w, 40);
    g.textFont("monospace");
    g.textSize(15);
    g.textAlign(p.LEFT, p.CENTER);
    g.fill(r, gg, bl, 190);
    let sx = 10;
    for (let i = 0; i < stream.length; i++) {
      const ch = stream[(i + shift) % stream.length];
      const hot = (i + shift) % 11 === 0;
      g.fill(hot ? hr : r, hot ? hg : gg, hot ? hb : bl, hot ? 235 : 150);
      g.text(ch, sx, h - 26);
      sx += 14;
      if (sx > w - 12) break;
    }

    g.textSize(11);
    g.textAlign(p.LEFT, p.CENTER);
    g.fill(alert > 0.4 ? hr : r, alert > 0.4 ? hg : gg, alert > 0.4 ? hb : bl);
    g.text(
      alert > 0.4
        ? "LONG-RANGE ATTENTION // UNSCHEDULED"
        : "CAUSAL MASK NOMINAL",
      10,
      h - 8,
    );
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(`CTX ${TOKENS}  HEADS 12`, w - 10, h - 8);
  };
}

type Wave = { r: number; strength: number };

function createActivationFloor() {
  const NODES = 150;
  const nodes = Array.from({ length: NODES }, () => {
    const a = Math.random() * Math.PI * 2;
    const rad = Math.pow(Math.random(), 0.55) * 0.46;
    return { a, rad, act: 0 };
  });
  const waves: Wave[] = [];
  let sinceWave = 0;

  return (e: SketchEnv) => {
    const { g, w, h, alert, dt } = e;
    g.background(1, 6, 11);

    const cx = w / 2;
    const cy = h / 2;
    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, alert);

    sinceWave += dt;
    if (sinceWave > (alert > 0.5 ? 0.28 : 1.5)) {
      sinceWave = 0;
      waves.push({ r: 0, strength: 1 });
    }

    g.noFill();
    for (let i = waves.length - 1; i >= 0; i--) {
      const wv = waves[i];
      wv.r += dt * (0.11 + alert * 0.2);
      wv.strength = Math.max(0, 1 - wv.r / 0.52);
      if (wv.strength <= 0) {
        waves.splice(i, 1);
        continue;
      }
      g.stroke(hr, hg, hb, 150 * wv.strength);
      g.strokeWeight(1 + alert * 1.6);
      g.circle(cx, cy, wv.r * w * 2);
    }

    for (const n of nodes) {
      for (const wv of waves) {
        if (Math.abs(n.rad - wv.r) < 0.02) n.act = Math.max(n.act, wv.strength);
      }
      n.act = Math.max(0, n.act - dt * 1.3);
      const x = cx + Math.cos(n.a) * n.rad * w;
      const y = cy + Math.sin(n.a) * n.rad * w;
      g.noStroke();
      g.fill(
        r + (hr - r) * n.act,
        gg + (hg - gg) * n.act,
        bl + (hb - bl) * n.act,
        105 + n.act * 150,
      );
      g.circle(x, y, 2.4 + n.act * 7);
    }

    g.strokeWeight(1);
    for (let i = 0; i < NODES; i += 3) {
      const a = nodes[i];
      const b = nodes[(i * 7 + 13) % NODES];
      const ax = cx + Math.cos(a.a) * a.rad * w;
      const ay = cy + Math.sin(a.a) * a.rad * w;
      const bx = cx + Math.cos(b.a) * b.rad * w;
      const by = cy + Math.sin(b.a) * b.rad * w;
      if (Math.hypot(ax - bx, ay - by) > w * 0.16) continue;
      const act = Math.max(a.act, b.act);
      g.stroke(r, gg, bl, 46 + act * 150);
      g.line(ax, ay, bx, by);
    }

    floorVignette(g, w, h);
  };
}

export const AI_SKETCHES: DeptSketches = {
  board: {
    label: "ATTENTION MATRIX // LIVE HEADS",
    width: 528,
    height: 352,
    fps: 22,
    create: createAttention,
  },
  floor: {
    label: "ACTIVATION FLOOR",
    width: 384,
    height: 384,
    fps: 14,
    create: createActivationFloor,
  },
};
