import * as THREE from "three";

export type EmberField = {
  points: THREE.Points;
  update: (dt: number) => void;
  dispose: () => void;
};

const spriteCache: Map<number, THREE.CanvasTexture> = new Map();

function makeCircleSprite(size = 64): THREE.CanvasTexture {
  const cached = spriteCache.get(size);
  if (cached) return cached;

  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D context not available");

  const r = size / 2;
  const grad = g.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0.0, "rgba(255,255,255,1.0)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.2)");
  grad.addColorStop(1.0, "rgba(255,255,255,0.0)");

  g.clearRect(0, 0, size, size);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(r, r, r, 0, Math.PI * 2);
  g.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 2;
  spriteCache.set(size, tex);
  return tex;
}

export function createEmberField(
  scene: THREE.Scene,
  opts: {
    count?: number;
    bounds?: { x: number; y: number; zFront: number; zBack: number };
    speed?: [number, number];
    size?: [number, number];
    hue?: [number, number];
  } = {}
): EmberField {
  const count = opts.count ?? 1400;
  const bounds = opts.bounds ?? { x: 20, y: 20, zFront: 6, zBack: -180 };
  const speedRange = opts.speed ?? [4.0, 18.0];
  const sizeRange = opts.size ?? [0.05, 0.22];
  const hueRange = opts.hue ?? [0.75, 0.95];

  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const rand = (a: number, b: number) => a + Math.random() * (b - a);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    positions[i3 + 0] = rand(-bounds.x, bounds.x);
    positions[i3 + 1] = rand(-bounds.y, bounds.y);
    positions[i3 + 2] = rand(bounds.zBack, bounds.zFront);
    velocities[i] = rand(speedRange[0], speedRange[1]);

    sizes[i] = rand(sizeRange[0], sizeRange[1]);

    const h = rand(hueRange[0], hueRange[1]);
    const c = new THREE.Color().setHSL(h, 1.0, 0.6);
    colors[i3 + 0] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms: {
      uPointTexture: { value: makeCircleSprite(64) },
      uSizeMultiplier: { value: 1.0 },
    },
    vertexShader: `
      attribute float aSize;
      varying vec3 vColor;
      uniform float uSizeMultiplier;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uSizeMultiplier * (300.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      void main() {
        vec4 tex = texture2D(uPointTexture, gl_PointCoord);
        vec3 col = vColor * tex.a;
        gl_FragColor = vec4(col, tex.a);
      }
    `,
  });

  const points = new THREE.Points(geom, material);
  points.frustumCulled = false;
  points.renderOrder = -1;
  scene.add(points);

  const update = (dt: number) => {
    const posAttr = geom.getAttribute("position") as THREE.BufferAttribute;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      arr[i3 + 2] += velocities[i] * dt;
      if (arr[i3 + 2] > bounds.zFront) {
        arr[i3 + 2] = bounds.zBack;
        arr[i3 + 0] = rand(-bounds.x, bounds.x);
        arr[i3 + 1] = rand(-bounds.y, bounds.y);
      }
    }
    posAttr.needsUpdate = true;
  };

  const dispose = () => {
    scene.remove(points);
    geom.dispose();
    material.dispose();
  };

  return { points, update, dispose };
}
