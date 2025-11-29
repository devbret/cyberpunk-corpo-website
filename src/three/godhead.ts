import * as THREE from "three";

export type GodheadOptions = {
  position?: THREE.Vector3;
  scale?: number;
  coreRadius?: number;
  cageSize?: number;
  haloInner?: number;
  haloOuter?: number;
  coreColor?: number;
  cageColor?: number;
  haloColor?: number;
};

export type UpdatableObject3D = THREE.Object3D & {
  userData: {
    update?: (dt: number) => void;
  };
};

export function createGodhead(opts: GodheadOptions = {}) {
  const {
    position = new THREE.Vector3(30, 20, -80),
    scale = 1.0,
    coreRadius = 1.25,
    cageSize = 2.1,
    haloInner = 2.45,
    haloOuter = 2.7,
    coreColor = 0xffd700,
    cageColor = 0xffffff,
    haloColor = 0xffffff,
  } = opts;

  const group = new THREE.Group() as UpdatableObject3D;
  group.position.copy(position);
  group.scale.setScalar(scale);

  const coreGeo = new THREE.IcosahedronGeometry(coreRadius, 6);
  const coreMat = new THREE.MeshBasicMaterial({
    color: coreColor,
    transparent: true,
    opacity: 1.0,
    toneMapped: false,
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  group.add(core);

  const auraCanvas = document.createElement("canvas");
  auraCanvas.width = 256;
  auraCanvas.height = 256;
  const actx = auraCanvas.getContext("2d")!;
  const grd = actx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grd.addColorStop(0.0, "rgba(255,255,255,0.55)");
  grd.addColorStop(0.6, "rgba(255,255,255,0.10)");
  grd.addColorStop(1.0, "rgba(255,255,255,0.0)");
  actx.fillStyle = grd;
  actx.fillRect(0, 0, 256, 256);

  const auraTex = new THREE.CanvasTexture(auraCanvas);
  auraTex.minFilter = THREE.LinearFilter;
  auraTex.magFilter = THREE.LinearFilter;

  const auraMat = new THREE.SpriteMaterial({
    map: auraTex,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
    opacity: 0.8,
    toneMapped: false,
  });
  const aura = new THREE.Sprite(auraMat);
  const auraScale = coreRadius * 4.5;
  aura.scale.set(auraScale, auraScale, 1);
  group.add(aura);

  const cageGeo = new THREE.OctahedronGeometry(cageSize, 0);
  const cageMat = new THREE.MeshBasicMaterial({
    color: cageColor,
    wireframe: true,
    transparent: true,
    opacity: 0.9,
    toneMapped: false,
    depthTest: true,
    depthWrite: false,
  });
  const cage = new THREE.Mesh(cageGeo, cageMat);
  group.add(cage);

  const haloGeo = new THREE.RingGeometry(haloInner, haloOuter, 96);
  const haloMat = new THREE.MeshBasicMaterial({
    color: haloColor,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  const halo = new THREE.Mesh(haloGeo, haloMat);
  halo.rotation.x = Math.PI / 2.0;
  halo.rotation.z = Math.PI * 0.07;
  group.add(halo);

  let t = 0;

  group.userData.update = (dt: number) => {
    t += dt;

    const s = 1.0 + Math.sin(t * 1.2) * 0.045;
    core.scale.setScalar(s);

    aura.scale.set(auraScale * s, auraScale * s, 1);

    cage.rotation.x += dt * 0.18;
    cage.rotation.y += dt * 0.135;

    const base = 0.42;
    const amp = 0.18;
    (halo.material as THREE.MeshBasicMaterial).opacity =
      base + Math.sin(t * 2.7) * amp;
  };

  return {
    group,
    update(dt: number) {
      group.userData.update?.(dt);
    },
    dispose() {
      core.geometry.dispose();
      core.material.dispose();

      aura.material.dispose();
      auraTex.dispose();

      cage.geometry.dispose();
      cage.material.dispose();

      halo.geometry.dispose();
      halo.material.dispose();
    },
  };
}
