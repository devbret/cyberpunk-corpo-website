import * as THREE from "three";
import type { Department } from "./cube";

export const keys: { [key: string]: boolean } = {
  ArrowUp: false,
  ArrowDown: false,
};

export function setupKeyEvents() {
  const keyDownHandler = (event: KeyboardEvent) => {
    if (event.key in keys) keys[event.key] = true;
  };
  const keyUpHandler = (event: KeyboardEvent) => {
    if (event.key in keys) keys[event.key] = false;
  };
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);
}

type UserDataWithDepartment = { department?: unknown };

function hasDepartmentUserData(obj: THREE.Object3D): obj is THREE.Object3D & {
  userData: UserDataWithDepartment;
} {
  const ud = obj.userData as unknown as UserDataWithDepartment;
  return ud.department !== undefined;
}

function isDepartment(value: unknown): value is Department {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.code === "string" &&
    typeof v.name === "string" &&
    typeof v.path === "string" &&
    typeof v.color === "number" &&
    typeof v.blurb === "string"
  );
}

function findDepartment(obj: THREE.Object3D): Department | null {
  let cur: THREE.Object3D | null = obj;
  while (cur) {
    const ud = cur.userData as unknown as UserDataWithDepartment;
    if (isDepartment(ud.department)) return ud.department;
    cur = cur.parent;
  }
  return null;
}

export function setupMouseEvents(
  rendererDom: HTMLElement,
  camera: THREE.PerspectiveCamera,
  cubeRef: { current: THREE.Mesh | null },
  smallCubeGroupRef: { current: THREE.Group | null },
  onCubeClick: () => void,
  onDeptClick?: (
    dept: Department,
    obj: THREE.Object3D,
    point: THREE.Vector3
  ) => void
): () => void {
  let isMouseDown = false;
  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;

  const onMousedown = (event: MouseEvent) => {
    isMouseDown = true;
    isDragging = false;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
  };

  const onMousemove = (event: MouseEvent) => {
    if (!isMouseDown) return;
    if (
      !isDragging &&
      (Math.abs(event.clientX - dragStartX) > 2 ||
        Math.abs(event.clientY - dragStartY) > 2)
    ) {
      isDragging = true;
    }
    if (isDragging) {
      if (smallCubeGroupRef.current) {
        smallCubeGroupRef.current.rotation.y += event.movementX * 0.005;
        smallCubeGroupRef.current.rotation.x += event.movementY * 0.005;
      } else if (cubeRef.current) {
        const deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            toRadians(event.movementY),
            toRadians(event.movementX),
            0,
            "XYZ"
          )
        );
        cubeRef.current.quaternion.multiplyQuaternions(
          deltaRotationQuaternion,
          cubeRef.current.quaternion
        );
      }
    }
  };

  const onMouseup = (event: MouseEvent) => {
    if (!isMouseDown) return;
    if (!isDragging) handleClick(event);
    isMouseDown = false;
    isDragging = false;
  };

  const onMouseleave = () => {
    isMouseDown = false;
    isDragging = false;
  };

  rendererDom.addEventListener("mousedown", onMousedown);
  rendererDom.addEventListener("mousemove", onMousemove);
  rendererDom.addEventListener("mouseup", onMouseup);
  rendererDom.addEventListener("mouseleave", onMouseleave);

  function handleClick(event: MouseEvent) {
    const rect = rendererDom.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    if (smallCubeGroupRef.current) {
      const intersects = raycaster.intersectObjects(
        smallCubeGroupRef.current.children,
        true
      );
      if (!intersects.length) return;

      type DeptHit = {
        dept: Department;
        root: THREE.Object3D;
        point: THREE.Vector3;
        screenDist2: number;
      };

      const uniqueByRoot = new Map<string, DeptHit>();

      for (const hit of intersects) {
        const dept = findDepartment(hit.object);
        if (!dept) continue;

        let root: THREE.Object3D = hit.object;
        while (root.parent && !hasDepartmentUserData(root)) {
          root = root.parent;
        }

        const p = hit.point.clone().project(camera);
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const screenDist2 = dx * dx + dy * dy;

        const existing = uniqueByRoot.get(root.uuid);
        if (!existing || screenDist2 < existing.screenDist2) {
          uniqueByRoot.set(root.uuid, {
            dept,
            root,
            point: hit.point.clone(),
            screenDist2,
          });
        }
      }

      const candidates = Array.from(uniqueByRoot.values());
      if (!candidates.length) return;

      candidates.sort((a, b) => a.screenDist2 - b.screenDist2);
      const chosen = candidates[0];

      onDeptClick?.(chosen.dept, chosen.root, chosen.point);
      return;
    }

    if (cubeRef.current) {
      const intersects = raycaster.intersectObject(cubeRef.current, true);
      if (intersects.length > 0) onCubeClick();
    }
  }

  function toRadians(angle: number) {
    return angle * (Math.PI / 180);
  }

  return () => {
    rendererDom.removeEventListener("mousedown", onMousedown);
    rendererDom.removeEventListener("mousemove", onMousemove);
    rendererDom.removeEventListener("mouseup", onMouseup);
    rendererDom.removeEventListener("mouseleave", onMouseleave);
  };
}
