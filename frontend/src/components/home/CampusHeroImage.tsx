import React from "react";
import Image from "next/image";

interface CampusHeroImageProps {
  imageSrc?: string;
  className?: string;
}

export function CampusHeroImage({
  imageSrc = "/medicaps-campus.png",
  className = "",
}: CampusHeroImageProps) {
  return (
    <div className={`relative w-full h-full select-none ${className}`}>
      {/* ─── Campus Photograph with Angled Triangular Frame ────────────────── */}
      <div
        className="relative w-full h-full overflow-hidden"
        style={{
          // Left diagonal edge slopes down-left from 24% at top to 0% at bottom on desktop
          clipPath: "polygon(24% 0%, 100% 0%, 100% 100%, 0% 100%)",
        }}
      >
        <Image
          src={imageSrc}
          alt="Medicaps University Campus Entrance - Faculty of Engineering building"
          fill
          priority
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 55vw"
          className="object-cover object-[42%_48%] transform transition-transform duration-700 ease-out hover:scale-[1.02]"
        />
      </div>

      {/* ─── Controlled Photo Anchors ─────────────────────────────────────── */}
      {/* Crimson triangle sits behind the navy anchor at the lower-left. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-10px] left-[2%] z-10 hidden h-[135px] w-[115px] lg:block"
        style={{
          backgroundColor: "rgba(154, 30, 51, 0.9)",
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-[-15px] left-[-3%] z-20 hidden h-[153px] w-[126px] lg:block"
        style={{
          backgroundColor: "rgba(27, 58, 107, 0.98)",
          clipPath: "polygon(50% 0, 100% 100%, 0 100%)",
        }}
      />

      {/* Narrow cropped crimson entry at the top-right edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-16 z-20 hidden h-[190px] w-20 lg:block"
        style={{
          backgroundColor: "rgba(154, 30, 51, 0.9)",
          clipPath: "polygon(0 0, 100% 0, 100% 100%)",
        }}
      />

      {/* Quiet crimson counterpoint near the lower-right edge. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-10 -right-8 z-20 hidden h-36 w-20 lg:block"
        style={{
          backgroundColor: "rgba(154, 30, 51, 0.86)",
          clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
        }}
      />
    </div>
  );
}
