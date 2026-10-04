"use client";

import React from "react";
import Link from "next/link";
import { BookOpen, ChevronRight, UserRound } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function HeroContent() {
  const { user } = useAuth();
  const loginDestination = user
    ? user.role === "STUDENT"
      ? "/student"
      : "/admin"
    : "/login";

  return (
    <div className="relative z-10 flex flex-col justify-center max-w-[760px] py-8 lg:py-16">
      {/* Department Identifier */}
      <div className="flex items-center gap-3 mb-5 sm:mb-6">
        <span
          className="h-[2px] w-6 sm:w-7 bg-[#9A1E33] rounded-full shrink-0"
          aria-hidden="true"
        />
        <span className="text-[11px] sm:text-[12.5px] font-semibold tracking-[0.22em] text-[#60708A] uppercase select-none">
          DEPARTMENT OF ELECTRONICS ENGINEERING
        </span>
      </div>

      {/* Main Headline */}
      <h1 className="text-[2.25rem] sm:text-[3.1rem] md:text-[3.35rem] lg:text-[3.35rem] xl:text-[3.9rem] 2xl:text-[4.2rem] font-[800] leading-[1.08] tracking-[-0.025em]">
        <span className="block text-[#1B3A6B] sm:whitespace-nowrap">
          Learn with structure.
        </span>
        <span className="block text-[#9A1E33] mt-1 sm:mt-1.5 sm:whitespace-nowrap">
          Demonstrate your mastery.
        </span>
      </h1>

      {/* Supporting Paragraph */}
      <p className="mt-5 sm:mt-6 text-[15.5px] sm:text-[17px] lg:text-[17.5px] text-[#60708A] leading-[1.65] max-w-[650px] font-normal">
        The Department of Electronics Engineering at Medicaps University
        provides structured online academic curriculum featuring high-yield
        video lectures, sequential learning modules, mastery assessments, and
        verifiable digital certification.
      </p>

      {/* CTA Buttons */}
      <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5 sm:gap-4">
        {/* Primary CTA */}
        <Link href="/courses" className="inline-flex">
          <button
            type="button"
            className="w-full sm:w-auto h-14 sm:h-[58px] px-6 sm:px-7 rounded-[10px] bg-[#9A1E33] hover:bg-[#78152A] text-white font-semibold text-[15px] sm:text-[16px] inline-flex items-center justify-center gap-3 transition-colors shadow-xs cursor-pointer group"
          >
            <BookOpen className="w-5 h-5 text-white/95 shrink-0" />
            <span>Explore Courses</span>
            <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        </Link>

        {/* Secondary CTA */}
        <Link href={loginDestination} className="inline-flex">
          <button
            type="button"
            className="w-full sm:w-auto h-14 sm:h-[58px] px-6 sm:px-7 rounded-[10px] bg-[#1B3A6B] hover:bg-[#142B50] text-white font-semibold text-[15px] sm:text-[16px] inline-flex items-center justify-center gap-3 transition-colors cursor-pointer group"
          >
            <UserRound className="w-5 h-5 text-white/95 shrink-0" />
            <span>Student Login</span>
            <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform shrink-0" />
          </button>
        </Link>
      </div>
    </div>
  );
}
