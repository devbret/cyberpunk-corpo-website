import * as THREE from "three";
import type { Department } from "./cube";
import { loreFor, type FeedLine } from "./roomLore";
import {
  createFloorPulse,
  createMotes,
  createStatPanel,
  createTerminalPanel,
  createWallGrid,
  type Fx,
} from "./roomFx";
import { programFor } from "./rooms";
import type { RoomCtx } from "./rooms/context";
import { createP5Surfaces } from "../p5/p5Surface";
import { sketchesFor } from "../p5/sketches";

export type RoomEvent = {
  code: string;
  label: string;
  tone: "info" | "warn" | "alert";
};

export type RoomHandle = {
  update: (dt: number) => void;
  dispose: () => void;
};

export type BuildRoomOptions = {
  onEvent?: (event: RoomEvent | null) => void;
};

type EnvPreset = {
  fogDensity: number;
  floorColor: number;
  gridOpacity: number;
  moteCount: number;
  moteVertical: number;
  pulsePeriod: number;
  ambient: number;
  wallHeight: number;
};

const ENV: Record<string, EnvPreset> = {
  "R&D": {
    fogDensity: 0.03,
    floorColor: 0x0a0616,
    gridOpacity: 0.16,
    moteCount: 560,
    moteVertical: 0.35,
    pulsePeriod: 5.2,
    ambient: 1.4,
    wallHeight: 11,
  },
  SEC: {
    fogDensity: 0.021,
    floorColor: 0x120509,
    gridOpacity: 0.2,
    moteCount: 380,
    moteVertical: 0.1,
    pulsePeriod: 2.6,
    ambient: 1.1,
    wallHeight: 12,
  },
  FIN: {
    fogDensity: 0.024,
    floorColor: 0x120b03,
    gridOpacity: 0.18,
    moteCount: 420,
    moteVertical: -0.5,
    pulsePeriod: 3.4,
    ambient: 1.5,
    wallHeight: 11,
  },
  AI: {
    fogDensity: 0.018,
    floorColor: 0x03101a,
    gridOpacity: 0.22,
    moteCount: 620,
    moteVertical: 0.55,
    pulsePeriod: 3.0,
    ambient: 1.3,
    wallHeight: 12,
  },
  OPS: {
    fogDensity: 0.028,
    floorColor: 0x0a1004,
    gridOpacity: 0.24,
    moteCount: 300,
    moteVertical: 0.08,
    pulsePeriod: 4.0,
    ambient: 1.5,
    wallHeight: 10,
  },
  PR: {
    fogDensity: 0.015,
    floorColor: 0x04120a,
    gridOpacity: 0.14,
    moteCount: 260,
    moteVertical: 0.2,
    pulsePeriod: 2.2,
    ambient: 2.0,
    wallHeight: 12,
  },
  LGL: {
    fogDensity: 0.022,
    floorColor: 0x08120a,
    gridOpacity: 0.13,
    moteCount: 340,
    moteVertical: -0.12,
    pulsePeriod: 6.5,
    ambient: 1.3,
    wallHeight: 13,
  },
  CSG: {
    fogDensity: 0.042,
    floorColor: 0x040b14,
    gridOpacity: 0.11,
    moteCount: 700,
    moteVertical: -0.4,
    pulsePeriod: 7.5,
    ambient: 1.0,
    wallHeight: 11,
  },
};

const DEFAULT_ENV = ENV["R&D"];

export function buildDeptRoom(
  dept: Department,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  opts: BuildRoomOptions = {},
): RoomHandle {
  const color = new THREE.Color(dept.color);
  const lore = loreFor(dept.code);
  const env = ENV[dept.code] ?? DEFAULT_ENV;

  const root = new THREE.Group();
  root.name = `room:${dept.code}`;
  scene.add(root);

  scene.fog = new THREE.FogExp2(0x020408, env.fogDensity);

  const disposables: Array<{ dispose: () => void }> = [];
  const fxs: Fx[] = [];
  const ticks: Array<(dt: number, t: number) => void> = [];
  const alerts: Array<(level: number) => void> = [];

  const own = <T extends { dispose: () => void }>(res: T): T => {
    disposables.push(res);
    return res;
  };

  const add = <T extends THREE.Object3D>(obj: T, parent?: THREE.Object3D): T => {
    (parent ?? root).add(obj);
    return obj;
  };

  const fx = <T extends Fx>(f: T, parent?: THREE.Object3D): T => {
    add(f.object, parent);
    fxs.push(f);
    return f;
  };

  add(new THREE.AmbientLight(0x0a0a18, env.ambient));

  const keyLight = new THREE.PointLight(dept.color, 5.5, 34, 2);
  keyLight.position.set(0, 5.5, 0);
  add(keyLight);

  const rimLight = new THREE.DirectionalLight(dept.color, 1.3);
  rimLight.position.set(-5, 4, -7);
  add(rimLight);

  const fillLight = new THREE.PointLight(0xffffff, 0.4, 46);
  fillLight.position.set(4, -1.5, 7);
  add(fillLight);

  const backLight = new THREE.PointLight(dept.color, 2.2, 30, 2);
  backLight.position.set(0, 1, -11);
  add(backLight);

  const floorGeo = own(new THREE.CircleGeometry(15.5, 72));
  const floorMat = own(
    new THREE.MeshStandardMaterial({
      color: env.floorColor,
      roughness: 0.62,
      metalness: 0.55,
      emissive: color,
      emissiveIntensity: 0.035,
    }),
  );
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -3.24;
  add(floor);

  const grid = new THREE.GridHelper(30, 30, dept.color, dept.color);
  (Array.isArray(grid.material) ? grid.material : [grid.material]).forEach((m) => {
    const lm = m as THREE.LineBasicMaterial;
    lm.opacity = env.gridOpacity * 0.4;
    lm.transparent = true;
    own(lm);
  });
  own(grid.geometry);
  grid.position.y = -3.2;
  add(grid);

  for (const r of [5.2, 9.4, 13.6]) {
    const ringMesh = new THREE.Mesh(
      own(new THREE.RingGeometry(r - 0.035, r, 96)),
      own(
        new THREE.MeshBasicMaterial({
          color: dept.color,
          transparent: true,
          opacity: 0.24,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      ),
    );
    ringMesh.rotation.x = -Math.PI / 2;
    ringMesh.position.y = -3.19;
    add(ringMesh);
  }

  fx(createWallGrid({ color, radius: 15.2, height: env.wallHeight })).object.position.y =
    env.wallHeight / 2 - 3.2;

  fx(
    createFloorPulse({
      color,
      y: -3.17,
      count: 4,
      maxRadius: 15,
      period: env.pulsePeriod,
    }),
  );

  fx(
    createMotes({
      color,
      count: env.moteCount,
      radius: 13.5,
      height: env.wallHeight - 1,
      vertical: env.moteVertical,
    }),
  );

  const pillarGeo = own(new THREE.BoxGeometry(0.3, env.wallHeight, 0.3));
  const pillarMat = own(
    new THREE.MeshStandardMaterial({
      color: 0x080d16,
      roughness: 0.5,
      metalness: 0.82,
      emissive: color,
      emissiveIntensity: 0.05,
    }),
  );
  const accentGeo = own(new THREE.BoxGeometry(0.42, 0.09, 0.42));
  const accentMat = own(
    new THREE.MeshBasicMaterial({
      color: dept.color,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * 14.4;
    const z = Math.sin(a) * 14.4;
    const p = new THREE.Mesh(pillarGeo, pillarMat);
    p.position.set(x, env.wallHeight / 2 - 3.2, z);
    add(p);
    for (const y of [env.wallHeight - 3.4, -3.0]) {
      const acc = new THREE.Mesh(accentGeo, accentMat);
      acc.position.set(x, y, z);
      add(acc);
    }
  }

  const mountBoard = (obj: THREE.Object3D, angleDeg: number, y: number) => {
    const a = (angleDeg * Math.PI) / 180;
    obj.position.set(Math.cos(a) * 12.2, y, Math.sin(a) * 12.2);
    obj.lookAt(0, y - 1.1, 0);
  };

  const terminal = fx(
    createTerminalPanel({ title: `${dept.code} // ${lore.feedTitle}`, color, rows: 9 }),
  );
  mountBoard(terminal.object, 152, 2.7);

  const stats = fx(
    createStatPanel({ title: lore.statsTitle, color, stats: lore.stats, width: 2.9 }),
  );
  mountBoard(stats.object, 208, 2.7);

  const mirror = fx(
    createTerminalPanel({ title: `${dept.code} // MIRROR`, color, rows: 6 }),
  );
  mountBoard(mirror.object, 90, 3.3);
  mirror.object.scale.setScalar(0.85);

  const say = (line: FeedLine) => {
    terminal.push(line);
    mirror.push(line);
  };

  const p5Layer = createP5Surfaces({
    sketches: sketchesFor(dept.code),
    color,
    floorMaterial: floorMat,
    boardWidth: 8.0,
  });
  p5Layer.board.position.set(-14.2, 4.3, 0);
  p5Layer.board.lookAt(0, 1.2, 0);
  add(p5Layer.board);

  const ctx: RoomCtx = {
    dept,
    lore,
    color,
    camera,
    root,
    add,
    fx,
    own,
    tick: (fn) => ticks.push(fn),
    alert: (fn) => alerts.push(fn),
    say,
  };

  programFor(dept.code)(ctx);

  let t = 0;
  let lineTimer = 0;
  let nextLineAt = 0.4;

  const evt = lore.event;
  let sinceIncident = 0;
  let nextIncidentAt = evt.period[0] + Math.random() * (evt.period[1] - evt.period[0]);
  let incidentAge = -1;
  let burstIndex = 0;
  let announced = false;

  for (let i = 0; i < 6; i++) say(lore.nextLine());

  const setAlertLevel = (level: number) => {
    for (const f of fxs) f.setAlert?.(level);
    for (const a of alerts) a(level);
    p5Layer.setAlert(level);
  };

  const update = (dt: number) => {
    t += dt;

    lineTimer += dt;
    if (lineTimer >= nextLineAt) {
      lineTimer = 0;
      nextLineAt = 1.3 + Math.random() * 1.9;
      say(lore.nextLine());
    }

    if (incidentAge < 0) {
      sinceIncident += dt;
      if (sinceIncident >= nextIncidentAt) {
        incidentAge = 0;
        burstIndex = 0;
        announced = false;
      }
    } else {
      incidentAge += dt;
      const p = incidentAge / evt.duration;

      if (!announced && p > 0.06) {
        announced = true;
        opts.onEvent?.({ code: evt.code, label: evt.label, tone: evt.tone });
        say({ text: `>> ${evt.label}`, tone: evt.tone === "info" ? "warn" : "alert" });
      }

      const wantBurst = Math.floor(p * (evt.burst.length + 0.5));
      while (burstIndex < Math.min(wantBurst, evt.burst.length)) {
        say({
          text: evt.burst[burstIndex],
          tone: evt.tone === "info" ? "warn" : "alert",
        });
        burstIndex++;
      }

      if (p >= 1) {
        incidentAge = -1;
        sinceIncident = 0;
        nextIncidentAt =
          evt.period[0] + Math.random() * (evt.period[1] - evt.period[0]);
        setAlertLevel(0);
        opts.onEvent?.(null);
        say({ text: "SYSTEM RETURNED TO NOMINAL", tone: "dim" });
      } else {
        const level =
          p < 0.18
            ? p / 0.18
            : p > 0.72
              ? Math.max(0, 1 - (p - 0.72) / 0.28)
              : 1;
        setAlertLevel(level);
      }
    }

    keyLight.intensity = 5.0 + Math.sin(t * 1.6) * 0.9;
    backLight.intensity = 2.0 + Math.sin(t * 1.1 + 1.4) * 0.6;

    for (const f of fxs) f.update(dt, t);
    for (const fn of ticks) fn(dt, t);
    p5Layer.update(dt, t);
  };

  const dispose = () => {
    scene.remove(root);
    p5Layer.dispose();
    for (const f of fxs) f.dispose();
    for (const d of disposables) d.dispose();
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      mesh.geometry?.dispose?.();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose?.());
      else mat?.dispose?.();
    });
    root.clear();
  };

  return { update, dispose };
}
