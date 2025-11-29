import * as THREE from "three";

export type GlyphOptions = {
  size?: number;
  inset?: number;
  glow?: number;
  color?: number;
  text?: string;
  opacity?: number;
  fontScale?: number;
  canvasPx?: number;
  paddingPx?: number;
  polygonOffset?: boolean;
};

function fitFontToWidth(
  ctx: CanvasRenderingContext2D,
  targetWidth: number,
  baseSize: number,
  text: string,
  iterations = 3
): number {
  let size = baseSize;
  for (let i = 0; i < iterations; i++) {
    ctx.font = `700 ${Math.floor(size)}px monospace`;
    const w = ctx.measureText(text).width;
    if (w <= targetWidth) break;
    size *= targetWidth / (w + 1e-3);
  }
  return Math.floor(size);
}

export function createGlyphTexture(
  text: string,
  colorHex: number,
  glow: number = 12,
  canvasPx: number = 512,
  paddingPx: number = 48,
  fontScale: number = 0.58
): THREE.CanvasTexture {
  const pad = Math.floor(paddingPx + glow * 1.5);
  const px = canvasPx + pad * 2;

  const c = document.createElement("canvas");
  c.width = c.height = px;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D context not available");

  g.clearRect(0, 0, px, px);

  const color = `#${colorHex.toString(16).padStart(6, "0")}`;

  g.shadowColor = color;
  g.shadowBlur = glow;
  g.textAlign = "center";
  g.textBaseline = "middle";

  const inner = px - pad * 2;
  const baseSize = inner * fontScale;
  const fitted = fitFontToWidth(g, inner * 0.96, baseSize, text, 4);
  g.font = `700 ${fitted}px monospace`;

  g.fillStyle = color;
  g.fillText(text, px / 2 + 0.5, px / 2 + 0.5);

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 2;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

export function addGlyphDecalsToCube(
  cube: THREE.Mesh,
  faceSizeWorld: number,
  colorHex: number,
  text: string,
  opts: GlyphOptions = {}
): THREE.Group {
  const size = opts.size ?? faceSizeWorld * 0.7;
  const inset = opts.inset ?? 0.004;
  const glow = opts.glow ?? 12;
  const opacity = opts.opacity ?? 0.95;
  const fontScale = opts.fontScale ?? 0.58;
  const canvasPx = opts.canvasPx ?? 512;
  const paddingPx = opts.paddingPx ?? 48;

  const tex = createGlyphTexture(
    text,
    colorHex,
    glow,
    canvasPx,
    paddingPx,
    fontScale
  );

  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.FrontSide,
    polygonOffset: opts.polygonOffset ?? true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const planeGeo = new THREE.PlaneGeometry(size, size);
  const group = new THREE.Group();
  group.name = "glyphDecals";

  const bbox = new THREE.Box3().setFromObject(cube);
  const half = bbox.getSize(new THREE.Vector3()).multiplyScalar(0.5);

  const faces: Array<{ pos: THREE.Vector3; rot: THREE.Euler }> = [
    {
      pos: new THREE.Vector3(+half.x + inset, 0, 0),
      rot: new THREE.Euler(0, -Math.PI / 2, 0),
    },
    {
      pos: new THREE.Vector3(-half.x - inset, 0, 0),
      rot: new THREE.Euler(0, +Math.PI / 2, 0),
    },
    {
      pos: new THREE.Vector3(0, +half.y + inset, 0),
      rot: new THREE.Euler(-Math.PI / 2, 0, 0),
    },
    {
      pos: new THREE.Vector3(0, -half.y - inset, 0),
      rot: new THREE.Euler(+Math.PI / 2, 0, 0),
    },
    {
      pos: new THREE.Vector3(0, 0, +half.z + inset),
      rot: new THREE.Euler(0, 0, 0),
    },
    {
      pos: new THREE.Vector3(0, 0, -half.z - inset),
      rot: new THREE.Euler(0, Math.PI, 0),
    },
  ];

  faces.forEach(({ pos, rot }) => {
    const p = new THREE.Mesh(planeGeo, mat.clone());
    p.position.copy(pos);
    p.rotation.copy(rot);
    p.renderOrder = 10;
    group.add(p);
  });

  cube.add(group);
  return group;
}
