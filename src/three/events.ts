import * as THREE from "three";

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

export function setupMouseEvents(
  rendererDom: HTMLElement,
  camera: THREE.PerspectiveCamera,
  cubeRef: { current: THREE.Mesh | null },
  smallCubeGroupRef: { current: THREE.Group | null },
  onCubeClick: () => void
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
    if (!isDragging) {
      handleClick(event);
    }
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
      if (intersects.length > 0) {
        const clickedCube = intersects[0].object;
        const destination = clickedCube.userData?.destination;
        if (destination) {
          window.location.href = destination;
        } else {
          console.log("Small cube clicked, but no destination set.");
        }
        return;
      }
    }
    if (cubeRef.current) {
      const intersects = raycaster.intersectObject(cubeRef.current, true);
      if (intersects.length > 0) {
        onCubeClick();
      }
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
