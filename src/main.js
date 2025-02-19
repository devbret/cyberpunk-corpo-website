import * as THREE from "three";

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

scene.fog = new THREE.FogExp2(0x000000, 0.02);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const rings = [];
const ringCount = 23;
const spacing = 4;

function createPortalRing() {
  const geometry = new THREE.TorusGeometry(2, 0.1, 16, 100);
  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
  });
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
  scene.add(ring);
  rings.push(ring);
}

const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
const cubeMaterial = new THREE.MeshStandardMaterial({
  color: 0xffffff,
  emissive: 0x000000,
  emissiveIntensity: 0.0,
});
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
cube.position.z = -(ringCount * spacing) - 2;
scene.add(cube);

function createDigitTexture(digit) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");

  context.clearRect(0, 0, size, size);

  context.font = "12px monospace";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#ffffff";
  context.fillText(digit, size / 2, size / 2);

  return new THREE.CanvasTexture(canvas);
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

    scene.add(sprite);
  }
}

createBinaryStarField();

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x00ffff, 1, 10);
pointLight.position.set(0, 2, 2);
scene.add(pointLight);

const cameraMaxZ = 6;
const cameraMinZ = -((ringCount - 1) * spacing) - 2;

let cameraTargetZ = camera.position.z;

const keys = {
  ArrowUp: false,
  ArrowDown: false,
};

document.addEventListener("keydown", (event) => {
  if (event.key in keys) keys[event.key] = true;
});

document.addEventListener("keyup", (event) => {
  if (event.key in keys) keys[event.key] = false;
});

const clock = new THREE.Clock();
const keySpeed = 30.0;

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (keys.ArrowUp) cameraTargetZ -= keySpeed * delta;
  if (keys.ArrowDown) cameraTargetZ += keySpeed * delta;

  cameraTargetZ = Math.max(cameraMinZ, Math.min(cameraMaxZ, cameraTargetZ));
  camera.position.z += (cameraTargetZ - camera.position.z) * 0.1;

  rings.forEach((ring) => {
    ring.rotation.z += delta * 0.2;
  });

  const distanceToCube = Math.abs(cube.position.z - camera.position.z);
  const maxDistance = Math.abs(cameraMinZ - cube.position.z);
  cubeMaterial.emissiveIntensity = 1.0 - distanceToCube / maxDistance;

  renderer.render(scene, camera);
}

animate();

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
