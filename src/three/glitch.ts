import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const GlitchShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uTime: { value: 0 },
    uAmount: { value: 0.0 },
    uRGBShift: { value: 0.003 },
    uBlockiness: { value: 64.0 },
    uJitter: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uRGBShift;
    uniform float uBlockiness;
    uniform float uJitter;
    varying vec2 vUv;

    float rand(vec2 co){
      return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
    }

    void main() {
      vec2 uv = vUv;

      vec2 grid = floor(uv * uBlockiness) / uBlockiness;
      float r = rand(grid + floor(uTime));
      float j = step(0.8, r * (0.5 + uJitter));
      uv += (j * (r - 0.5)) * 0.02 * uAmount;

      float shift = uRGBShift * uAmount;
      vec4 col;
      col.r = texture2D(tDiffuse, uv + vec2( shift, 0.0)).r;
      col.g = texture2D(tDiffuse, uv + vec2(-shift, 0.0)).g;
      col.b = texture2D(tDiffuse, uv).b;
      col.a = 1.0;

      float flick = 1.0 + (rand(vec2(uTime, uv.y)) - 0.5) * 0.05 * uAmount;
      gl_FragColor = vec4(col.rgb * flick, 1.0);
    }
  `,
};

export type GlitchController = {
  composer: EffectComposer;
  pass: ShaderPass;
  setAmount: (v: number) => void;
  setEnabled: (on: boolean) => void;
  setPixelRatio: (pr: number) => void;
  setSize: (w: number, h: number, scale?: number) => void;
  setResolutionScale: (s: number) => void;
  dispose: () => void;
  render: (dt?: number) => void;
};

function safely(fn: () => void): void {
  try {
    fn();
  } catch {
    return;
  }
}

export type GlitchComposerOptions = {
  bloom?: {
    strength?: number;
    radius?: number;
    threshold?: number;
  };
};

export function setupGlitchComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera,
  opts: GlitchComposerOptions = {},
): GlitchController {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const glitchPass = new ShaderPass(GlitchShader);

  composer.addPass(renderPass);

  let bloomPass: UnrealBloomPass | null = null;
  let outputPass: OutputPass | null = null;
  if (opts.bloom) {
    const size = renderer.getSize(new THREE.Vector2());
    bloomPass = new UnrealBloomPass(
      size,
      opts.bloom.strength ?? 0.62,
      opts.bloom.radius ?? 0.55,
      opts.bloom.threshold ?? 0.22,
    );
    composer.addPass(bloomPass);
  }

  composer.addPass(glitchPass);

  if (opts.bloom) {
    outputPass = new OutputPass();
    composer.addPass(outputPass);
  }

  glitchPass.enabled = true;
  glitchPass.material.uniforms.uAmount.value = 0.0;

  let time = 0;
  let enabled = true;
  let amount = 0;
  let resolutionScale = 1;
  const render = (dt = 0.016) => {
    time += dt;
    glitchPass.material.uniforms.uTime.value = time;
    glitchPass.material.uniforms.uJitter.value = Math.random();

    const glitchLive = enabled && amount > 0.0001;
    glitchPass.enabled = glitchLive;

    if (!bloomPass && !glitchLive) {
      renderer.render(scene, camera);
      return;
    }

    composer.render();
  };

  return {
    composer,
    pass: glitchPass,
    setAmount: (v) => {
      amount = THREE.MathUtils.clamp(v, 0, 1);
      glitchPass.material.uniforms.uAmount.value = amount;
    },
    setEnabled: (on) => {
      enabled = on;
    },
    setPixelRatio: (pr) => {
      composer.setPixelRatio(pr);
    },
    setSize: (w, h, scale = resolutionScale) => {
      const sw = Math.max(1, Math.floor(w * scale));
      const sh = Math.max(1, Math.floor(h * scale));
      composer.setSize(sw, sh);
    },
    setResolutionScale: (s) => {
      resolutionScale = s;
      const canvas = renderer.domElement;
      const w = canvas.clientWidth || canvas.width || window.innerWidth;
      const h = canvas.clientHeight || canvas.height || window.innerHeight;
      composer.setSize(
        Math.max(1, Math.floor(w * s)),
        Math.max(1, Math.floor(h * s)),
      );
    },
    dispose: () => {
      safely(() => glitchPass.material?.dispose());
      safely(() => bloomPass?.dispose());
      safely(() => outputPass?.dispose());
      safely(() => composer.dispose());
    },
    render,
  };
}
