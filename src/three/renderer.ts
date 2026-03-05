import * as THREE from "three";

export const renderer = new THREE.WebGLRenderer({ antialias: true });
// Respect device pixel ratio but cap it for perf on high-DPI devices
const DPR = Math.min(window.devicePixelRatio || 1, 2);
renderer.setPixelRatio(DPR);
renderer.setSize(window.innerWidth, window.innerHeight);
