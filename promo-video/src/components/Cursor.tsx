import React from 'react';

/** macOS-style arrow pointer with a click ripple. */
export const Cursor: React.FC<{
  x: number;
  y: number;
  /** 0 → 1 → 0 around a click. */
  press?: number;
  /** 0 → 1 expanding ring after a click. */
  ripple?: number;
  opacity?: number;
  size?: number;
}> = ({ x, y, press = 0, ripple = 0, opacity = 1, size = 44 }) => (
  <div style={{ position: 'absolute', left: x, top: y, opacity, pointerEvents: 'none' }}>
    {ripple > 0 && ripple < 1 ? (
      <div
        style={{
          position: 'absolute',
          left: -40,
          top: -40,
          width: 80,
          height: 80,
          borderRadius: '50%',
          border: '3px solid rgba(255,255,255,0.8)',
          transform: `scale(${0.3 + ripple * 1.2})`,
          opacity: 1 - ripple,
        }}
      />
    ) : null}
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{
        display: 'block',
        transform: `scale(${1 - press * 0.15})`,
        transformOrigin: '4px 2px',
        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))',
      }}
    >
      <path
        d="M4.5 2.2 L4.5 19.6 L9.1 15.3 L12 21.8 L15.1 20.4 L12.3 14.1 L18.6 14.1 Z"
        fill="#fff"
        stroke="#111"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  </div>
);
