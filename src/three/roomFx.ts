
import * as THREE from "three";
import type { FeedLine, LoreStat } from "./roomLore";
import { clockStamp } from "./roomLore";

export type Fx = {
  object: THREE.Object3D;
  update: (dt: number, t: number) => void;
  dispose: () => void;
  setAlert?: (level: number) => void;
};

const MONO = '"SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace';

const TONE_COLOR: Record<FeedLine["tone"], string> = {
  dim: "rgba(132,158,174,0.5)",
  normal: "rgba(205,228,238,0.88)",
  warn: "#ffb347",
  alert: "#ff3b5c",
};

function cssHex(color: THREE.Color): string {
  return `#${color.getHexString()}`;
}

function cssRgba(color: THREE.Color, a: number): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r},${g},${b},${a})`;
}

function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawPanelChrome(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  color: THREE.Color,
  alertLevel: number,
): void {
  g.save();
  g.globalAlpha = 0.055 + alertLevel * 0.05;
  g.fillStyle = "#ffffff";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
  g.restore();

  const tick = 16;
  g.strokeStyle = cssRgba(color, 0.85);
  g.lineWidth = 3;
  for (const [cx, cy, dx, dy] of [
    [6, 6, 1, 1],
    [w - 6, 6, -1, 1],
    [6, h - 6, 1, -1],
    [w - 6, h - 6, -1, -1],
  ] as const) {
    g.beginPath();
    g.moveTo(cx, cy + dy * tick);
    g.lineTo(cx, cy);
    g.lineTo(cx + dx * tick, cy);
    g.stroke();
  }
}

function makePanelTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type PanelMesh = {
  mesh: THREE.Mesh;
  mat: THREE.MeshBasicMaterial;
  dispose: () => void;
};

function makePanelMesh(
  tex: THREE.CanvasTexture,
  width: number,
  height: number,
): PanelMesh {
  const geo = new THREE.PlaneGeometry(width, height);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    side: THREE.FrontSide,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const backGeo = new THREE.PlaneGeometry(width * 1.04, height * 1.06);
  const backMat = new THREE.MeshBasicMaterial({
    color: 0x04080e,
    side: THREE.BackSide,
  });
  const back = new THREE.Mesh(backGeo, backMat);
  back.position.z = -0.025;
  mesh.add(back);

  return {
    mesh,
    mat,
    dispose: () => {
      geo.dispose();
      mat.dispose();
      backGeo.dispose();
      backMat.dispose();
    },
  };
}

export type TerminalPanel = Fx & {
  push: (line: FeedLine) => void;
};

export function createTerminalPanel(opts: {
  title: string;
  color: THREE.Color;
  width?: number;
  rows?: number;
}): TerminalPanel {
  const rows = opts.rows ?? 9;
  const worldWidth = opts.width ?? 3.4;

  const cw = 640;
  const rowH = 30;
  const headerH = 54;
  const ch = headerH + rows * rowH + 22;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const tex = makePanelTexture(canvas);
  const panel = makePanelMesh(tex, worldWidth, (worldWidth * ch) / cw);
  const mesh = panel.mesh;

  const lines: FeedLine[] = [];
  let alertLevel = 0;
  let clock = 0;
  let sinceDraw = 0;
  let dirty = true;
  let cursorOn = true;
  let cursorTimer = 0;
  const stamps: string[] = [];

  const draw = () => {
    g.clearRect(0, 0, cw, ch);

    g.fillStyle = "rgba(3,7,12,0.9)";
    roundRect(g, 2, 2, cw - 4, ch - 4, 12);
    g.fill();

    g.strokeStyle = cssRgba(opts.color, 0.55 + alertLevel * 0.4);
    g.lineWidth = 2.5;
    roundRect(g, 2, 2, cw - 4, ch - 4, 12);
    g.stroke();

    g.fillStyle = cssRgba(opts.color, 0.14);
    g.fillRect(4, 4, cw - 8, headerH - 8);
    g.fillStyle = cssHex(opts.color);
    g.font = `700 21px ${MONO}`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText(opts.title.toUpperCase(), 22, headerH / 2 + 1);

    const live = alertLevel > 0.35 ? "#ff3b5c" : cssHex(opts.color);
    g.fillStyle = live;
    g.globalAlpha = cursorOn ? 1 : 0.25;
    g.beginPath();
    g.arc(cw - 38, headerH / 2, 6.5, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
    g.font = `600 15px ${MONO}`;
    g.textAlign = "right";
    g.fillStyle = cssRgba(opts.color, 0.75);
    g.fillText(alertLevel > 0.35 ? "ALERT" : "LIVE", cw - 54, headerH / 2 + 1);

    g.textAlign = "left";
    g.font = `500 19px ${MONO}`;
    const start = Math.max(0, lines.length - rows);
    for (let i = start; i < lines.length; i++) {
      const y = headerH + 14 + (i - start) * rowH;
      const line = lines[i];
      const age = (lines.length - 1 - i) / rows;

      g.globalAlpha = 0.45 + 0.55 * (1 - age * 0.75);
      g.fillStyle = "rgba(120,150,168,0.55)";
      g.fillText(stamps[i] ?? "--:--:--", 22, y);
      g.fillStyle = TONE_COLOR[line.tone];
      g.fillText(line.text, 130, y);
      g.globalAlpha = 1;
    }

    if (cursorOn && lines.length) {
      const y = headerH + 14 + Math.min(lines.length, rows) * rowH - rowH;
      const w = g.measureText(lines[lines.length - 1].text).width;
      g.fillStyle = cssRgba(opts.color, 0.9);
      g.fillRect(136 + w, y - 9, 10, 18);
    }

    drawPanelChrome(g, cw, ch, opts.color, alertLevel);
    tex.needsUpdate = true;
  };

  const push = (line: FeedLine) => {
    lines.push(line);
    stamps.push(clockStamp(clock));
    if (lines.length > rows + 4) {
      lines.shift();
      stamps.shift();
    }
    dirty = true;
  };

  draw();

  return {
    object: mesh,
    push,
    update: (dt) => {
      clock += dt;
      cursorTimer += dt;
      if (cursorTimer > 0.45) {
        cursorTimer = 0;
        cursorOn = !cursorOn;
        dirty = true;
      }
      sinceDraw += dt;
      if (dirty && sinceDraw > 0.08) {
        sinceDraw = 0;
        dirty = false;
        draw();
      }
    },
    setAlert: (level) => {
      if (Math.abs(level - alertLevel) < 0.08) return;
      alertLevel = level;
      dirty = true;
    },
    dispose: () => {
      panel.dispose();
      tex.dispose();
    },
  };
}

export function createStatPanel(opts: {
  title: string;
  color: THREE.Color;
  stats: LoreStat[];
  width?: number;
}): Fx {
  const worldWidth = opts.width ?? 2.6;
  const cw = 520;
  const headerH = 48;
  const rowH = 74;
  const ch = headerH + opts.stats.length * rowH + 18;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const tex = makePanelTexture(canvas);
  const panel = makePanelMesh(tex, worldWidth, (worldWidth * ch) / cw);
  const mesh = panel.mesh;

  let alertLevel = 0;
  let sinceDraw = 0;

  const draw = (t: number) => {
    g.clearRect(0, 0, cw, ch);

    g.fillStyle = "rgba(3,7,12,0.9)";
    roundRect(g, 2, 2, cw - 4, ch - 4, 12);
    g.fill();
    g.strokeStyle = cssRgba(opts.color, 0.5 + alertLevel * 0.45);
    g.lineWidth = 2.5;
    roundRect(g, 2, 2, cw - 4, ch - 4, 12);
    g.stroke();

    g.fillStyle = cssRgba(opts.color, 0.14);
    g.fillRect(4, 4, cw - 8, headerH - 8);
    g.fillStyle = cssHex(opts.color);
    g.font = `700 19px ${MONO}`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillText(opts.title.toUpperCase(), 20, headerH / 2 + 1);

    opts.stats.forEach((stat, i) => {
      const y = headerH + 12 + i * rowH;

      g.font = `500 16px ${MONO}`;
      g.fillStyle = "rgba(140,168,184,0.72)";
      g.textAlign = "left";
      g.fillText(stat.label, 20, y + 12);

      const value = stat.sample(t);
      g.font = `700 30px ${MONO}`;
      g.fillStyle = alertLevel > 0.4 ? "#ff5c72" : cssHex(opts.color);
      g.textAlign = "right";
      g.fillText(`${value.toFixed(stat.decimals)}${stat.unit}`, cw - 22, y + 16);

      if (stat.meter) {
        const mx = 20;
        const my = y + 40;
        const mw = cw - 42;
        g.fillStyle = "rgba(255,255,255,0.07)";
        g.fillRect(mx, my, mw, 9);
        const frac = THREE.MathUtils.clamp(value / 100, 0, 1);
        g.fillStyle = cssRgba(opts.color, 0.85);
        g.fillRect(mx, my, mw * frac, 9);
        g.fillStyle = "rgba(0,0,0,0.55)";
        for (let k = 1; k < 10; k++) g.fillRect(mx + (mw / 10) * k, my, 2, 9);
      }
    });

    drawPanelChrome(g, cw, ch, opts.color, alertLevel);
    tex.needsUpdate = true;
  };

  draw(0);

  return {
    object: mesh,
    update: (dt, t) => {
      sinceDraw += dt;
      if (sinceDraw > 0.14) {
        sinceDraw = 0;
        draw(t);
      }
    },
    setAlert: (level) => {
      alertLevel = level;
    },
    dispose: () => {
      panel.dispose();
      tex.dispose();
    },
  };
}

export function createSignage(
  text: string,
  color: THREE.Color,
  worldWidth = 1.6,
): Fx {
  const cw = 512;
  const ch = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  g.clearRect(0, 0, cw, ch);
  g.font = `700 76px ${MONO}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = cssHex(color);
  g.shadowBlur = 22;
  g.fillStyle = cssRgba(color, 0.82);
  g.fillText(text.toUpperCase(), cw / 2, ch / 2 + 2);

  const tex = makePanelTexture(canvas);
  const geo = new THREE.PlaneGeometry(worldWidth, (worldWidth * ch) / cw);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    opacity: 0.7,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const phase = Math.random() * Math.PI * 2;
  return {
    object: mesh,
    update: (_dt, t) => {
      const f = Math.sin(t * 1.7 + phase) * 0.5 + 0.5;
      const glitch = Math.random() < 0.006 ? 0.25 : 1;
      mat.opacity = (0.42 + f * 0.3) * glitch;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

const CONDUIT_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CONDUIT_FRAG = `
  uniform float uTime;
  uniform vec3  uColor;
  uniform float uSpeed;
  uniform float uPhase;
  uniform float uPackets;
  uniform float uAlert;
  varying vec2 vUv;

  void main() {
    float head = fract(uTime * uSpeed + uPhase);
    float pulse = 0.0;
    for (float k = 0.0; k < 4.0; k += 1.0) {
      if (k >= uPackets) break;
      float d = vUv.x - fract(head + k / uPackets);
      d -= floor(d + 0.5);
      pulse += exp(-abs(d) * 42.0);
    }
    float base = 0.10 + uAlert * 0.16;
    float a = clamp(base + pulse * 0.9, 0.0, 1.0);
    vec3 col = uColor * (0.45 + pulse * 2.4 + uAlert * 0.4);
    gl_FragColor = vec4(col, a);
  }
`;

export function createConduit(opts: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color: THREE.Color;
  sag?: number;
  radius?: number;
  speed?: number;
  packets?: number;
}): Fx {
  const sag = opts.sag ?? 0.6;
  const mid = opts.from
    .clone()
    .add(opts.to)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, -sag, 0));
  const curve = new THREE.QuadraticBezierCurve3(opts.from, mid, opts.to);
  const geo = new THREE.TubeGeometry(curve, 48, opts.radius ?? 0.026, 8, false);

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: CONDUIT_VERT,
    fragmentShader: CONDUIT_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: opts.color.clone() },
      uSpeed: { value: opts.speed ?? 0.35 },
      uPhase: { value: Math.random() },
      uPackets: { value: opts.packets ?? 2 },
      uAlert: { value: 0 },
    },
  });

  const mesh = new THREE.Mesh(geo, mat);
  return {
    object: mesh,
    update: (_dt, t) => {
      mat.uniforms.uTime.value = t;
    },
    setAlert: (level) => {
      mat.uniforms.uAlert.value = level;
      mat.uniforms.uSpeed.value = (opts.speed ?? 0.35) * (1 + level * 2.2);
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createFloorPulse(opts: {
  color: THREE.Color;
  y: number;
  count?: number;
  maxRadius?: number;
  period?: number;
}): Fx {
  const count = opts.count ?? 4;
  const maxRadius = opts.maxRadius ?? 15;
  const period = opts.period ?? 4.5;

  const group = new THREE.Group();
  const geo = new THREE.RingGeometry(0.92, 1.0, 96);
  const rings: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; off: number }[] =
    [];

  for (let i = 0; i < count; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: opts.color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = opts.y;
    group.add(mesh);
    rings.push({ mesh, mat, off: i / count });
  }

  let speed = 1;
  return {
    object: group,
    update: (_dt, t) => {
      for (const r of rings) {
        const p = ((t * speed) / period + r.off) % 1;
        const radius = 0.5 + p * maxRadius;
        r.mesh.scale.setScalar(radius);
        r.mat.opacity = Math.max(0, 0.5 * (1 - p) * (1 - p) * (p > 0.02 ? 1 : 0));
      }
    },
    setAlert: (level) => {
      speed = 1 + level * 2.4;
    },
    dispose: () => {
      geo.dispose();
      rings.forEach((r) => r.mat.dispose());
    },
  };
}

const SHAFT_FRAG = `
  uniform vec3  uColor;
  uniform float uAlert;
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    float fade = pow(1.0 - vUv.y, 1.7);
    float edge = smoothstep(0.0, 0.28, abs(vUv.x - 0.5) * 2.0);
    float shimmer = 0.86 + 0.14 * sin(vUv.y * 26.0 - uTime * 2.4);
    float a = fade * (0.10 + uAlert * 0.14) * shimmer * (1.0 - edge * 0.35);
    gl_FragColor = vec4(uColor * (1.0 + uAlert), a);
  }
`;

export function createLightShaft(opts: {
  color: THREE.Color;
  height: number;
  radius: number;
}): Fx {
  const geo = new THREE.ConeGeometry(opts.radius, opts.height, 32, 1, true);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: CONDUIT_VERT,
    fragmentShader: SHAFT_FRAG,
    uniforms: {
      uColor: { value: opts.color.clone() },
      uAlert: { value: 0 },
      uTime: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);

  return {
    object: mesh,
    update: (_dt, t) => {
      mat.uniforms.uTime.value = t;
    },
    setAlert: (level) => {
      mat.uniforms.uAlert.value = level;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export function createLedBank(opts: {
  color: THREE.Color;
  cols?: number;
  rows?: number;
  width?: number;
  height?: number;
}): Fx {
  const cols = opts.cols ?? 8;
  const rows = opts.rows ?? 14;
  const cw = 128;
  const ch = 256;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const tex = makePanelTexture(canvas);
  const geo = new THREE.PlaneGeometry(opts.width ?? 0.55, opts.height ?? 2.3);
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(geo, mat);

  const rate = new Float32Array(cols * rows);
  const phase = new Float32Array(cols * rows);
  for (let i = 0; i < rate.length; i++) {
    rate[i] = 0.4 + Math.random() * 5.5;
    phase[i] = Math.random() * Math.PI * 2;
  }

  let alertLevel = 0;
  let since = 0;
  const cellW = cw / cols;
  const cellH = ch / rows;

  const draw = (t: number) => {
    g.clearRect(0, 0, cw, ch);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const on = Math.sin(t * rate[i] + phase[i]) > 0.15 ? 1 : 0.08;
        const hot = alertLevel > 0.4 && Math.sin(t * 9 + phase[i]) > 0;
        g.fillStyle = hot
          ? `rgba(255,60,90,${on})`
          : cssRgba(opts.color, on * 0.9);
        g.fillRect(
          x * cellW + cellW * 0.24,
          y * cellH + cellH * 0.26,
          cellW * 0.5,
          cellH * 0.42,
        );
      }
    }
    tex.needsUpdate = true;
  };

  draw(0);

  return {
    object: mesh,
    update: (dt, t) => {
      since += dt;
      if (since > 0.1) {
        since = 0;
        draw(t);
      }
    },
    setAlert: (level) => {
      alertLevel = level;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

const MOTE_VERT = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uAlert;
  varying float vFade;
  void main() {
    vec3 p = position;
    p.y += sin(uTime * 0.35 + aPhase) * 0.55;
    p.x += cos(uTime * 0.24 + aPhase * 1.7) * 0.45;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vFade = 0.45 + 0.55 * sin(uTime * 1.6 + aPhase);
    gl_PointSize = aSize * (1.0 + uAlert * 0.6) * (300.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const MOTE_FRAG = `
  uniform vec3 uColor;
  uniform float uAlert;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d) * vFade * 0.6;
    gl_FragColor = vec4(mix(uColor, vec3(1.0, 0.25, 0.35), uAlert * 0.5), a);
  }
`;

export function createMotes(opts: {
  color: THREE.Color;
  count?: number;
  radius?: number;
  height?: number;
  vertical?: number;
}): Fx {
  const count = opts.count ?? 520;
  const radius = opts.radius ?? 13;
  const height = opts.height ?? 9;
  const vertical = opts.vertical ?? 0;

  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = Math.sqrt(Math.random()) * radius;
    const a = Math.random() * Math.PI * 2;
    positions[i3] = Math.cos(a) * r;
    positions[i3 + 1] = -3 + Math.random() * height;
    positions[i3 + 2] = Math.sin(a) * r;
    sizes[i] = 0.03 + Math.random() * 0.09;
    phases[i] = Math.random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: MOTE_VERT,
    fragmentShader: MOTE_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: opts.color.clone() },
      uAlert: { value: 0 },
    },
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;

  const posAttr = geo.getAttribute("position") as THREE.BufferAttribute;
  const arr = posAttr.array as Float32Array;
  const top = -3 + height;

  return {
    object: points,
    update: (dt, t) => {
      mat.uniforms.uTime.value = t;
      if (vertical !== 0) {
        for (let i = 0; i < count; i++) {
          const iy = i * 3 + 1;
          arr[iy] += vertical * dt;
          if (arr[iy] > top) arr[iy] = -3;
          else if (arr[iy] < -3) arr[iy] = top;
        }
        posAttr.needsUpdate = true;
      }
    },
    setAlert: (level) => {
      mat.uniforms.uAlert.value = level;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

const SPARK_VERT = `
  attribute vec3 aVel;
  attribute float aSize;
  uniform float uAge;
  varying float vFade;
  void main() {
    vec3 p = position + aVel * uAge;
    p.y -= 1.4 * uAge * uAge;
    vFade = clamp(1.0 - uAge / 1.4, 0.0, 1.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * vFade * (330.0 / -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;

const SPARK_FRAG = `
  uniform vec3 uColor;
  varying float vFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.0, d) * vFade;
    gl_FragColor = vec4(uColor * (1.0 + vFade * 1.6), a);
  }
`;

export type SparkBurst = Fx & { fire: (at: THREE.Vector3) => void };

export function createSparkBurst(opts: {
  color: THREE.Color;
  count?: number;
  speed?: number;
}): SparkBurst {
  const count = opts.count ?? 160;
  const speed = opts.speed ?? 5.5;

  const positions = new Float32Array(count * 3);
  const vels = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(Math.random() * 2 - 1);
    const s = speed * (0.35 + Math.random() * 0.65);
    vels[i3] = Math.sin(phi) * Math.cos(theta) * s;
    vels[i3 + 1] = Math.cos(phi) * s * 0.8 + 1.2;
    vels[i3 + 2] = Math.sin(phi) * Math.sin(theta) * s;
    sizes[i] = 0.05 + Math.random() * 0.16;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aVel", new THREE.BufferAttribute(vels, 3));
  geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: {
      uAge: { value: 99 },
      uColor: { value: opts.color.clone() },
    },
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.visible = false;

  let age = 99;

  return {
    object: points,
    fire: (at) => {
      points.position.copy(at);
      age = 0;
      points.visible = true;
    },
    update: (dt) => {
      if (age > 1.4) {
        if (points.visible) points.visible = false;
        return;
      }
      age += dt;
      mat.uniforms.uAge.value = age;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}

export type TickerBand = Fx & { setText: (text: string) => void };

export function createTickerBand(opts: {
  text: string;
  color: THREE.Color;
  radius: number;
  height?: number;
  speed?: number;
  repeats?: number;
}): TickerBand {
  const repeats = opts.repeats ?? 6;
  const cw = 2048;
  const ch = 96;

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const tex = makePanelTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = -repeats;

  const draw = (text: string) => {
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = "rgba(2,6,10,0.72)";
    g.fillRect(0, 0, cw, ch);
    g.fillStyle = cssRgba(opts.color, 0.22);
    g.fillRect(0, 0, cw, 3);
    g.fillRect(0, ch - 3, cw, 3);
    g.font = `700 50px ${MONO}`;
    g.textBaseline = "middle";
    g.textAlign = "left";
    g.fillStyle = cssHex(opts.color);
    const w = g.measureText(text).width;
    g.fillText(text, 0, ch / 2);
    if (w < cw) g.fillText(text, w, ch / 2);
    tex.needsUpdate = true;
  };

  draw(opts.text);

  const geo = new THREE.CylinderGeometry(
    opts.radius,
    opts.radius,
    opts.height ?? 0.62,
    72,
    1,
    true,
  );
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    opacity: 0.85,
  });
  const mesh = new THREE.Mesh(geo, mat);

  let speed = opts.speed ?? 0.045;
  return {
    object: mesh,
    setText: draw,
    update: (dt) => {
      tex.offset.x = (tex.offset.x + speed * dt) % 1;
    },
    setAlert: (level) => {
      speed = (opts.speed ?? 0.045) * (1 + level * 3);
      mat.color.setRGB(1, 1 - level * 0.65, 1 - level * 0.6);
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
      tex.dispose();
    },
  };
}

export type HoloScreen = Fx & {
  setContent: (headline: string, body: string[], accent?: string) => void;
};

export function createHoloScreen(opts: {
  color: THREE.Color;
  width?: number;
  aspect?: number;
  label?: string;
}): HoloScreen {
  const cw = 512;
  const ch = Math.round(cw / (opts.aspect ?? 1.6));

  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const tex = makePanelTexture(canvas);
  const worldWidth = opts.width ?? 1.9;
  const panel = makePanelMesh(
    tex,
    worldWidth,
    worldWidth / (opts.aspect ?? 1.6),
  );
  const mesh = panel.mesh;
  const mat = panel.mat;

  let headline = opts.label ?? "";
  let body: string[] = [];
  let accent = cssHex(opts.color);
  let alertLevel = 0;
  let flash = 0;
  let since = 0;

  const draw = () => {
    g.clearRect(0, 0, cw, ch);
    g.fillStyle = "rgba(3,7,12,0.9)";
    g.fillRect(0, 0, cw, ch);

    g.fillStyle = cssRgba(opts.color, 0.16 + flash * 0.5);
    g.fillRect(0, 0, 8, ch);

    g.textBaseline = "top";
    g.textAlign = "left";
    g.font = `700 27px ${MONO}`;
    g.fillStyle = flash > 0.3 ? "#ffffff" : accent;
    wrapText(g, headline.toUpperCase(), 22, 20, cw - 44, 30, 3);

    g.font = `500 17px ${MONO}`;
    g.fillStyle = "rgba(180,206,220,0.75)";
    body.forEach((ln, i) => g.fillText(ln, 22, ch - 26 - (body.length - i) * 23));

    g.strokeStyle = cssRgba(opts.color, 0.5 + alertLevel * 0.4);
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, cw - 3, ch - 3);

    g.save();
    g.globalAlpha = 0.06;
    g.fillStyle = "#ffffff";
    for (let y = 0; y < ch; y += 3) g.fillRect(0, y, cw, 1);
    g.restore();

    tex.needsUpdate = true;
  };

  draw();

  return {
    object: mesh,
    setContent: (h, b, a) => {
      headline = h;
      body = b;
      if (a) accent = a;
      flash = 1;
      draw();
    },
    update: (dt) => {
      since += dt;
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 2.2);
        if (since > 0.06) {
          since = 0;
          draw();
        }
      }
      if (Math.random() < 0.0025) mat.opacity = 0.25;
      else mat.opacity = Math.min(1, mat.opacity + dt * 4);
    },
    setAlert: (level) => {
      alertLevel = level;
    },
    dispose: () => {
      panel.dispose();
      tex.dispose();
    },
  };
}

function wrapText(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.split(" ");
  let line = "";
  let drawn = 0;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxWidth && line) {
      g.fillText(line, x, y + drawn * lineHeight);
      drawn++;
      line = w;
      if (drawn >= maxLines) return;
    } else {
      line = test;
    }
  }
  if (line && drawn < maxLines) g.fillText(line, x, y + drawn * lineHeight);
}

const WALL_FRAG = `
  uniform vec3  uColor;
  uniform float uTime;
  uniform float uAlert;
  varying vec2 vUv;

  float grid(vec2 uv, float div, float w) {
    vec2 g = abs(fract(uv * div - 0.5) - 0.5) / fwidth(uv * div);
    float l = min(g.x, g.y);
    return 1.0 - smoothstep(0.0, w, l);
  }

  void main() {
    float fine  = grid(vUv, 40.0, 1.2) * 0.28;
    float major = grid(vUv, 8.0, 1.4) * 0.5;

    float sweepY = fract(uTime * 0.11);
    float sweep = exp(-abs(vUv.y - sweepY) * 90.0) * 0.85;

    float fade = smoothstep(1.0, 0.35, vUv.y) * smoothstep(0.0, 0.15, vUv.y);
    float a = (fine + major + sweep) * fade * (0.5 + uAlert * 0.7);
    gl_FragColor = vec4(uColor * (1.0 + sweep * 2.0 + uAlert), a);
  }
`;

export function createWallGrid(opts: {
  color: THREE.Color;
  radius: number;
  height: number;
}): Fx {
  const geo = new THREE.CylinderGeometry(
    opts.radius,
    opts.radius,
    opts.height,
    64,
    1,
    true,
  );
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    vertexShader: CONDUIT_VERT,
    fragmentShader: WALL_FRAG,
    uniforms: {
      uColor: { value: opts.color.clone() },
      uTime: { value: 0 },
      uAlert: { value: 0 },
    },
  });
  const mesh = new THREE.Mesh(geo, mat);

  return {
    object: mesh,
    update: (_dt, t) => {
      mat.uniforms.uTime.value = t;
    },
    setAlert: (level) => {
      mat.uniforms.uAlert.value = level;
    },
    dispose: () => {
      geo.dispose();
      mat.dispose();
    },
  };
}
