"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import confetti from "canvas-confetti";
import { fetchApi } from "@/lib/api";
import { getErrorMessage } from "@/lib/utils";
import { QuizStudentView, QuizSubmissionResult } from "@/types";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { QuizSkeleton } from "@/components/ui/Skeleton";
import {
  FileQuestion,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RotateCcw,
  ArrowLeft,
  ChevronRight,
  HelpCircle,
} from "lucide-react";

export default function StudentQuizPage() {
  const params = useParams();
  const courseId = params?.courseId as string;
  const quizId = params?.quizId as string;

  const [quiz, setQuiz] = useState<QuizStudentView | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<
    Record<number, number>
  >({});
  const [result, setResult] = useState<QuizSubmissionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuiz() {
      try {
        const data = await fetchApi<QuizStudentView>(`/api/quizzes/${quizId}`);
        setQuiz(data);
      } catch (error: unknown) {
        setErrorMessage(getErrorMessage(error, "Failed to load quiz"));
      } finally {
        setLoading(false);
      }
    }
    if (quizId) loadQuiz();
  }, [quizId]);

  const handleSelectOption = (questionId: number, optionId: number) => {
    if (result && result.passed) return;
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: optionId,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quiz) return;

    // Validate that all questions are answered
    const unanswered = quiz.questions.filter((q) => !selectedAnswers[q.id]);
    if (unanswered.length > 0) {
      alert(
        `Please answer all questions before submitting (${unanswered.length} remaining).`,
      );
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const submissionPayload = {
      answers: Object.entries(selectedAnswers).map(([qid, oid]) => ({
        question_id: parseInt(qid),
        selected_option_id: oid,
      })),
    };

    try {
      const res = await fetchApi<QuizSubmissionResult>(
        `/api/quizzes/${quizId}/submit`,
        {
          method: "POST",
          body: JSON.stringify(submissionPayload),
        },
      );
      setResult(res);

      if (res.passed) {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.5 },
        });
      }
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, "Submission failed. Please try again."),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setResult(null);
    setErrorMessage(null);
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 space-y-6">
        <QuizSkeleton />
      </div>
    );
  }

  if (errorMessage && !quiz) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-800">
          Cannot Access Assessment
        </h3>
        <p className="text-xs text-slate-500">{errorMessage}</p>
        <Link href={`/student/courses/${courseId}/learn`}>
          <Button variant="outline">Return to Learning</Button>
        </Link>
      </div>
    );
  }

  if (!quiz) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      {/* Top Breadcrumb navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/student/courses/${courseId}/learn`}
          className="text-xs text-text-secondary hover:text-primary flex items-center gap-1 font-medium transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Curriculum</span>
        </Link>

        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono text-xs font-medium">
            Passing Req: {quiz.passing_percentage}%
          </Badge>
          {quiz.is_final_assessment && (
            <Badge variant="default" className="text-xs">
              Course Final Assessment
            </Badge>
          )}
        </div>
      </div>

      {/* Quiz Header Card */}
      <div className="bg-white p-5 rounded-xl border border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wider">
          <FileQuestion className="w-4 h-4 text-primary" />
          <span>Academic Knowledge Assessment</span>
        </div>
        <h1 className="text-xl font-semibold text-text-primary">
          {quiz.title}
        </h1>
        <p className="text-xs text-text-secondary leading-relaxed">
          {quiz.description ||
            "Answer all questions. Per department requirements, passing accuracy is required to unlock subsequent content."}
        </p>
      </div>

      {/* ─── Result Banner (Sections 17 & 18) ─────────────────────────────────── */}
      {result && (
        <div
          className={`rounded-xl p-6 border shadow-md space-y-4 ${
            result.passed
              ? "bg-emerald-50 border-emerald-300 text-emerald-950"
              : "bg-red-50 border-red-300 text-red-950"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="shrink-0 mt-0.5">
              {result.passed ? (
                <div className="p-2 rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
              ) : (
                <div className="p-2 rounded-full bg-red-600 text-white">
                  <XCircle className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="space-y-1.5 flex-1">
              <h2 className="text-xl font-bold">
                {result.passed
                  ? "✓ Assessment Passed!"
                  : "Assessment Not Passed"}
              </h2>

              <div className="text-sm font-semibold">
                You scored{" "}
                <span className="font-bold text-lg">{result.percentage}%</span>{" "}
                ({result.score} / {result.total_marks} Marks).
                <span className="text-xs font-normal text-slate-600 ml-2">
                  (Required passing score: {quiz.passing_percentage}%)
                </span>
              </div>

              {!result.passed && (
                <p className="text-xs text-red-800 leading-relaxed pt-1">
                  You haven&apos;t passed this assessment yet. To maintain
                  academic rigor, the department requires 100% mastery before
                  advancing.
                </p>
              )}

              {/* Hint after failure (Section 17) */}
              {!result.passed && result.hint && (
                <div className="mt-3 p-3 bg-white/90 rounded-lg border border-red-200 text-xs text-slate-800 font-medium flex items-start gap-2">
                  <HelpCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-900">
                      Academic Hint:{" "}
                    </span>
                    <span>{result.hint}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            {result.passed ? (
              <Link href={`/student/courses/${courseId}/learn`}>
                <Button className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold gap-2">
                  <span>Continue Course & Unlocked Content</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            ) : (
              <Button
                onClick={handleRetry}
                className="bg-primary hover:bg-primary-dark text-white font-medium gap-2"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Try Again</span>
              </Button>
            )}

            <Link href={`/student/courses/${courseId}/learn`}>
              <Button variant="outline">Review Lecture Material</Button>
            </Link>
          </div>
        </div>
      )}

      {/* ─── Question List Form ──────────────────────────────────────────────── */}
      {(!result || !result.passed) && (
        <form onSubmit={handleSubmit} className="space-y-5">
          {quiz.questions.map((q, idx) => (
            <Card
              key={q.id}
              className="border-border-subtle shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden"
            >
              <CardHeader className="bg-[#F7F8FA] border-b border-border-subtle py-3 px-5 flex flex-row items-center justify-between">
                <span className="text-xs font-semibold text-text-primary">
                  Question {idx + 1} of {quiz.questions.length}
                </span>
                <span className="text-[11px] text-text-secondary font-medium">
                  {q.marks} Mark{q.marks > 1 ? "s" : ""} &bull;{" "}
                  {q.question_type}
                </span>
              </CardHeader>

              <CardContent className="p-5 space-y-3">
                <div className="text-sm font-semibold text-text-primary leading-snug">
                  {q.question_text}
                </div>

                <div className="space-y-2 pt-1">
                  {q.options.map((opt) => {
                    const isSelected = selectedAnswers[q.id] === opt.id;

                    return (
                      <label
                        key={opt.id}
                        onClick={() => handleSelectOption(q.id, opt.id)}
                        className={`flex items-center gap-3 p-3 rounded-lg border text-xs sm:text-sm cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/8 font-medium text-text-primary"
                            : "border-border-subtle bg-white hover:bg-slate-50 text-text-primary"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question-${q.id}`}
                          checked={isSelected}
                          onChange={() => handleSelectOption(q.id, opt.id)}
                          className="w-4 h-4 text-primary accent-primary shrink-0"
                        />
                        <span className="leading-snug">{opt.option_text}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Submission Button */}
          <div className="pt-2 flex justify-end gap-3">
            <Link href={`/student/courses/${courseId}/learn`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>

            <Button
              type="submit"
              size="md"
              isLoading={submitting}
              className="bg-primary hover:bg-primary-dark text-white px-6 font-medium shadow-xs"
            >
              Submit Assessment Answers
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
