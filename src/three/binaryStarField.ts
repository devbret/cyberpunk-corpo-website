import * as THREE from "three";

export function createDigitTexture(digit: string): THREE.CanvasTexture {
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

export function createBinaryStarField(scene: THREE.Scene, starCount = 10000) {
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
