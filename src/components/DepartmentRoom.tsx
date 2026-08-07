import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { DEPARTMENTS } from "../three/cube";
import { setupGlitchComposer } from "../three/glitch";
import { buildDeptRoom, type RoomEvent } from "../three/roomBuilder";
import { setupRoomCamera } from "../three/roomCamera";
import { clockStamp } from "../three/roomLore";

function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function rgba(n: number, a: number): string {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

const MONO = "ui-monospace, 'SFMono-Regular', Menlo, 'Courier New', monospace";

const TONE_COLOR: Record<RoomEvent["tone"], string> = {
  info: "#7fd8ff",
  warn: "#ffb347",
  alert: "#ff3b5c",
};

const DepartmentRoom: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);

  const dept = DEPARTMENTS.find((d) => d.path === location.pathname);

  const [chromeVisible, setChromeVisible] = useState(true);
  const [glitchOn, setGlitchOn] = useState(true);
  const [event, setEvent] = useState<RoomEvent | null>(null);
  const [stamp, setStamp] = useState(() => clockStamp(0));

  const glitchRef = useRef<ReturnType<typeof setupGlitchComposer> | null>(null);

  useEffect(() => {
    if (!mountRef.current || !dept) return;
    const container = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgBase = new THREE.Color(0x020408);
    const bgTint = new THREE.Color(dept.color).multiplyScalar(0.05);
    scene.background = bgBase.clone().lerp(bgTint, 0.6);

    const camera = new THREE.PerspectiveCamera(
      58,
      container.clientWidth / container.clientHeight,
      0.1,
      260,
    );

    const room = buildDeptRoom(dept, scene, camera, {
      onEvent: (e) => setEvent(e),
    });

    const rig = setupRoomCamera(camera, renderer.domElement, {
      target: new THREE.Vector3(0, 0.3, 0),
      radius: 11.2,
      minRadius: 4.0,
      maxRadius: 11.8,
    });

    const glitch = setupGlitchComposer(renderer, scene, camera, {
      bloom: { strength: 0.58, radius: 0.6, threshold: 0.28 },
    });
    glitch.setEnabled(true);
    glitch.setAmount(0.12);
    glitchRef.current = glitch;

    const clock = new THREE.Clock();
    let animId = 0;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      rig.update(dt);
      room.update(dt);
      glitch.render(dt);
    };
    loop();

    const onResize = () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
      glitch.setSize(nw, nh);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", onResize);
      rig.dispose();
      room.dispose();
      glitch.dispose();
      glitchRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [dept]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "h") setChromeVisible((v) => !v);
      if (k === "g") {
        setGlitchOn((on) => {
          const next = !on;
          glitchRef.current?.setEnabled(next);
          glitchRef.current?.setAmount(next ? 0.12 : 0);
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(
      () => setStamp(clockStamp((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(id);
  }, []);

  if (!dept) {
    return (
      <div
        style={{
          width: "100vw",
          height: "100vh",
          background: "#020408",
          color: "#00ffff",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: MONO,
          gap: 16,
        }}
      >
        <div style={{ fontSize: 13, letterSpacing: "3px", opacity: 0.6 }}>
          ERR // NODE NOT FOUND
        </div>
        <button
          onClick={() => navigate("/")}
          style={{
            padding: "8px 20px",
            background: "transparent",
            border: "1px solid rgba(0,255,255,0.5)",
            color: "#00ffff",
            cursor: "pointer",
            fontFamily: MONO,
            letterSpacing: "2px",
          }}
        >
          ← BACK TO HUB
        </button>
      </div>
    );
  }

  const hex = hexColor(dept.color);
  const c = (a: number) => rgba(dept.color, a);

  return (
    <div
      ref={mountRef}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
        background: "#020408",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          width: 310,
          zIndex: 10,
          fontFamily: MONO,
          pointerEvents: "none",
        }}
      >
        <button
          onClick={() => navigate("/")}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 14px",
            marginBottom: 10,
            background: c(0.07),
            border: `1px solid ${c(0.6)}`,
            borderRadius: 6,
            color: hex,
            cursor: "pointer",
            fontFamily: "inherit",
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: "2.5px",
            textTransform: "uppercase",
            textAlign: "left",
            boxShadow: `0 0 14px ${c(0.3)}`,
            transition: "background 0.15s",
            pointerEvents: "auto",
          }}
          onMouseEnter={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = c(0.18))
          }
          onMouseLeave={(e) =>
            ((e.currentTarget as HTMLButtonElement).style.background = c(0.07))
          }
        >
          ← BACK TO HUB
        </button>

        {chromeVisible && (
          <div
            style={{
              background: "rgba(2,4,8,0.84)",
              border: `1px solid ${c(0.38)}`,
              borderRadius: 10,
              padding: "16px 18px",
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: `0 0 32px ${c(0.16)}, inset 0 0 28px ${c(0.05)}`,
            }}
          >
            <div
              style={{
                fontSize: 9,
                letterSpacing: "3.5px",
                color: c(0.65),
                marginBottom: 5,
                textTransform: "uppercase",
              }}
            >
              {dept.code}&nbsp;&nbsp;//&nbsp;&nbsp;NODE ACCESS
            </div>

            <h2
              style={{
                margin: "0 0 10px 0",
                fontSize: 19,
                fontWeight: 700,
                color: hex,
                letterSpacing: "0.8px",
                textShadow: `0 0 14px ${c(0.75)}`,
              }}
            >
              {dept.name}
            </h2>

            <div
              style={{
                height: 1,
                background: `linear-gradient(90deg, ${c(0.55)}, transparent)`,
                marginBottom: 11,
              }}
            />

            <p
              style={{
                margin: "0 0 13px 0",
                fontSize: 12,
                lineHeight: 1.6,
                color: "rgba(178,208,220,0.82)",
              }}
            >
              {dept.blurb}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 10,
                color: c(0.75),
                letterSpacing: "1.8px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: hex,
                  boxShadow: `0 0 8px ${hex}`,
                  flexShrink: 0,
                  animation: "deptPulse 2s ease-in-out infinite",
                }}
              />
              STATUS: ACTIVE&nbsp;&nbsp;|&nbsp;&nbsp;CLEARANCE: ULTRA
            </div>

            <div
              style={{
                marginTop: 12,
                paddingTop: 10,
                borderTop: `1px solid ${c(0.18)}`,
                fontSize: 9,
                letterSpacing: "2px",
                color: c(0.5),
                lineHeight: 1.8,
              }}
            >
              DRAG - ORBIT NODE
              <br />
              SCROLL - RANGE
              <br />
              H - SUPPRESS OVERLAY
              <br />
              G - OPTIC INTERFERENCE {glitchOn ? "[ON]" : "[OFF]"}
            </div>
          </div>
        )}
      </div>

      {chromeVisible && event && (
        <div
          style={{
            position: "absolute",
            top: 20,
            right: 20,
            zIndex: 10,
            fontFamily: MONO,
            pointerEvents: "none",
            background: "rgba(2,4,8,0.86)",
            border: `1px solid ${TONE_COLOR[event.tone]}`,
            borderRadius: 8,
            padding: "10px 16px",
            boxShadow: `0 0 26px ${TONE_COLOR[event.tone]}55`,
            animation: "deptAlert 1.1s ease-in-out infinite",
          }}
        >
          <div
            style={{
              fontSize: 9,
              letterSpacing: "3px",
              color: TONE_COLOR[event.tone],
              opacity: 0.75,
            }}
          >
            {event.code}&nbsp;&nbsp;//&nbsp;&nbsp;INCIDENT
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "2px",
              color: TONE_COLOR[event.tone],
              textShadow: `0 0 12px ${TONE_COLOR[event.tone]}`,
              marginTop: 3,
            }}
          >
            {event.label}
          </div>
        </div>
      )}

      {chromeVisible && (
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "7px 20px",
            background: "rgba(2,4,8,0.8)",
            borderTop: `1px solid ${c(0.18)}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontFamily: MONO,
            fontSize: 9,
            letterSpacing: "2px",
            color: c(0.55),
            zIndex: 10,
            pointerEvents: "none",
          }}
        >
          <span>
            {dept.code}&nbsp;&nbsp;//&nbsp;&nbsp;NODE ONLINE&nbsp;&nbsp;//&nbsp;&nbsp;ACCESS GRANTED
          </span>
          <span>
            MISSION CLOCK:&nbsp;{stamp}
            &nbsp;&nbsp;//&nbsp;&nbsp;
            SECTOR:&nbsp;{dept.path.replace("/", "").toUpperCase()}
          </span>
        </div>
      )}

      <style>{`
        @keyframes deptPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${hex}; }
          50%       { opacity: 0.28; box-shadow: 0 0 3px ${hex}; }
        }
        @keyframes deptAlert {
          0%, 100% { opacity: 1; }
          50%      { opacity: 0.55; }
        }
      `}</style>
    </div>
  );
};

export default DepartmentRoom;
