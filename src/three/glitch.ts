import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";

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

      // blocky UV jitter
      vec2 grid = floor(uv * uBlockiness) / uBlockiness;
      float r = rand(grid + floor(uTime));
      float j = step(0.8, r * (0.5 + uJitter)); // occasional blocks
      uv += (j * (r - 0.5)) * 0.02 * uAmount;

      // RGB split
      float shift = uRGBShift * uAmount;
      vec4 col;
      col.r = texture2D(tDiffuse, uv + vec2( shift, 0.0)).r;
      col.g = texture2D(tDiffuse, uv + vec2(-shift, 0.0)).g;
      col.b = texture2D(tDiffuse, uv).b;
      col.a = 1.0;

      // subtle brightness flicker
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
  render: (dt?: number) => void;
};

export function setupGlitchComposer(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.Camera
): GlitchController {
  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  const glitchPass = new ShaderPass(GlitchShader);

  composer.addPass(renderPass);
  composer.addPass(glitchPass);

  glitchPass.enabled = true;
  glitchPass.material.uniforms.uAmount.value = 0.0;

  let time = 0;
  const render = (dt = 0.016) => {
    time += dt;
    glitchPass.material.uniforms.uTime.value = time;

    glitchPass.material.uniforms.uJitter.value = Math.random();

    composer.render();
  };

  return {
    composer,
    pass: glitchPass,
    setAmount: (v) => {
      glitchPass.material.uniforms.uAmount.value = THREE.MathUtils.clamp(
        v,
        0,
        1
      );
    },
    setEnabled: (on) => {
      glitchPass.enabled = on;
    },
    render,
  };
}
