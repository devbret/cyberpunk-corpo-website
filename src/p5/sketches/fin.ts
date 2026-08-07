import {
  floorVignette,
  tint,
  type DeptSketches,
  type SketchEnv,
} from "./types";

type Candle = { o: number; h: number; l: number; c: number; vol: number };

function createCandles() {
  const MAX = 58;
  const candles: Candle[] = [];
  let price = 62;
  let vel = 0;
  let current: Candle = { o: price, h: price, l: price, c: price, vol: 0 };
  let sinceCandle = 0;
  const ma: number[] = [];

  const push = () => {
    candles.push(current);
    if (candles.length > MAX) candles.shift();
    const window = candles.slice(-9);
    ma.push(window.reduce((s, k) => s + k.c, 0) / window.length);
    if (ma.length > MAX) ma.shift();
    current = { o: price, h: price, l: price, c: price, vol: 0 };
  };
  for (let i = 0; i < MAX; i++) {
    price += (Math.random() - 0.5) * 3;
    current = { o: price, h: price + 1, l: price - 1, c: price, vol: Math.random() };
    push();
  }

  return (e: SketchEnv) => {
    const { g, p, w, h, alert, dt } = e;
    g.background(10, 6, 2);

    const [r, gg, bl] = e.rgb;
    const [dr, dg, db] = tint(e.rgb, 1);

    vel += (Math.random() - 0.5) * 1.9 - (price - 60) * 0.012 - alert * 1.5;
    vel *= 0.87;
    price = Math.max(6, Math.min(118, price + vel));
    current.c = price;
    current.h = Math.max(current.h, price);
    current.l = Math.min(current.l, price);
    current.vol += Math.abs(vel) * 0.1;

    sinceCandle += dt;
    if (sinceCandle > 0.42) {
      sinceCandle = 0;
      push();
    }

    const padL = 8;
    const padR = 84;
    const chartW = w - padL - padR;
    const chartH = h - 74;
    const cw = chartW / MAX;

    let lo = Infinity;
    let hi = -Infinity;
    for (const k of candles) {
      lo = Math.min(lo, k.l);
      hi = Math.max(hi, k.h);
    }
    const span = Math.max(6, hi - lo) * 1.12;
    const mid = (hi + lo) / 2;
    const yOf = (v: number) => 30 + chartH * (1 - (v - (mid - span / 2)) / span);

    g.strokeWeight(1);
    g.stroke(r, gg, bl, 26);
    for (let i = 0; i <= 5; i++) {
      const y = 30 + (chartH * i) / 5;
      g.line(padL, y, padL + chartW, y);
    }

    for (let i = 0; i < candles.length; i++) {
      const k = candles[i];
      const x = padL + i * cw + cw / 2;
      const up = k.c >= k.o;
      if (up && alert < 0.5) g.stroke(r, gg, bl, 220);
      else g.stroke(dr, dg, db, 220);
      g.strokeWeight(1);
      g.line(x, yOf(k.h), x, yOf(k.l));
      g.strokeWeight(Math.max(1.6, cw * 0.62));
      const yo = yOf(k.o);
      const yc = yOf(k.c);
      g.line(x, Math.min(yo, yc), x, Math.max(yo, yc) + 0.6);

      g.strokeWeight(Math.max(1.4, cw * 0.5));
      g.stroke(r, gg, bl, 60);
      const vh = Math.min(26, k.vol * 40);
      g.line(x, h - 30, x, h - 30 - vh);
    }

    g.noFill();
    g.stroke(255, 255, 255, 150);
    g.strokeWeight(1.4);
    g.beginShape();
    for (let i = 0; i < ma.length; i++) {
      g.vertex(padL + i * cw + cw / 2, yOf(ma[i]));
    }
    g.endShape();

    const rows = 11;
    for (let i = 0; i < rows; i++) {
      const y = 34 + i * ((chartH - 8) / rows);
      const sell = i < rows / 2;
      const depth =
        (0.25 + p.noise(i * 0.6, e.t * 0.7) * 0.75) *
        (sell ? 1 + alert * 1.9 : 1 - alert * 0.5);
      const bw = Math.max(2, depth * (padR - 22));
      g.noStroke();
      if (sell) g.fill(dr, dg, db, 130);
      else g.fill(r, gg, bl, 130);
      g.rect(w - padR + 8, y, bw, 6);
    }

    g.noStroke();
    g.fill(10, 6, 2, 220);
    g.rect(0, 0, w, 28);
    g.fill(alert > 0.4 ? dr : r, alert > 0.4 ? dg : gg, alert > 0.4 ? db : bl);
    g.textFont("monospace");
    g.textSize(15);
    g.textAlign(p.LEFT, p.CENTER);
    g.text(`KSN  ${price.toFixed(2)}`, 10, 14);
    g.textSize(12);
    g.textAlign(p.RIGHT, p.CENTER);
    g.text(
      `${vel >= 0 ? "▲" : "▼"}${Math.abs(vel).toFixed(3)}   ${
        alert > 0.4 ? "LIQUIDITY EVENT" : "BOOK NOMINAL"
      }`,
      w - 10,
      14,
    );
  };
}

function createLedgerFloor() {
  const BANDS = 7;
  const rows: string[] = [];
  const glyphs = "0123456789";
  for (let i = 0; i < BANDS; i++) {
    let s = "";
    for (let k = 0; k < 150; k++) {
      s +=
        Math.random() < 0.14
          ? " // "
          : glyphs[(Math.random() * glyphs.length) | 0];
    }
    rows.push(s);
  }
  const spin = rows.map(() => (Math.random() - 0.5) * 0.12);

  return (e: SketchEnv) => {
    const { g, p, w, h, alert } = e;
    g.background(12, 7, 2);

    const cx = w / 2;
    const cy = h / 2;
    const [r, gg, bl] = tint(e.rgb, alert * 0.8);

    g.noFill();
    g.strokeWeight(1);
    g.stroke(r, gg, bl, 78);
    for (let i = 1; i <= BANDS + 1; i++) {
      g.circle(cx, cy, ((w * 0.92) / (BANDS + 1)) * i);
    }

    g.noStroke();
    g.textFont("monospace");
    g.textAlign(p.CENTER, p.CENTER);

    for (let i = 0; i < BANDS; i++) {
      const radius = (w * 0.46 * (i + 1.6)) / (BANDS + 1.6);
      const size = 9 + i * 0.7;
      g.textSize(size);
      const chars = Math.max(24, Math.floor((Math.PI * 2 * radius) / (size * 0.72)));
      const rot = e.t * spin[i] * (1 + alert * 3);
      const row = rows[i];
      g.fill(r, gg, bl, 140 + i * 10);
      for (let k = 0; k < chars; k++) {
        const a = (k / chars) * Math.PI * 2 + rot;
        const ch = row[(k + i * 7) % row.length];
        g.push();
        g.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
        g.rotate(a + Math.PI / 2);
        g.text(ch, 0, 0);
        g.pop();
      }
    }

    floorVignette(g, w, h);
  };
}

export const FIN_SKETCHES: DeptSketches = {
  board: {
    label: "ORDER BOOK // LIVE OHLC",
    width: 528,
    height: 352,
    fps: 22,
    create: createCandles,
  },
  floor: {
    label: "LEDGER FLOOR",
    width: 384,
    height: 384,
    fps: 10,
    create: createLedgerFloor,
  },
};
