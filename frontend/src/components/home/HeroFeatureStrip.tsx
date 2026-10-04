import React from "react";
import { Video, Layers3, ClipboardCheck, Award } from "lucide-react";

interface FeatureItem {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  bgColor: string;
  iconColor: string;
}

const features: FeatureItem[] = [
  {
    title: "Curated Lectures",
    description: "Targeted video content designed by faculty.",
    icon: Video,
    bgColor: "bg-[#F7EAED]",
    iconColor: "text-[#9A1E33]",
  },
  {
    title: "Sequential Learning",
    description: "Structured modules with progressive unlocks.",
    icon: Layers3,
    bgColor: "bg-[#E8EDF6]",
    iconColor: "text-[#1B3A6B]",
  },
  {
    title: "Mastery Assessments",
    description: "Server-validated quizzes and final evaluations.",
    icon: ClipboardCheck,
    bgColor: "bg-[#F7EAED]",
    iconColor: "text-[#9A1E33]",
  },
  {
    title: "Verified Certificates",
    description: "Tamper-evident digital certificates with QR verification.",
    icon: Award,
    bgColor: "bg-[#E8EDF6]",
    iconColor: "text-[#9A1E33]",
  },
];

export function HeroFeatureStrip() {
  return (
    <div className="w-full bg-white border-t border-b border-[#E3E7EF]">
      <div className="w-full max-w-[1520px] mx-auto px-4 sm:px-8 lg:px-12 xl:px-16 py-6 sm:py-7 lg:py-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-[#E3E7EF]">
          {features.map((feature, idx) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={`flex items-center gap-4.5 py-4 sm:py-3.5 lg:py-2 ${
                  idx === 0
                    ? "sm:pr-6 lg:pr-8"
                    : idx === features.length - 1
                    ? "sm:pl-6 lg:pl-8"
                    : "sm:px-6 lg:px-8"
                }`}
              >
                {/* 66px square icon container with rounded 14px corners */}
                <div
                  className={`w-16 h-16 sm:w-[68px] sm:h-[68px] rounded-[14px] ${feature.bgColor} ${feature.iconColor} flex items-center justify-center shrink-0 shadow-xs transition-transform duration-300 hover:scale-105`}
                >
                  <Icon className="w-7 h-7" strokeWidth={1.8} />
                </div>

                <div className="flex flex-col justify-center">
                  <h3 className="text-[15px] sm:text-[16px] font-bold text-[#1B3A6B] leading-snug">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-[13px] sm:text-[13.5px] text-[#60708A] leading-relaxed max-w-[240px]">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
