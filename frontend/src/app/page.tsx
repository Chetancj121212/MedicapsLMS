"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { HeroSection } from "@/components/home/HeroSection";
import { LearningJourneySection } from "@/components/home/LearningJourneySection";
import { Button } from "@/components/ui/Button";
import { Award } from "lucide-react";

export default function HomePage() {
  useEffect(() => {
    let lock = false;
    let lastTop = window.scrollY;

    const handleScroll = () => {
      if (lock) return;

      const learningSection = document.getElementById("learning-journey");
      if (!learningSection) return;

      const rect = learningSection.getBoundingClientRect();
      const headerOffset = 92;
      const targetScrollY = window.scrollY + rect.top - headerOffset;
      const isUserScrollingDown = window.scrollY > lastTop;
      const isNearTarget =
        rect.top <= window.innerHeight * 0.9 &&
        rect.top >= -window.innerHeight * 0.25 &&
        window.scrollY < targetScrollY + 120;

      if (isUserScrollingDown && isNearTarget) {
        lock = true;
        window.scrollTo({
          top: targetScrollY,
          behavior: "smooth",
        });

        window.setTimeout(() => {
          lock = false;
        }, 1000);
      }

      lastTop = window.scrollY;
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="space-y-14 pb-16">
      <HeroSection />
      <LearningJourneySection />

      {/* ─── Verification Callout Section ────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="rounded-xl bg-white text-text-primary p-6 sm:p-7 flex flex-col md:flex-row items-center justify-between gap-5 border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="space-y-1 text-center md:text-left">
            <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <span>Verifiable Credential</span>
            </div>
            <h3 className="text-lg font-semibold text-text-primary">
              Verify an ECE Academic Certificate
            </h3>
            <p className="text-xs text-text-secondary max-w-lg">
              Authenticate digital certificates issued by Medicaps University
              ECE Department using the unique Certificate ID.
            </p>
          </div>

          <Link href="/verify" className="shrink-0">
            <Button size="sm" className="gap-1.5 h-9 text-xs">
              <Award className="w-3.5 h-3.5" />
              <span>Verify Certificate</span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
