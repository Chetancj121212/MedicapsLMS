import React from "react";

interface TriangleProps {
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Type A: Solid Crimson Triangle
 * Small size, pointing upward or downward.
 */
export function CrimsonTriangle({
  direction = "down",
  className = "",
  style,
}: {
  direction?: "up" | "down" | "left" | "right";
  className?: string;
  style?: React.CSSProperties;
}) {
  const clipPaths = {
    down: "polygon(0 0, 100% 0, 50% 100%)",
    up: "polygon(50% 0, 100% 100%, 0 100%)",
    left: "polygon(100% 0, 100% 100%, 0 50%)",
    right: "polygon(0 0, 100% 50%, 0 100%)",
  };

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none bg-[#9A1E33] ${className}`}
      style={{
        clipPath: clipPaths[direction],
        ...style,
      }}
    />
  );
}

/**
 * Type B: Solid Navy Triangle
 * Used as a bold geometric accent at the base of the campus image.
 */
export function NavyTriangle({ className = "", style }: TriangleProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none bg-[#1B3A6B] ${className}`}
      style={{
        clipPath: "polygon(0 100%, 50% 0, 100% 100%)",
        ...style,
      }}
    />
  );
}

/**
 * Type C: Crimson Triangle
 * Large decorative background shape.
 */
export function TranslucentCrimsonTriangle({
  className = "",
  style,
}: TriangleProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none bg-[#9A1E33] ${className}`}
      style={{
        clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        ...style,
      }}
    />
  );
}

/**
 * Type D: Blue Triangle
 * Light blue accent near top edges.
 */
export function TranslucentBlueTriangle({
  className = "",
  style,
}: TriangleProps) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none bg-[#E8EDF6] ${className}`}
      style={{
        clipPath: "polygon(0 0, 100% 0, 0 100%)",
        ...style,
      }}
    />
  );
}

/**
 * Type E: Outline Triangle
 * Thin stroke (navy or crimson 1.5px border or SVG outline).
 */
export function OutlineTriangle({
  color = "#1B3A6B",
  className = "",
  style,
}: {
  color?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 100"
      className={`pointer-events-none fill-none stroke-current ${className}`}
      style={{ color, ...style }}
    >
      <polygon points="50,10 90,90 10,90" strokeWidth="2.5" />
    </svg>
  );
}
