import type P5 from "p5";

export type P5Graphics = {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  drawingContext: CanvasRenderingContext2D;

  pixelDensity(n: number): void;
  loadPixels(): void;
  updatePixels(): void;
  clear(): void;
  remove(): void;

  background(...args: number[]): void;
  fill(...args: number[]): void;
  noFill(): void;
  stroke(...args: number[]): void;
  noStroke(): void;
  strokeWeight(n: number): void;
  strokeCap(kind: unknown): void;
  noSmooth(): void;
  smooth(): void;

  rect(x: number, y: number, w: number, h: number, r?: number): void;
  ellipse(x: number, y: number, w: number, h?: number): void;
  circle(x: number, y: number, d: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  point(x: number, y: number): void;
  triangle(...args: number[]): void;
  arc(...args: number[]): void;

  beginShape(kind?: unknown): void;
  vertex(x: number, y: number): void;
  endShape(kind?: unknown): void;

  push(): void;
  pop(): void;
  translate(x: number, y: number): void;
  rotate(angle: number): void;

  text(str: string, x: number, y: number, w?: number, h?: number): void;
  textSize(n: number): void;
  textAlign(h: unknown, v?: unknown): void;
  textFont(font: unknown): void;
  textWidth(str: string): number;
};

export type SketchEnv = {
  p: P5;
  g: P5Graphics;
  w: number;
  h: number;
  hex: string;
  rgb: [number, number, number];
  alert: number;
  t: number;
  dt: number;
};

export type SketchDraw = (env: SketchEnv) => void;

export type SketchSpec = {
  label: string;
  width: number;
  height: number;
  fps: number;
  create: (env: SketchEnv) => SketchDraw;
};

export type DeptSketches = {
  board: SketchSpec;
  floor: SketchSpec;
};

export const ALERT_RGB: [number, number, number] = [255, 59, 92];

export function tint(
  rgb: [number, number, number],
  alert: number,
): [number, number, number] {
  return [
    rgb[0] + (ALERT_RGB[0] - rgb[0]) * alert,
    rgb[1] + (ALERT_RGB[1] - rgb[1]) * alert,
    rgb[2] + (ALERT_RGB[2] - rgb[2]) * alert,
  ];
}

export function highlight(
  rgb: [number, number, number],
  alert: number,
): [number, number, number] {
  const base: [number, number, number] = [
    Math.min(255, rgb[0] * 0.35 + 190),
    Math.min(255, rgb[1] * 0.35 + 190),
    Math.min(255, rgb[2] * 0.35 + 190),
  ];
  return [
    base[0] + (ALERT_RGB[0] - base[0]) * alert,
    base[1] + (ALERT_RGB[1] - base[1]) * alert,
    base[2] + (ALERT_RGB[2] - base[2]) * alert,
  ];
}

export type PixelLayer = {
  data: ImageData;
  commit: (g: P5Graphics, w: number, h: number) => void;
};

export function createPixelLayer(gw: number, gh: number): PixelLayer {
  const canvas = document.createElement("canvas");
  canvas.width = gw;
  canvas.height = gh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D context not available");
  const data = ctx.createImageData(gw, gh);
  return {
    data,
    commit: (g, w, h) => {
      ctx.putImageData(data, 0, 0);
      const dc = g.drawingContext;
      dc.imageSmoothingEnabled = true;
      dc.drawImage(canvas, 0, 0, w, h);
    },
  };
}

export function floorVignette(g: P5Graphics, w: number, h: number): void {
  const ctx = g.drawingContext;
  const cx = w / 2;
  const cy = h / 2;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const grd = ctx.createRadialGradient(cx, cy, w * 0.26, cx, cy, w * 0.5);
  grd.addColorStop(0.0, "rgba(0,0,0,0)");
  grd.addColorStop(0.72, "rgba(0,0,0,0.30)");
  grd.addColorStop(1.0, "rgba(0,0,0,0.86)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}
