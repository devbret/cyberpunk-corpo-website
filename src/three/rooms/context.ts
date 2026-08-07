import * as THREE from "three";
import type { Department } from "../cube";
import type { DeptLore, FeedLine } from "../roomLore";
import type { Fx } from "../roomFx";

export type RoomCtx = {
  dept: Department;
  lore: DeptLore;
  color: THREE.Color;
  camera: THREE.PerspectiveCamera;
  root: THREE.Group;
  add: <T extends THREE.Object3D>(obj: T, parent?: THREE.Object3D) => T;
  fx: <T extends Fx>(fx: T, parent?: THREE.Object3D) => T;
  own: <T extends { dispose: () => void }>(res: T) => T;
  tick: (fn: (dt: number, t: number) => void) => void;
  alert: (fn: (level: number) => void) => void;
  say: (line: FeedLine) => void;
};

export type RoomProgram = (ctx: RoomCtx) => void;

export function structMaterial(
  ctx: RoomCtx,
  base = 0x080e18,
  emissive = 0.07,
): THREE.MeshStandardMaterial {
  return ctx.own(
    new THREE.MeshStandardMaterial({
      color: base,
      roughness: 0.48,
      metalness: 0.86,
      emissive: ctx.color,
      emissiveIntensity: emissive,
    }),
  );
}

export function lineMaterial(ctx: RoomCtx, opacity = 0.6): THREE.LineBasicMaterial {
  return ctx.own(
    new THREE.LineBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

export function glowMaterial(ctx: RoomCtx, opacity = 0.9): THREE.MeshBasicMaterial {
  return ctx.own(
    new THREE.MeshBasicMaterial({
      color: ctx.color,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
}

export function panelWithEdges(
  ctx: RoomCtx,
  geo: THREE.BufferGeometry,
  mat: THREE.Material,
  edgeMat: THREE.LineBasicMaterial,
): THREE.Group {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  const edges = ctx.own(new THREE.EdgesGeometry(geo));
  g.add(new THREE.LineSegments(edges, edgeMat));
  return g;
}

export function ring(
  count: number,
  radius: number,
  y = 0,
  offset = 0,
): THREE.Vector3[] {
  const out: THREE.Vector3[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + offset;
    out.push(new THREE.Vector3(Math.cos(a) * radius, y, Math.sin(a) * radius));
  }
  return out;
}

export const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export function swell(x: number): number {
  const c = THREE.MathUtils.clamp(x, 0, 1);
  return Math.sin(c * Math.PI);
}
