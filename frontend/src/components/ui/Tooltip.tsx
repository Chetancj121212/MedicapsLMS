"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
  delay?: number;
}

export function Tooltip({
  content,
  children,
  side = "top",
  className = "",
  delay = 120,
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(
    null,
  );
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = 0;
    let left = 0;

    if (side === "top") {
      top = rect.top + scrollY - 6;
      left = rect.left + scrollX + rect.width / 2;
    } else if (side === "bottom") {
      top = rect.bottom + scrollY + 6;
      left = rect.left + scrollX + rect.width / 2;
    } else if (side === "left") {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.left + scrollX - 6;
    } else if (side === "right") {
      top = rect.top + scrollY + rect.height / 2;
      left = rect.right + scrollX + 6;
    }

    setCoords({ top, left });
  }, [side]);

  const show = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, delay);
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="inline-flex items-center justify-center"
      >
        {children}
      </span>
      {isOpen &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            style={{
              position: "absolute",
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              transform:
                side === "top"
                  ? "translate(-50%, -100%)"
                  : side === "bottom"
                    ? "translate(-50%, 0)"
                    : side === "left"
                      ? "translate(-100%, -50%)"
                      : "translate(0, -50%)",
            }}
            className={`pointer-events-none z-[9999] px-2.5 py-1 text-[11px] font-medium leading-normal text-white bg-slate-900 rounded shadow-lg whitespace-nowrap transition-opacity duration-150 border border-slate-700/50 ${className}`}
          >
            {content}
          </div>,
          document.body,
        )}
    </>
  );
}
