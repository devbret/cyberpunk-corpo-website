import React, { useEffect, useState } from "react";

type HudProps = {
  showInitially?: boolean;
  onToggle?: (visible: boolean) => void;
  stats?: {
    fps?: number;
    objects?: number;
    triangles?: number;
  };
};

const overlayBase: React.CSSProperties = {
  position: "absolute",
  top: 16,
  left: 16,
  width: "min(243px, 90vw)",
  zIndex: 10,
  color: "#e8eef6",
  fontFamily:
    'ui-sans-serif, system-ui, "Segoe UI", Roboto, Inter, Arial, sans-serif',
};

const cardBase: React.CSSProperties = {
  background: "rgba(10, 14, 20, 0.62)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 14,
  padding: "14px 16px",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
};

export default function Hud({ showInitially = true, onToggle }: HudProps) {
  const [visible, setVisible] = useState(showInitially);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "h") {
        setVisible((v) => {
          const nv = !v;
          onToggle?.(nv);
          return nv;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);

  if (!visible) return null;

  return (
    <div style={overlayBase} aria-live="polite" aria-label="Help overlay">
      <div style={cardBase}>
        <h2 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 700 }}>
          Controls And Tips
        </h2>

        <ul
          style={{ margin: 0, paddingLeft: 18, lineHeight: 1.35, fontSize: 14 }}
        >
          <li>
            <kbd>↑</kbd> Move forward.
          </li>
          <li>
            <kbd>↓</kbd> Move backward.
          </li>
          <li>
            <kbd>Click</kbd> Shatter main cube.
          </li>
          <li>
            <kbd>Mouse</kbd> Rotate orbit.
          </li>
          <li>
            <kbd>H</kbd> — Toggle help.
          </li>
          <li>
            <kbd>G</kbd> — Toggle glitch effect.
          </li>
        </ul>
      </div>
    </div>
  );
}
