import * as THREE from "three";

export type RoomCameraRig = {
  update: (dt: number) => void;
  dispose: () => void;
  isDragging: () => boolean;
};

export type RoomCameraOptions = {
  target?: THREE.Vector3;
  radius?: number;
  minRadius?: number;
  maxRadius?: number;
  minPolar?: number;
  maxPolar?: number;
  idleSpin?: number;
  idleDelay?: number;
};

export function setupRoomCamera(
  camera: THREE.PerspectiveCamera,
  dom: HTMLElement,
  opts: RoomCameraOptions = {},
): RoomCameraRig {
  const target = opts.target ?? new THREE.Vector3(0, 0.3, 0);
  const minRadius = opts.minRadius ?? 4.5;
  const maxRadius = opts.maxRadius ?? 21;
  const minPolar = opts.minPolar ?? 0.42;
  const maxPolar = opts.maxPolar ?? Math.PI * 0.62;
  const idleSpin = opts.idleSpin ?? 0.05;
  const idleDelay = opts.idleDelay ?? 2.6;

  let theta = Math.PI * 0.5;
  let phi = Math.PI * 0.44;
  let radius = opts.radius ?? 11.5;

  let goalTheta = theta;
  let goalPhi = phi;
  let goalRadius = radius;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let idleFor = 0;
  let inertia = 0;
  let pinchDist = 0;

  const beginDrag = (x: number, y: number) => {
    dragging = true;
    lastX = x;
    lastY = y;
    idleFor = 0;
    inertia = 0;
    dom.style.cursor = "grabbing";
  };

  const moveDrag = (x: number, y: number) => {
    if (!dragging) return;
    const dx = x - lastX;
    const dy = y - lastY;
    lastX = x;
    lastY = y;

    const scale = 0.0055;
    goalTheta -= dx * scale;
    goalPhi = THREE.MathUtils.clamp(goalPhi - dy * scale, minPolar, maxPolar);
    inertia = -dx * scale * 9;
    idleFor = 0;
  };

  const endDrag = () => {
    dragging = false;
    dom.style.cursor = "grab";
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    beginDrag(e.clientX, e.clientY);
  };
  const onPointerMove = (e: PointerEvent) => moveDrag(e.clientX, e.clientY);
  const onPointerUp = (e: PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    endDrag();
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    goalRadius = THREE.MathUtils.clamp(
      goalRadius * (1 + Math.sign(e.deltaY) * 0.11),
      minRadius,
      maxRadius,
    );
    idleFor = 0;
  };

  const onTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 1) {
      beginDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      dragging = false;
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
    }
  };
  const onTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 1 && dragging) {
      e.preventDefault();
      moveDrag(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY,
      );
      if (pinchDist > 0) {
        goalRadius = THREE.MathUtils.clamp(
          goalRadius * (pinchDist / d),
          minRadius,
          maxRadius,
        );
      }
      pinchDist = d;
      idleFor = 0;
    }
  };
  const onTouchEnd = () => {
    endDrag();
    pinchDist = 0;
  };

  dom.style.cursor = "grab";
  dom.style.touchAction = "none";
  dom.addEventListener("pointerdown", onPointerDown);
  dom.addEventListener("pointermove", onPointerMove);
  dom.addEventListener("pointerup", onPointerUp);
  dom.addEventListener("pointercancel", onPointerUp);
  dom.addEventListener("pointerleave", onPointerUp);
  dom.addEventListener("wheel", onWheel, { passive: false });
  dom.addEventListener("touchstart", onTouchStart, { passive: false });
  dom.addEventListener("touchmove", onTouchMove, { passive: false });
  dom.addEventListener("touchend", onTouchEnd);

  const update = (dt: number) => {
    if (!dragging) {
      idleFor += dt;
      if (Math.abs(inertia) > 0.0001) {
        goalTheta += inertia * dt;
        inertia *= Math.pow(0.02, dt);
      }
      if (idleFor > idleDelay) {
        const ramp = Math.min(1, (idleFor - idleDelay) / 1.5);
        goalTheta += idleSpin * ramp * dt;
      }
    }

    const ease = 1 - Math.pow(0.0015, dt);
    theta += (goalTheta - theta) * ease;
    phi += (goalPhi - phi) * ease;
    radius += (goalRadius - radius) * ease;

    const sinPhi = Math.sin(phi);
    camera.position.set(
      target.x + radius * sinPhi * Math.sin(theta),
      target.y + radius * Math.cos(phi),
      target.z + radius * sinPhi * Math.cos(theta),
    );
    camera.lookAt(target);
  };

  const dispose = () => {
    dom.removeEventListener("pointerdown", onPointerDown);
    dom.removeEventListener("pointermove", onPointerMove);
    dom.removeEventListener("pointerup", onPointerUp);
    dom.removeEventListener("pointercancel", onPointerUp);
    dom.removeEventListener("pointerleave", onPointerUp);
    dom.removeEventListener("wheel", onWheel);
    dom.removeEventListener("touchstart", onTouchStart);
    dom.removeEventListener("touchmove", onTouchMove);
    dom.removeEventListener("touchend", onTouchEnd);
    dom.style.cursor = "";
  };

  return { update, dispose, isDragging: () => dragging };
}
