import React from "react";
import { HeroContent } from "./HeroContent";
import { CampusHeroImage } from "./CampusHeroImage";

export function HeroSection() {
  return (
    <section className="w-full bg-[#FAFBFD] relative overflow-hidden scroll-mt-24 scroll-snap-align-start scroll-snap-stop-always">
      {/* ─── Main Hero Split Content & Campus Photograph ──────────────────── */}
      <div className="relative w-full min-h-[580px] lg:h-[600px] xl:h-[620px] flex items-center">
        {/* ─── Architectural Triangle System ──────────────────────────────── */}
        <div
          className="pointer-events-none absolute inset-0 z-[1] hidden lg:block"
          aria-hidden="true"
        >
          {/* Partially cropped pale-blue entry from the top-left corner */}
          <div
            className="absolute -left-40 -top-44 h-[380px] w-[430px]"
            style={{
              backgroundColor: "rgba(232, 238, 246, 0.25)",
              clipPath: "polygon(0 0, 100% 0, 0 100%)",
            }}
          />

          {/* Soft inverted transition on the text/photo boundary */}
          <div
            className="absolute -top-8 left-[46%] h-[220px] w-[210px]"
            style={{
              backgroundColor: "rgba(232, 238, 246, 0.24)",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />

          {/* Crimson boundary marker and its smaller pale companion */}
          <div
            className="absolute left-[52%] top-[112px] h-14 w-16"
            style={{
              backgroundColor: "rgba(154, 30, 51, 0.92)",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />
          <div
            className="absolute left-[50.5%] top-[188px] h-9 w-11"
            style={{
              backgroundColor: "rgba(245, 229, 233, 0.62)",
              clipPath: "polygon(0 0, 100% 0, 50% 100%)",
            }}
          />
        </div>

        {/* Left Content Column aligned with the site's max width container */}
        <div className="w-full max-w-[1520px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 z-10">
          <div className="lg:w-[54%] xl:w-[52%]">
            <HeroContent />
          </div>
        </div>

        {/* Right Campus Image & Triangular Geometries (Desktop: absolute right-0) */}
        <div className="hidden lg:block absolute right-0 top-0 bottom-0 w-[56%] xl:w-[54%] 2xl:w-[52%] z-0 h-full">
          <CampusHeroImage />
        </div>
      </div>

      {/* Mobile/Tablet Fallback: Stacked Campus Image */}
      <div className="block lg:hidden w-full px-4 sm:px-8 pb-10">
        <div className="relative w-full h-[360px] sm:h-[440px] overflow-hidden rounded-2xl shadow-sm">
          <CampusHeroImage />
        </div>
      </div>
    </section>
  );
}
