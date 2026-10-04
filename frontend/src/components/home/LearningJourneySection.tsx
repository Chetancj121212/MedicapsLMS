"use client";

import Image from "next/image";
import {
  Award,
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Layers3,
  LucideIcon,
  Video,
} from "lucide-react";

interface LearningStage {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
  image?: string;
  imageAlt: string;
  imagePlaceholder: string;
  numberColor: string;
  iconColor: string;
  iconBackground: string;
}

const stages: LearningStage[] = [
  {
    number: "01",
    title: "Curated Lectures",
    description:
      "Targeted video content designed by faculty to build strong subject fundamentals.",
    icon: Video,
    imageAlt: "Engineering student watching a faculty lecture",
    imagePlaceholder: "LECTURE IMAGE",
    numberColor: "bg-[#9A1E33]",
    iconColor: "text-[#9A1E33]",
    iconBackground: "bg-[#F5E8EC]",
  },
  {
    number: "02",
    title: "Sequential Learning",
    description:
      "Structured modules with progressive unlocks to ensure step-by-step learning.",
    icon: Layers3,
    imageAlt: "Structured course modules showing learning progression",
    imagePlaceholder: "MODULE PROGRESSION IMAGE",
    numberColor: "bg-[#1B3A6B]",
    iconColor: "text-[#1B3A6B]",
    iconBackground: "bg-[#E9EFF7]",
  },
  {
    number: "03",
    title: "Mastery Assessments",
    description:
      "Server-validated quizzes and final evaluations to assess your understanding.",
    icon: ClipboardCheck,
    imageAlt: "Academic assessment interface with progress tracking",
    imagePlaceholder: "ASSESSMENT IMAGE",
    numberColor: "bg-[#9A1E33]",
    iconColor: "text-[#9A1E33]",
    iconBackground: "bg-[#F5E8EC]",
  },
  {
    number: "04",
    title: "Verified Certificates",
    description:
      "Tamper-evident digital certificates with unique IDs and QR verification for authenticity.",
    icon: Award,
    imageAlt: "Verified university certificate with QR code",
    imagePlaceholder: "CERTIFICATE IMAGE",
    numberColor: "bg-[#1B3A6B]",
    iconColor: "text-[#1B3A6B]",
    iconBackground: "bg-[#E9EFF7]",
  },
];

const progression = [
  { label: "LEARN", icon: BookOpen, color: "text-[#9A1E33]" },
  { label: "PROGRESS", icon: Layers3, color: "text-[#1B3A6B]" },
  { label: "ACHIEVE", icon: CheckCircle2, color: "text-[#9A1E33]" },
  { label: "CERTIFY", icon: Award, color: "text-[#1B3A6B]" },
];

function StageImage({ stage }: { stage: LearningStage }) {
  return (
    <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-[14px] border border-[#E3E7EF] bg-[#F3F5F8]">
      {stage.image ? (
        <Image
          src={stage.image}
          alt={stage.imageAlt}
          fill
          sizes="(max-width: 767px) 100vw, (max-width: 1199px) 50vw, 25vw"
          className="object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[#8A97AA]">
          <stage.icon
            className="h-6 w-6"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <span className="text-center text-[9px] font-semibold tracking-[0.16em]">
            {stage.imagePlaceholder}
          </span>
        </div>
      )}
    </div>
  );
}

export function LearningJourneySection() {
  return (
    <section
      id="learning-journey"
      className="scroll-mt-24 scroll-snap-align-start scroll-snap-stop-always relative overflow-hidden bg-[#F7F8FA] pb-16 pt-6 sm:pb-20 sm:pt-8 lg:pb-24 lg:pt-12"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-28 -top-24 h-64 w-72 bg-[#E9EFF7]/60"
        style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-20 h-56 w-64 bg-[#F5E8EC]/55"
        style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[8%] top-20 hidden h-10 w-12 bg-[#9A1E33]/10 lg:block"
        style={{ clipPath: "polygon(50% 0, 100% 100%, 0 100%)" }}
      />

      <div className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-8 lg:px-12 xl:px-16">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-1 inline-flex items-center gap-3 text-[11px] font-semibold tracking-[0.2em] text-[#60708A]">
            <span className="h-[2px] w-7 bg-[#9A1E33]" aria-hidden="true" />
            <span>HOW LEARNING WORKS</span>
          </div>
          <h2 className="text-3xl font-extrabold leading-tight tracking-[-0.02em] text-[#1B3A6B] sm:text-4xl">
            From Lecture to{" "}
            <span className="text-[#9A1E33]">Certification</span>
          </h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-7 text-[#60708A] sm:text-base">
            A structured learning experience designed to help you build
            knowledge, demonstrate your understanding, and earn a verifiable
            certificate.
          </p>
        </div>

        <div className="relative mt-6 lg:mt-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden h-px bg-[#D8E0EC] lg:block"
          />
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {stages.map((stage) => {
              const Icon = stage.icon;
              return (
                <article
                  key={stage.number}
                  className="relative flex h-full min-h-[430px] flex-col rounded-2xl border border-[#E3E7EF] bg-white p-5 shadow-[0_2px_8px_rgba(27,58,107,0.04)] sm:p-6"
                >
                  <div className="relative z-10 flex items-center justify-between">
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-full text-sm font-bold text-white ${stage.numberColor}`}
                    >
                      {stage.number}
                    </span>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${stage.iconBackground} ${stage.iconColor}`}
                    >
                      <Icon
                        className="h-6 w-6"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <h3 className="mt-6 text-lg font-bold leading-snug text-[#1B3A6B]">
                    {stage.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-[#60708A]">
                    {stage.description}
                  </p>
                  <StageImage stage={stage} />
                </article>
              );
            })}
          </div>
        </div>

        <div className="mx-auto mt-10 max-w-5xl rounded-2xl border border-[#D8E0EC] bg-white px-5 py-5 shadow-[0_4px_18px_rgba(27,58,107,0.05)] sm:mt-12 sm:px-8 sm:py-6">
          <div className="relative">
            <span
              aria-hidden="true"
              className="absolute bottom-[22px] left-[22px] top-[22px] w-px bg-[#C9D4E4] sm:bottom-auto sm:left-[12.5%] sm:right-[12.5%] sm:top-[22px] sm:h-px sm:w-auto"
            />
            <div className="relative grid grid-cols-1 sm:grid-cols-4 sm:gap-0">
              {progression.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="relative flex items-center gap-4 py-3 sm:flex-col sm:gap-2 sm:py-0"
                  >
                    <span
                      className={`relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-4 border-white shadow-[0_0_0_1px_#D8E0EC] ${item.color}`}
                    >
                      <Icon
                        className="h-[18px] w-[18px]"
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </span>
                    <span
                      className={`relative z-10 text-[11px] font-bold tracking-[0.16em] ${item.color}`}
                    >
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
