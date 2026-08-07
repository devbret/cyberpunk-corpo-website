import * as THREE from "three";
import type P5 from "p5";
import type {
  DeptSketches,
  P5Graphics,
  SketchDraw,
  SketchEnv,
  SketchSpec,
} from "./sketches/types";

export type P5Surfaces = {
  board: THREE.Group;
  update: (dt: number, t: number) => void;
  setAlert: (level: number) => void;
  dispose: () => void;
};

type LiveSketch = {
  spec: SketchSpec;
  g: P5Graphics;
  draw: SketchDraw;
  texture: THREE.CanvasTexture;
  accum: number;
  lastDraw: number;
};

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    return;
  }
}

function makeHiddenHost(): HTMLDivElement {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:absolute;left:-99999px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  return host;
}

function makeCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = false;
  return tex;
}

export function createP5Surfaces(opts: {
  sketches: DeptSketches;
  color: THREE.Color;
  floorMaterial: THREE.MeshStandardMaterial;
  boardWidth?: number;
}): P5Surfaces {
  const { sketches, color, floorMaterial } = opts;
  const boardWidth = opts.boardWidth ?? 6.6;
  const hex = `#${color.getHexString()}`;
  const rgb: [number, number, number] = [
    Math.round(color.r * 255),
    Math.round(color.g * 255),
    Math.round(color.b * 255),
  ];

  const board = new THREE.Group();
  const aspect = sketches.board.width / sketches.board.height;
  const boardHeight = boardWidth / aspect;

  const screenMat = new THREE.MeshBasicMaterial({
    color: 0x05090f,
    toneMapped: false,
  });
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(boardWidth, boardHeight),
    screenMat,
  );
  board.add(screen);

  const housingMat = new THREE.MeshStandardMaterial({
    color: 0x080d16,
    roughness: 0.5,
    metalness: 0.85,
    emissive: color,
    emissiveIntensity: 0.05,
  });
  const housing = new THREE.Mesh(
    new THREE.BoxGeometry(boardWidth * 1.06, boardHeight * 1.14, 0.22),
    housingMat,
  );
  housing.position.z = -0.14;
  board.add(housing);

  const trimMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const trimGeo = new THREE.BoxGeometry(boardWidth * 1.04, 0.05, 0.05);
  for (const y of [boardHeight * 0.55, -boardHeight * 0.55]) {
    const trim = new THREE.Mesh(trimGeo, trimMat);
    trim.position.set(0, y, 0.02);
    board.add(trim);
  }

  const capCanvas = document.createElement("canvas");
  capCanvas.width = 1024;
  capCanvas.height = 64;
  const capCtx = capCanvas.getContext("2d");
  if (capCtx) {
    capCtx.fillStyle = "rgba(3,7,12,0.9)";
    capCtx.fillRect(0, 0, 1024, 64);
    capCtx.fillStyle = hex;
    capCtx.font =
      '700 30px "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';
    capCtx.textBaseline = "middle";
    capCtx.fillText(`>> ${sketches.board.label}`, 22, 34);
    capCtx.textAlign = "right";
    capCtx.globalAlpha = 0.65;
    capCtx.fillText("p5.js // LIVE", 1002, 34);
  }
  const capTex = makeCanvasTexture(capCanvas);
  const capMat = new THREE.MeshBasicMaterial({
    map: capTex,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const caption = new THREE.Mesh(
    new THREE.PlaneGeometry(boardWidth, boardWidth / 16),
    capMat,
  );
  caption.position.set(0, -boardHeight * 0.55 - boardWidth / 32 - 0.04, 0.02);
  board.add(caption);

  const boardLight = new THREE.PointLight(color, 2.4, 16, 2);
  boardLight.position.z = 1.4;
  board.add(boardLight);

  let host: HTMLDivElement | null = null;
  let instance: P5 | null = null;
  let boardSketch: LiveSketch | null = null;
  let floorSketch: LiveSketch | null = null;
  let alert = 0;
  let clock = 0;
  let disposed = false;

  const buildLive = (
    p: P5,
    spec: SketchSpec,
  ): LiveSketch => {
    const g = (
      p as unknown as { createGraphics: (w: number, h: number) => P5Graphics }
    ).createGraphics(spec.width, spec.height);
    g.pixelDensity(1);

    const env: SketchEnv = {
      p,
      g,
      w: spec.width,
      h: spec.height,
      hex,
      rgb,
      alert: 0,
      t: 0,
      dt: 0,
    };
    const draw = spec.create(env);
    draw(env);

    return {
      spec,
      g,
      draw,
      texture: makeCanvasTexture(g.canvas),
      accum: 0,
      lastDraw: 0,
    };
  };

  void (async () => {
    let P5Ctor: typeof P5;
    try {
      P5Ctor = (await import("p5")).default;
    } catch {
      return;
    }
    if (disposed) return;

    host = makeHiddenHost();

    const sketch = (p: P5) => {
      p.setup = () => {
        p.createCanvas(1, 1);
        p.pixelDensity(1);
        p.noLoop();

        boardSketch = buildLive(p, sketches.board);
        floorSketch = buildLive(p, sketches.floor);

        screenMat.map = boardSketch.texture;
        screenMat.color.setRGB(1, 1, 1);
        screenMat.needsUpdate = true;

        floorMaterial.map = floorSketch.texture;
        floorMaterial.emissiveMap = floorSketch.texture;
        floorMaterial.emissive.setRGB(1, 1, 1);
        floorMaterial.emissiveIntensity = 0.95;
        floorMaterial.color.setRGB(1, 1, 1);
        floorMaterial.metalness = 0.12;
        floorMaterial.roughness = 0.86;
        floorMaterial.needsUpdate = true;
      };
      p.draw = () => {};
    };

    instance = new P5Ctor(sketch, host);
    if (disposed) {
      instance.remove();
      instance = null;
    }
  })();

  const tickSketch = (s: LiveSketch | null, dt: number) => {
    if (!s) return;
    s.accum += dt;
    const interval = 1 / s.spec.fps;
    if (s.accum < interval) return;

    const env: SketchEnv = {
      p: instance as P5,
      g: s.g,
      w: s.spec.width,
      h: s.spec.height,
      hex,
      rgb,
      alert,
      t: clock,
      dt: s.accum,
    };
    s.accum = 0;
    s.draw(env);
    s.texture.needsUpdate = true;
  };

  return {
    board,
    update: (dt, t) => {
      clock = t;
      tickSketch(boardSketch, dt);
      tickSketch(floorSketch, dt);
      boardLight.intensity = 2.0 + Math.sin(t * 2.3) * 0.4 + alert * 3.5;
    },
    setAlert: (level) => {
      alert = level;
      trimMat.opacity = 0.7 + level * 0.3;
    },
    dispose: () => {
      disposed = true;
      boardSketch?.texture.dispose();
      floorSketch?.texture.dispose();
      safely(() => instance?.remove());
      instance = null;
      if (host?.parentElement) host.parentElement.removeChild(host);
      host = null;

      screen.geometry.dispose();
      screenMat.dispose();
      housing.geometry.dispose();
      housingMat.dispose();
      trimGeo.dispose();
      trimMat.dispose();
      caption.geometry.dispose();
      capMat.dispose();
      capTex.dispose();
    },
  };
}
