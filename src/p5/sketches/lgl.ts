import {
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

type Line = {
  kind: "head" | "body" | "gap";
  width: number;
  indent: number;
  redact: number;
  redactTarget: number;
};

const CLAUSE = [
  "NOTWITHSTANDING",
  "THE PARTY",
  "HEREINAFTER",
  "WAIVES ALL CLAIMS",
  "IN PERPETUITY",
  "WITHOUT ADMISSION",
  "SHALL NOT DISCLOSE",
  "BINDING ARBITRATION",
  "EXCLUSIVE VENUE",
  "HOLD HARMLESS",
];

function createInstrument() {
  const lines: Line[] = [];
  const makeLine = (): Line => {
    const roll = Math.random();
    const kind: Line["kind"] = roll < 0.1 ? "head" : roll < 0.16 ? "gap" : "body";
    return {
      kind,
      width: kind === "head" ? 0.3 + Math.random() * 0.22 : 0.3 + Math.random() * 0.68,
      indent: Math.random() < 0.22 ? 0.06 : 0,
      redact: 0,
      redactTarget: Math.random() < 0.34 ? 1 : 0,
    };
  };
  for (let i = 0; i < 46; i++) lines.push(makeLine());

  let scroll = 0;
  let stamp = 0;
  let lastAlert = 0;

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(5, 11, 5);

    const [r, gg, bl] = e.rgb;
    const [hr, hg, hb] = tint(e.rgb, 1);

    if (alert > 0.5 && lastAlert <= 0.5) {
      for (const ln of lines) if (Math.random() < 0.8) ln.redactTarget = 1;
      stamp = 1;
    }
    lastAlert = alert;

    const lineH = 13;
    const pad = 26;
    scroll += dt * (7 + alert * 22);
    if (scroll > lineH) {
      scroll -= lineH;
      lines.push(makeLine());
      lines.shift();
    }

    g.noStroke();
    g.fill(9, 17, 9);
    g.rect(pad * 0.5, 0, w - pad, h);
    g.stroke(r, gg, bl, 60);
    g.strokeWeight(1);
    g.noFill();
    g.rect(pad * 0.5, 0, w - pad, h);

    g.stroke(r, gg, bl, 45);
    g.line(pad * 0.5 + 26, 0, pad * 0.5 + 26, h);

    g.textFont("monospace");
    g.noStroke();

    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      ln.redact += (ln.redactTarget - ln.redact) * Math.min(1, dt * 1.4);

      const y = i * lineH - scroll;
      if (y < -lineH || y > h) continue;

      const x = pad * 0.5 + 34 + ln.indent * w;
      const lw = ln.width * (w - pad - 44);

      if (ln.kind === "gap") continue;

      if (ln.kind === "head") {
        g.fill(r, gg, bl, 220);
        g.textSize(11);
        g.textAlign(p.LEFT, p.CENTER);
        g.text(CLAUSE[i % CLAUSE.length], x, y + lineH / 2);
      } else {
        g.fill(r, gg, bl, 78);
        g.rect(x, y + 4, lw, 4.5);
      }

      if (ln.redact > 0.02) {
        g.fill(0, 0, 0, 240 * Math.min(1, ln.redact));
        g.rect(x - 2, y + 1, lw * Math.min(1, ln.redact) + 5, lineH - 3);
        g.noFill();
        g.stroke(r, gg, bl, 40 * ln.redact);
        g.strokeWeight(1);
        g.rect(x - 2, y + 1, lw * Math.min(1, ln.redact) + 5, lineH - 3);
        g.noStroke();
      }
    }

    if (stamp > 0) {
      stamp = Math.max(0, stamp - dt * 0.5);
      const s = 1 + (1 - stamp) * 0.4;
      g.push();
      g.translate(w * 0.63, h * 0.44);
      g.rotate(-0.28);
      g.noFill();
      g.stroke(hr, hg, hb, 240 * stamp);
      g.strokeWeight(3);
      g.rect(-96 * s, -24 * s, 192 * s, 48 * s, 5);
      g.noStroke();
      g.fill(hr, hg, hb, 240 * stamp);
      g.textSize(24 * s);
      g.textAlign(p.CENTER, p.CENTER);
      g.text("EXECUTED", 0, 0);
      g.pop();
    }

    const redacted =
      lines.reduce((s, l) => s + l.redact, 0) / Math.max(1, lines.length);
    g.noStroke();
    g.fill(5, 11, 5, 215);
    g.rect(0, h - 24, w, 24);
    g.fill(alert > 0.4 ? hr : r, alert > 0.4 ? hg : gg, alert > 0.4 ? hb : bl);
    g.textSize(12);
    g.textAlign(p.LEFT, p.CENTER);
    g.text(`REDACTED ${(redacted * 100).toFixed(0)}%`, 10, h - 12);
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(alert > 0.4 ? "RULING ENTERED" : "DRAFTING", w - 10, h - 12);
  };
}

function createClauseFloor() {
  const BANDS = 6;
  const TEXT =
    "NOTWITHSTANDING ANY PROVISION TO THE CONTRARY THE PARTY WAIVES ALL CLAIMS KNOWN AND UNKNOWN VENUE SHALL BE EXCLUSIVE TERMS REMAIN CONFIDENTIAL ";
  const bars: { band: number; start: number; len: number }[] = [];
  for (let i = 0; i < 22; i++) {
    bars.push({
      band: Math.floor(Math.random() * BANDS),
      start: Math.random(),
      len: 0.02 + Math.random() * 0.09,
    });
  }

  return (e: SketchEnv) => {
    const { g, p, w, h, alert } = e;
    g.background(6, 12, 6);

    const cx = w / 2;
    const cy = h / 2;
    const [r, gg, bl] = tint(e.rgb, alert * 0.55);

    g.noFill();
    g.strokeWeight(1);
    g.stroke(r, gg, bl, 80);
    for (let i = 1; i <= BANDS + 1; i++) {
      g.circle(cx, cy, ((w * 0.94) / (BANDS + 1)) * i);
    }

    g.noStroke();
    g.textFont("monospace");
    g.textAlign(p.CENTER, p.CENTER);

    for (let i = 0; i < BANDS; i++) {
      const radius = (w * 0.47 * (i + 1.5)) / (BANDS + 1.5);
      const size = 8.5 + i * 0.9;
      g.textSize(size);
      const chars = Math.max(
        30,
        Math.floor((Math.PI * 2 * radius) / (size * 0.68)),
      );
      const rot = e.t * (i % 2 === 0 ? 0.024 : -0.018) * (1 + alert * 2);
      g.fill(r, gg, bl, 135 + i * 10);
      for (let k = 0; k < chars; k++) {
        const a = (k / chars) * Math.PI * 2 + rot;
        const ch = TEXT[(k + i * 11) % TEXT.length];
        g.push();
        g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        g.rotate(a + Math.PI / 2);
        g.text(ch, 0, 0);
        g.pop();
      }

      g.noFill();
      g.strokeWeight(size * 1.25);
      for (const b of bars) {
        if (b.band !== i) continue;
        const a0 = b.start * Math.PI * 2 + rot;
        const a1 = a0 + b.len * Math.PI * 2 * (1 + alert * 2.2);
        g.stroke(0, 0, 0, 235);
        g.arc(cx, cy, radius * 2, radius * 2, a0, a1);
      }
      g.noStroke();
    }

    floorVignette(g, w, h);
  };
}

export const LGL_SKETCHES: DeptSketches = {
  board: {
    label: "INSTRUMENT DRAFTER // LIVE REDACTION",
    width: 528,
    height: 352,
    fps: 20,
    create: createInstrument,
  },
  floor: {
    label: "CLAUSE FLOOR",
    width: 384,
    height: 384,
    fps: 10,
    create: createClauseFloor,
  },
};
