import React, { useEffect, useRef } from "react";
import * as THREE from "three";
import { gsap } from "gsap";

let rendererSingleton: THREE.WebGLRenderer | null = null;
let sceneSingleton: THREE.Scene | null = null;
let cameraSingleton: THREE.PerspectiveCamera | null = null;

let ringsSingleton: THREE.Group[] = [];
let cubeSingleton: THREE.Mesh | null = null;
let cubeMaterialSingleton: THREE.MeshStandardMaterial | null = null;
let smallCubeGroupSingleton: THREE.Group | null = null;

let cameraTargetZ = 6;
const keys: { [key: string]: boolean } = {
  ArrowUp: false,
  ArrowDown: false,
};

if (!rendererSingleton) {
  rendererSingleton = new THREE.WebGLRenderer({ antialias: true });
  rendererSingleton.setSize(window.innerWidth, window.innerHeight);

  sceneSingleton = new THREE.Scene();
  sceneSingleton.background = new THREE.Color(0x000000);
  sceneSingleton.fog = new THREE.FogExp2(0x000000, 0.02);

  cameraSingleton = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  cameraSingleton.position.set(0, 0, 6);

  const ringCount = 23;
  const spacing = 4;
  ringsSingleton = [];

  function createPortalRing() {
    const geometry = new THREE.TorusGeometry(2, 0.1, 16, 100);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const ringMesh = new THREE.Mesh(geometry, material);

    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xff00ff,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.Mesh(geometry.clone(), glowMaterial);
    glowMesh.scale.multiplyScalar(1.2);

    const group = new THREE.Group();
    group.add(ringMesh);
    group.add(glowMesh);
    return group;
  }

  for (let i = 0; i < ringCount; i++) {
    const ring = createPortalRing();
    ring.position.z = -i * spacing;
    sceneSingleton!.add(ring);
    ringsSingleton.push(ring);
  }

  const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  cubeMaterialSingleton = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
    transparent: true,
    opacity: 1,
  });
  cubeSingleton = new THREE.Mesh(cubeGeometry, cubeMaterialSingleton);
  cubeSingleton.position.z = -(ringCount * spacing) - 2;
  sceneSingleton!.add(cubeSingleton);

  function createDigitTexture(digit: string): THREE.CanvasTexture {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d");
    if (context) {
      context.clearRect(0, 0, size, size);
      context.font = "bold 48px monospace";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#ffffff";
      context.fillText(digit, size / 2, size / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    return texture;
  }

  function createBinaryStarField() {
    const starCount = 10000;
    for (let i = 0; i < starCount; i++) {
      const digit = Math.random() < 0.5 ? "0" : "1";
      const texture = createDigitTexture(digit);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.set(
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200,
        (Math.random() - 0.5) * 200
      );
      sprite.scale.set(2, 2, 1);
      sceneSingleton!.add(sprite);
    }
  }
  createBinaryStarField();

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
  sceneSingleton!.add(ambientLight);
  const pointLight = new THREE.PointLight(0x00ffff, 1, 10);
  pointLight.position.set(0, 2, 2);
  sceneSingleton!.add(pointLight);

  const keyDownHandler = (event: KeyboardEvent) => {
    if (event.key in keys) keys[event.key] = true;
  };
  const keyUpHandler = (event: KeyboardEvent) => {
    if (event.key in keys) keys[event.key] = false;
  };
  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);

  let isDragging = false;
  rendererSingleton.domElement.addEventListener("mousedown", () => {
    isDragging = true;
  });
  rendererSingleton.domElement.addEventListener("mousemove", (event) => {
    if (isDragging) {
      if (smallCubeGroupSingleton) {
        smallCubeGroupSingleton.rotation.y += event.movementX * 0.005;
        smallCubeGroupSingleton.rotation.x += event.movementY * 0.005;
      } else if (cubeSingleton) {
        const deltaRotationQuaternion = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(
            toRadians(event.movementY),
            toRadians(event.movementX),
            0,
            "XYZ"
          )
        );
        cubeSingleton.quaternion.multiplyQuaternions(
          deltaRotationQuaternion,
          cubeSingleton.quaternion
        );
      }
    }
  });
  rendererSingleton.domElement.addEventListener("mouseup", () => {
    isDragging = false;
  });
  rendererSingleton.domElement.addEventListener("mouseleave", () => {
    isDragging = false;
  });
  function toRadians(angle: number) {
    return angle * (Math.PI / 180);
  }

  const cubePosition = cubeSingleton!.position.clone();
  function breakCubeIntoSmallerCubes() {
    if (!cubeSingleton) return;
    sceneSingleton!.remove(cubeSingleton);
    cubeSingleton = null;
    smallCubeGroupSingleton = new THREE.Group();
    smallCubeGroupSingleton.position.copy(cubePosition);
    sceneSingleton!.add(smallCubeGroupSingleton);

    const originalSize = 1.5;
    const subCubeSize = originalSize / 2;
    const halfSubCube = subCubeSize / 2;
    const offsets = [
      [-halfSubCube, -halfSubCube, -halfSubCube],
      [-halfSubCube, -halfSubCube, halfSubCube],
      [-halfSubCube, halfSubCube, -halfSubCube],
      [-halfSubCube, halfSubCube, halfSubCube],
      [halfSubCube, -halfSubCube, -halfSubCube],
      [halfSubCube, -halfSubCube, halfSubCube],
      [halfSubCube, halfSubCube, -halfSubCube],
      [halfSubCube, halfSubCube, halfSubCube],
    ];

    const colors = [
      0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xffa500,
      0x800080,
    ];

    const smallCubes: THREE.Mesh[] = [];
    offsets.forEach((offset, index) => {
      const geometry = new THREE.BoxGeometry(
        subCubeSize,
        subCubeSize,
        subCubeSize
      );
      const material = new THREE.MeshStandardMaterial({
        color: colors[index],
        emissive: 0x000000,
        emissiveIntensity: 0.0,
        transparent: true,
        opacity: 1,
      });
      const smallCube = new THREE.Mesh(geometry, material);
      smallCube.position.set(0, 0, 0);
      smallCube.userData.offset = new THREE.Vector3(...offset);
      smallCubeGroupSingleton!.add(smallCube);
      smallCubes.push(smallCube);
    });

    const sphereLight = new THREE.PointLight(0xffffff, 3, 20);
    sphereLight.position.set(0, 0, 0);
    smallCubeGroupSingleton!.add(sphereLight);

    const sphereGeometry = new THREE.SphereGeometry(subCubeSize * 0.3, 32, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereLight.add(sphereMesh);

    smallCubes.forEach((smallCube) => {
      const { offset } = smallCube.userData;
      gsap.to(smallCube.position, {
        duration: 1,
        x: offset.x * 4,
        y: offset.y * 4,
        z: offset.z * 4,
        ease: "power2.out",
      });
    });
  }

  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickHandler = (event: MouseEvent) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, cameraSingleton!);
    if (smallCubeGroupSingleton) {
      const intersects = raycaster.intersectObjects(
        smallCubeGroupSingleton.children,
        true
      );
      if (intersects.length > 0) {
        console.log("Small cube clicked:", intersects[0].object);
      }
    } else if (cubeSingleton) {
      const intersects = raycaster.intersectObject(cubeSingleton, true);
      if (intersects.length > 0) {
        breakCubeIntoSmallerCubes();
      }
    }
  };
  window.addEventListener("click", clickHandler);

  const clock = new THREE.Clock();
  const keySpeed = 30.0;
  const animate = () => {
    requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (keys.ArrowUp) cameraTargetZ -= keySpeed * delta;
    if (keys.ArrowDown) cameraTargetZ += keySpeed * delta;
    const cameraMinZ = -((ringCount - 1) * spacing) - 2;
    cameraTargetZ = Math.max(cameraMinZ, Math.min(6, cameraTargetZ));
    cameraSingleton!.position.z +=
      (cameraTargetZ - cameraSingleton!.position.z) * 0.1;

    ringsSingleton.forEach((ring) => {
      ring.rotation.z += delta * 0.2;
    });
    if (cubeSingleton && cubeMaterialSingleton) {
      const distanceToCube = Math.abs(
        cubeSingleton.position.z - cameraSingleton!.position.z
      );
      const maxDistance = Math.abs(cameraMinZ - cubeSingleton.position.z);
      cubeMaterialSingleton.emissiveIntensity =
        1.0 - distanceToCube / maxDistance;
    }
    rendererSingleton!.render(sceneSingleton!, cameraSingleton!);
  };
  animate();
}

const ThreeScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current || !rendererSingleton) return;
    if (rendererSingleton.domElement.parentElement !== mountRef.current) {
      if (rendererSingleton.domElement.parentElement) {
        rendererSingleton.domElement.parentElement.removeChild(
          rendererSingleton.domElement
        );
      }
      mountRef.current.appendChild(rendererSingleton.domElement);
    }

    const handleResize = () => {
      if (!mountRef.current || !cameraSingleton || !rendererSingleton) return;
      cameraSingleton.aspect =
        mountRef.current.clientWidth / mountRef.current.clientHeight;
      cameraSingleton.updateProjectionMatrix();
      rendererSingleton.setSize(
        mountRef.current.clientWidth,
        mountRef.current.clientHeight
      );
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />;
};

export default ThreeScene;
