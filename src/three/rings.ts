import * as THREE from "three";

export type UpdatableGroup = THREE.Group & {
  userData: THREE.Group["userData"] & { update?: (dt: number) => void };
};

export type PortalRingsOptions = {
  ringCount?: number;
  spacing?: number;
  baseRadius?: number;
  tube?: number;
  tunnelScaleStep?: number;
  coreColor?: number;
  emissive?: number;
  glowColor?: number;
};

function makeFresnelGlowMaterial(color = new THREE.Color(0xff00ff)) {
  return new THREE.ShaderMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: color },
      uPower: { value: 2.25 },
      uAmp: { value: 0.025 },
      uFreq: { value: 6.0 },
      uBands: { value: 12.0 },
      uSpeed: { value: 0.6 },
      uPhase: { value: 0.0 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uAmp;
      uniform float uFreq;
      uniform float uPhase;

      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);

        // subtle radial wobble along tubular direction (vUv.y)
        float wob = sin(vUv.y * uFreq + uTime * 1.5 + uPhase) * uAmp;
        vec3 displaced = position + normal * wob;

        vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
        vViewDir = normalize(-mvPos.xyz);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uPower;
      uniform vec3  uColor;
      uniform float uBands;
      uniform float uSpeed;
      uniform float uPhase;

      varying vec3 vNormal;
      varying vec3 vViewDir;
      varying vec2 vUv;

      void main() {
        // Fresnel rim
        float fres = pow(1.0 - max(dot(normalize(vNormal), normalize(vViewDir)), 0.0), uPower);

        // Animated bands around the tube (vUv.y)
        float bands = 0.5 + 0.5 * sin(vUv.y * uBands + (uTime * uSpeed * 6.28318) + uPhase);
        bands = pow(bands, 3.0); // sharpen

        float glow = fres * 0.85 + bands * 0.5;
        vec3 col = uColor * glow;

        gl_FragColor = vec4(col, glow); // alpha scales with glow for additive edges
      }
    `,
  });
}

export function createPortalRing(
  seed = 0,
  {
    baseRadius = 2,
    tube = 0.12,
    coreColor = 0x062a2a,
    emissive = 0x00ffff,
    glowColor = 0xff00ff,
  }: Pick<
    PortalRingsOptions,
    "baseRadius" | "tube" | "coreColor" | "emissive" | "glowColor"
  > = {}
): UpdatableGroup {
  const geometry = new THREE.TorusGeometry(baseRadius, tube, 32, 256);

  const coreMat = new THREE.MeshPhysicalMaterial({
    color: coreColor,
    roughness: 0.35,
    metalness: 0.1,
    emissive,
    emissiveIntensity: 1.5,
    clearcoat: 0.6,
    clearcoatRoughness: 0.4,
  });
  const core = new THREE.Mesh(geometry, coreMat);

  const glowMat = makeFresnelGlowMaterial(new THREE.Color(glowColor));
  const glow = new THREE.Mesh(geometry.clone(), glowMat);
  glow.scale.multiplyScalar(1.15);

  const group = new THREE.Group() as UpdatableGroup;
  group.add(core);
  group.add(glow);

  const rand = (n: number) => {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  };
  const tiltX = (rand(seed + 1) - 0.5) * 0.3;
  const tiltY = (rand(seed + 2) - 0.5) * 0.3;
  const spinSpeed = 0.3 + rand(seed + 3) * 0.7;
  const pulseSpeed = 0.7 + rand(seed + 4) * 0.6;
  const phase = rand(seed + 5) * Math.PI * 2;
  (glow.material as THREE.ShaderMaterial).uniforms.uPhase.value = phase;

  group.rotation.x = tiltX;
  group.rotation.y = tiltY;

  let t = 0;
  group.userData.update = (dt: number) => {
    t += dt;

    group.rotation.z += dt * spinSpeed * 0.5;
    const breathe = 1.0 + Math.sin(t * 0.8 + phase) * 0.02;
    group.scale.setScalar(breathe);

    (core.material as THREE.MeshPhysicalMaterial).emissiveIntensity =
      1.2 + Math.sin(t * pulseSpeed + phase) * 0.8;

    (glow.material as THREE.ShaderMaterial).uniforms.uTime.value = t;
  };

  return group;
}

export function addPortalRings(
  scene: THREE.Scene,
  opts: PortalRingsOptions = {}
) {
  const {
    ringCount = 23,
    spacing = 4,
    baseRadius = 2,
    tube = 0.12,
    tunnelScaleStep = 0.015,
    coreColor = 0x062a2a,
    emissive = 0x00ffff,
    glowColor = 0xff00ff,
  } = opts;

  const rings: UpdatableGroup[] = [];

  for (let i = 0; i < ringCount; i++) {
    const ring = createPortalRing(i, {
      baseRadius,
      tube,
      coreColor,
      emissive,
      glowColor,
    });
    ring.position.z = -i * spacing;

    const s = 1 + i * tunnelScaleStep;
    ring.scale.setScalar(s);

    scene.add(ring);
    rings.push(ring);
  }

  const update = (dt: number) => {
    for (const r of rings) r.userData.update?.(dt);
  };

  return { rings, update };
}

export function applyPortalFog(
  scene: THREE.Scene,
  color = 0x04060a,
  density = 0.06
) {
  scene.fog = new THREE.FogExp2(color, density);
}
