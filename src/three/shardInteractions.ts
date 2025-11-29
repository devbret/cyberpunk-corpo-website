import * as THREE from "three";
import gsap from "gsap";
import { createShardHud, ShardHud } from "./shardHud";
import type { Department } from "./departments";

export type ShardInteractions = {
  dispose: () => void;
};

export function setupShardInteractions(
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  opts: {
    navigate: (path: string) => void;
    setGlitchAmount?: (v: number) => void;
    flightSeconds?: number;
  }
): ShardInteractions {
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const hud: ShardHud = createShardHud(scene);

  const flightSeconds = opts.flightSeconds ?? 0.9;
  let hovered: THREE.Mesh | null = null;

  function pick(ev: MouseEvent) {
    const rect = domElement.getBoundingClientRect();
    mouse.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const parent = scene.getObjectByName("shatteredCube");
    if (!parent) {
      hud.setTarget(null);
      hovered = null;
      return;
    }
    const candidates = parent.children
      .flatMap((g) => g.children)
      .filter((o): o is THREE.Mesh => o instanceof THREE.Mesh);
    const hits = raycaster.intersectObjects(candidates, false);
    const hit = hits[0]?.object as THREE.Mesh | undefined;

    if (hit && hit !== hovered) {
      hovered = hit;
      const dept =
        (hit.userData?.department as Department | undefined) ?? undefined;
      hud.setTarget(hit, dept);
      const mat = hit.material as THREE.MeshPhysicalMaterial;
      gsap.to(mat, { emissiveIntensity: 1.2, duration: 0.2, overwrite: true });
    } else if (!hit && hovered) {
      const mat = hovered.material as THREE.MeshPhysicalMaterial;
      gsap.to(mat, { emissiveIntensity: 0.4, duration: 0.3, overwrite: true });
      hovered = null;
      hud.setTarget(null);
    }
  }

  function click() {
    if (!hovered) return;
    const dept = hovered.userData?.department as Department | undefined;
    if (!dept) return;

    const targetPos = new THREE.Vector3();
    hovered.getWorldPosition(targetPos);

    const camStart = camera.position.clone();
    const lookStart = new THREE.Vector3().copy(targetPos);
    const camEnd = targetPos.clone().add(new THREE.Vector3(0, 0, 1.3));

    console.log(camStart);

    opts.setGlitchAmount?.(0.45);

    const tl = gsap.timeline({
      onComplete: () => {
        opts.setGlitchAmount?.(0.1);
        opts.navigate(dept.path);
      },
    });

    tl.to(
      camera.position,
      {
        x: camEnd.x,
        y: camEnd.y,
        z: camEnd.z,
        duration: flightSeconds,
        ease: "power3.in",
      },
      0
    );
    tl.to(
      {},
      {
        duration: flightSeconds,
        onUpdate: () => {
          camera.lookAt(lookStart);
        },
      },
      0
    );
  }

  domElement.addEventListener("mousemove", pick);
  domElement.addEventListener("mouseleave", () => {
    hud.setTarget(null);
    hovered = null;
  });
  domElement.addEventListener("click", click);

  return {
    dispose: () => {
      domElement.removeEventListener("mousemove", pick);
      domElement.removeEventListener("mouseleave", () => {});
      domElement.removeEventListener("click", click);
      hud.dispose();
    },
  };
}
