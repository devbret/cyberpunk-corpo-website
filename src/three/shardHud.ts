import * as THREE from "three";
import type { Department } from "./departments";

export type ShardHud = {
  group: THREE.Group;
  setTarget: (obj: THREE.Object3D | null, dept?: Department) => void;
  dispose: () => void;
};

function makeLabelTexture(
  title: string,
  blurb: string,
  color: string
): THREE.CanvasTexture {
  const w = 512,
    h = 192,
    r = 16;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d");
  if (!g) throw new Error("2D context not available");

  g.clearRect(0, 0, w, h);
  g.fillStyle = "rgba(10,15,18,0.8)";
  g.strokeStyle = color;
  g.lineWidth = 3;

  g.beginPath();
  g.moveTo(r, 0);
  g.arcTo(w, 0, w, h, r);
  g.arcTo(w, h, 0, h, r);
  g.arcTo(0, h, 0, 0, r);
  g.arcTo(0, 0, w, 0, r);
  g.closePath();
  g.fill();
  g.stroke();

  g.fillStyle = color;
  g.font = "700 36px monospace";
  g.textBaseline = "top";
  g.fillText(title, 20, 16);

  g.fillStyle = "rgba(230,238,245,0.9)";
  g.font = "500 24px monospace";
  const lines = wrap(blurb, 44);
  lines.forEach((ln, i) => g.fillText(ln, 20, 72 + i * 30));

  const tex = new THREE.CanvasTexture(c);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function wrap(text: string, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const w of text.split(" ")) {
    if ((cur + " " + w).trim().length > max) {
      out.push(cur.trim());
      cur = w;
    } else {
      cur += " " + w;
    }
  }
  if (cur) out.push(cur.trim());
  return out;
}

export function createShardHud(scene: THREE.Scene): ShardHud {
  const group = new THREE.Group();
  group.name = "shardHUD";
  group.visible = false;

  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.MeshBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  const plane = new THREE.Mesh(planeGeo, mat);
  plane.renderOrder = 999;
  group.add(plane);

  scene.add(group);

  const setTarget = (obj: THREE.Object3D | null, dept?: Department) => {
    if (!obj || !dept) {
      group.visible = false;
      return;
    }
    const bbox = new THREE.Box3().setFromObject(obj);
    const center = bbox.getCenter(new THREE.Vector3());
    const size = bbox.getSize(new THREE.Vector3());
    group.position.copy(center).add(new THREE.Vector3(0, size.y * 0.85, 0));
    group.lookAt(scene.position.clone().setZ(group.position.z - 10)); // approx face camera

    const hex = `#${dept.color.toString(16).padStart(6, "0")}`;
    const tex = makeLabelTexture(dept.title, dept.blurb, hex);
    (plane.material as THREE.MeshBasicMaterial).map?.dispose();
    (plane.material as THREE.MeshBasicMaterial).map = tex;

    const aspect = tex.image.width / tex.image.height;
    const width = 3.2;
    plane.scale.set(width, width / aspect, 1);

    group.visible = true;
  };

  const dispose = () => {
    (plane.material as THREE.MeshBasicMaterial).map?.dispose();
    plane.geometry.dispose();
    plane.material.dispose();
    scene.remove(group);
  };

  return { group, setTarget, dispose };
}
