import React, { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import * as THREE from "three";
import { DEPARTMENTS } from "../three/cube";
import { setupGlitchComposer } from "../three/glitch";
import { buildDeptRoom } from "../three/roomBuilder";

function hexColor(n: number): string {
  return `#${n.toString(16).padStart(6, "0")}`;
}

function rgba(n: number, a: number): string {
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

const DepartmentRoom: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const mountRef = useRef<HTMLDivElement>(null);

  const dept = DEPARTMENTS.find((d) => d.path === location.pathname);

  useEffect(() => {
    if (!mountRef.current || !dept) return;
    const container = mountRef.current;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgBase = new THREE.Color(0x020408);
    const bgTint = new THREE.Color(dept.color).multiplyScalar(0.05);
    scene.background = bgBase.clone().lerp(bgTint, 0.6);
    scene.fog = new THREE.FogExp2(0x020408, 0.022);

    const camera = new THREE.PerspectiveCamera(
      60,
      container.clientWidth / container.clientHeight,
      0.1,
      200,
    );
    camera.position.set(0, 2, 9);
    camera.lookAt(0, 0, 0);

    const room = buildDeptRoom(dept, scene);

    const glitch = setupGlitchComposer(renderer, scene, camera);
    glitch.setAmount(0.12);
    glitch.setEnabled(true);

    const clock = new THREE.Clock();
    let animId: number;
    const loop = () => {
      animId = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
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
      room.dispose();
      glitch.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
    };
  }, [dept]);

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
          fontFamily: "monospace",
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
            fontFamily: "monospace",
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
          fontFamily: "ui-monospace, 'Courier New', monospace",
          pointerEvents: "auto",
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
        </div>
      </div>

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
          fontFamily: "ui-monospace, 'Courier New', monospace",
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
          TS:&nbsp;{new Date().toISOString().replace("T", " ").slice(0, 19)}Z
          &nbsp;&nbsp;//&nbsp;&nbsp;
          SECTOR:&nbsp;{dept.path.replace("/", "").toUpperCase()}
        </span>
      </div>

      <style>{`
        @keyframes deptPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px ${hex}; }
          50%       { opacity: 0.28; box-shadow: 0 0 3px ${hex}; }
        }
      `}</style>
    </div>
  );
};

export default DepartmentRoom;
