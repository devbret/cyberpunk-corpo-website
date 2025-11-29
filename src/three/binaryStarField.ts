import * as THREE from "three";

const textureCache = new Map<string, THREE.CanvasTexture>();

function createDigitTexture(
  digit: "0" | "1",
  opts?: { size?: number; color?: string; glow?: number }
): THREE.CanvasTexture {
  const size = opts?.size ?? 128;
  const color = opts?.color ?? "#ffffff";
  const glow = opts?.glow ?? 10;

  const key = `${digit}_${size}_${color}_${glow}`;
  const cached = textureCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = glow;
  ctx.fillStyle = "rgba(255,255,255,0)";
  ctx.fillRect(0, 0, size, size);
  ctx.restore();

  ctx.font = `bold ${Math.floor(size * 0.52)}px monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(digit, size / 2, size / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipMapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;

  textureCache.set(key, tex);
  return tex;
}

type StarUserData = {
  baseScale: number;
  twinkleSpeed: number;
  twinklePhase: number;
  drift: THREE.Vector3;
  ringRadius: number;
};

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function createBinaryStarField(
  scene: THREE.Scene,
  starCount = 4300
): {
  group: THREE.Group;
  update: (dt: number) => void;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = "binaryStarField";

  const tex0 = createDigitTexture("0", { color: "#00ffff", glow: 14 });
  const tex1 = createDigitTexture("1", { color: "#ff00ff", glow: 14 });

  const mat0 = new THREE.SpriteMaterial({
    map: tex0,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mat1 = new THREE.SpriteMaterial({
    map: tex1,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const radius = 120;
  for (let i = 0; i < starCount; i++) {
    const isZero = Math.random() < 0.5;
    const material = isZero ? mat0 : mat1;
    const sprite = new THREE.Sprite(material);

    const r = Math.cbrt(Math.random()) * radius; // cbrt to bias inward
    const theta = Math.acos(THREE.MathUtils.clamp(rand(-1, 1), -1, 1));
    const phi = rand(0, Math.PI * 2);
    const x = r * Math.sin(theta) * Math.cos(phi);
    const y = r * Math.sin(theta) * Math.sin(phi);
    const z = r * Math.cos(theta);
    sprite.position.set(x, y, z);

    const dist = sprite.position.length();
    const baseScale =
      THREE.MathUtils.mapLinear(dist, 0, radius, 0.9, 2.2) * rand(0.8, 1.4);
    sprite.scale.setScalar(baseScale);

    const ringRadius = Math.sqrt(x * x + y * y);
    const drift = new THREE.Vector3(
      rand(-0.02, 0.02),
      rand(-0.02, 0.02),
      rand(-0.02, 0.02)
    );

    const twinkleSpeed = rand(0.6, 2.2);
    const twinklePhase = rand(0, Math.PI * 2);
    (sprite.material as THREE.SpriteMaterial).rotation = rand(0, Math.PI * 2);

    sprite.userData = {
      baseScale,
      twinkleSpeed,
      twinklePhase,
      drift,
      ringRadius,
    } as StarUserData;

    group.add(sprite);
  }

  scene.add(group);

  const update = (dt: number) => {
    const swirl = 0.05 * dt;
    group.rotation.z += swirl;

    for (const obj of group.children) {
      const s = obj as THREE.Sprite & { userData: StarUserData };
      const data = s.userData;
      const t = performance.now() * 0.001;
      const tw =
        0.5 + 0.5 * Math.sin(t * data.twinkleSpeed * 2.0 + data.twinklePhase);
      const scale = data.baseScale * (0.9 + 0.2 * tw);
      s.scale.setScalar(scale);

      const dist = s.position.length();
      const depthFade = THREE.MathUtils.smoothstep(
        radius - 10,
        radius + 20,
        dist
      );
      const alpha = THREE.MathUtils.clamp(
        0.85 * tw * (1.0 - depthFade) + 0.15,
        0.05,
        1.0
      );
      (s.material as THREE.SpriteMaterial).opacity = alpha;

      s.position.addScaledVector(data.drift, dt * 0.5);

      const θ =
        Math.atan2(s.position.y, s.position.x) +
        dt * (0.05 + data.ringRadius * 0.00005);
      const r = Math.hypot(s.position.x, s.position.y);
      const z = s.position.z + Math.sin(t * 0.5 + data.twinklePhase) * 0.02;
      s.position.set(r * Math.cos(θ), r * Math.sin(θ), z);
    }
  };

  const dispose = () => {
    group.children.forEach((obj) => {
      const s = obj as THREE.Sprite;
      s.geometry?.dispose?.();
    });
    scene.remove(group);
  };

  return { group, update, dispose };
}
