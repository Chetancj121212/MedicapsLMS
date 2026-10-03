"""
Centralized course completion eligibility service.

This is the SINGLE SOURCE OF TRUTH for determining whether a student
is eligible for a certificate. All certificate issuance flows must
call `check_eligibility()` before issuing.

Eligibility requires ALL of the following:
1. Every mandatory lecture completed (watch % >= admin threshold AND
   active screen time >= 60% of lecture duration).
2. Every mandatory module quiz passed (at least one attempt with
   percentage >= quiz.passing_percentage, default 100%).
3. Every final assessment passed (at least one attempt with
   percentage >= quiz.passing_percentage, default 100%).
"""

from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from app.models.course import Course
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.progress import LectureProgress, QuizAttempt


class EligibilityResult:
    """Structured result from an eligibility check."""

    def __init__(self):
        self.eligible: bool = False
        self.course_completed: bool = False

        # Lecture stats
        self.lectures_total_required: int = 0
        self.lectures_completed: int = 0
        self.lectures_remaining: int = 0

        # Module quiz stats
        self.module_quizzes_total_required: int = 0
        self.module_quizzes_passed: int = 0
        self.module_quizzes_remaining: int = 0

        # Final assessment stats
        self.final_assessments_total_required: int = 0
        self.final_assessments_passed: int = 0
        self.final_assessments_remaining: int = 0
        self.final_assessment_best_score: Optional[float] = None

        # Missing requirements list
        self.missing_requirements: List[str] = []

    def to_dict(self) -> Dict[str, Any]:
        result = {
            "eligible": self.eligible,
            "course_completed": self.course_completed,
            "lectures": {
                "total_required": self.lectures_total_required,
                "completed": self.lectures_completed,
                "remaining": self.lectures_remaining,
            },
            "module_quizzes": {
                "total_required": self.module_quizzes_total_required,
                "passed": self.module_quizzes_passed,
                "remaining": self.module_quizzes_remaining,
            },
            "final_assessment": {
                "total_required": self.final_assessments_total_required,
                "passed": self.final_assessments_passed,
                "remaining": self.final_assessments_remaining,
                "best_score": self.final_assessment_best_score,
            },
            "missing_requirements": self.missing_requirements,
        }
        return result


class EligibilityService:
    """
    Centralized eligibility checker. All completion and certificate decisions
    MUST go through this service.
    """

    @staticmethod
    def _is_lecture_completed(
        lecture: Lecture,
        progress: Optional[LectureProgress],
    ) -> bool:
        """
        A lecture is completed when BOTH conditions are met:
        1. Video watch percentage >= lecture.completion_threshold (admin-configured, default 90%)
        2. Active screen time >= 60% of lecture duration

        If the lecture has no duration set (or 0), we rely solely on the
        `completed` flag already set by the progress tracking system.
        """
        if not progress:
            return False

        # If already marked completed by the tracking system, trust it
        if progress.completed:
            return True

        eff_duration = lecture.duration or 0.0
        if eff_duration <= 0:
            # No valid duration — cannot verify by percentage
            return False

        threshold_pct = float(lecture.completion_threshold or 90.0)

        # Calculate watch percentage from accumulated play time
        play_time = max(
            progress.video_play_time_seconds or 0.0,
            progress.watched_seconds or 0.0,
        )
        watch_pct = min(100.0, round((play_time / eff_duration) * 100.0, 1))

        # Active screen time must be >= 60% of lecture duration
        active_time = progress.active_screen_time_seconds or 0.0
        meets_watch = watch_pct >= threshold_pct
        meets_active = active_time >= (eff_duration * 0.6)

        return meets_watch and meets_active

    @staticmethod
    async def check_eligibility(
        db: AsyncSession,
        student_id: int,
        course_id: int,
    ) -> EligibilityResult:
        """
        Validates all mandatory requirements for a course.
        Returns a structured EligibilityResult with detailed breakdown.
        """
        result = EligibilityResult()

        # ── 1. Fetch all mandatory lectures ──────────────────────────────
        stmt_lectures = (
            select(Lecture)
            .join(Module, Lecture.module_id == Module.id)
            .where(
                and_(
                    Module.course_id == course_id,
                    Lecture.is_published == True,
                    Lecture.is_required == True,
                )
            )
            .order_by(Module.order_index, Lecture.order_index)
        )
        res_lec = await db.execute(stmt_lectures)
        required_lectures = res_lec.scalars().all()

        result.lectures_total_required = len(required_lectures)

        # Fetch student's progress for these lectures
        if required_lectures:
            lec_ids = [l.id for l in required_lectures]
            stmt_prog = select(LectureProgress).where(
                and_(
                    LectureProgress.student_id == student_id,
                    LectureProgress.lecture_id.in_(lec_ids),
                )
            )
            res_prog = await db.execute(stmt_prog)
            progress_map = {p.lecture_id: p for p in res_prog.scalars().all()}
        else:
            progress_map = {}

        for lecture in required_lectures:
            progress = progress_map.get(lecture.id)
            if EligibilityService._is_lecture_completed(lecture, progress):
                result.lectures_completed += 1
            else:
                result.missing_requirements.append(
                    f"Lecture '{lecture.title}' (ID {lecture.id}) is incomplete"
                )

        result.lectures_remaining = (
            result.lectures_total_required - result.lectures_completed
        )

        # ── 2. Fetch all mandatory module quizzes (non-final) ────────────
        stmt_module_quizzes = (
            select(Quiz)
            .join(Module, Quiz.module_id == Module.id)
            .where(
                and_(
                    Module.course_id == course_id,
                    Quiz.is_published == True,
                    Quiz.is_required == True,
                    Quiz.is_final_assessment == False,
                )
            )
            .order_by(Module.order_index, Quiz.order_index)
        )
        res_mq = await db.execute(stmt_module_quizzes)
        required_module_quizzes = res_mq.scalars().all()

        result.module_quizzes_total_required = len(required_module_quizzes)

        # Check each quiz for at least one passing attempt
        for quiz in required_module_quizzes:
            stmt_attempt = select(QuizAttempt).where(
                and_(
                    QuizAttempt.student_id == student_id,
                    QuizAttempt.quiz_id == quiz.id,
                    QuizAttempt.passed == True,
                )
            ).limit(1)
            res_attempt = await db.execute(stmt_attempt)
            passing_attempt = res_attempt.scalar_one_or_none()

            if passing_attempt:
                result.module_quizzes_passed += 1
            else:
                result.missing_requirements.append(
                    f"Module quiz '{quiz.title}' (ID {quiz.id}) not passed"
                )

        result.module_quizzes_remaining = (
            result.module_quizzes_total_required - result.module_quizzes_passed
        )

        # ── 3. Fetch all mandatory final assessments ─────────────────────
        stmt_final = select(Quiz).where(
            and_(
                Quiz.course_id == course_id,
                Quiz.is_final_assessment == True,
                Quiz.is_published == True,
                Quiz.is_required == True,
            )
        ).order_by(Quiz.order_index)
        res_final = await db.execute(stmt_final)
        required_finals = res_final.scalars().all()

        result.final_assessments_total_required = len(required_finals)

        for final_quiz in required_finals:
            # Find the best passing attempt
            stmt_best = select(QuizAttempt).where(
                and_(
                    QuizAttempt.student_id == student_id,
                    QuizAttempt.quiz_id == final_quiz.id,
                    QuizAttempt.passed == True,
                )
            ).order_by(QuizAttempt.percentage.desc()).limit(1)
            res_best = await db.execute(stmt_best)
            best_attempt = res_best.scalar_one_or_none()

            if best_attempt:
                result.final_assessments_passed += 1
                # Track best score across all final assessments
                if (
                    result.final_assessment_best_score is None
                    or best_attempt.percentage > result.final_assessment_best_score
                ):
                    result.final_assessment_best_score = best_attempt.percentage
            else:
                result.missing_requirements.append(
                    f"Final assessment '{final_quiz.title}' (ID {final_quiz.id}) not passed"
                )

        result.final_assessments_remaining = (
            result.final_assessments_total_required - result.final_assessments_passed
        )

        # ── 4. Determine overall eligibility ─────────────────────────────
        all_lectures_done = result.lectures_remaining == 0
        all_module_quizzes_done = result.module_quizzes_remaining == 0
        all_finals_done = result.final_assessments_remaining == 0

        result.eligible = all_lectures_done and all_module_quizzes_done and all_finals_done
        result.course_completed = result.eligible

        return result

    @staticmethod
    async def complete_course_if_eligible(
        db: AsyncSession,
        student_id: int,
        course_id: int,
    ) -> EligibilityResult:
        """
        Checks eligibility and, if all requirements are met:
        1. Marks enrollment as COMPLETED
        2. Issues a certificate (if not already issued)

        Returns the EligibilityResult for the caller to inspect.
        """
        eligibility = await EligibilityService.check_eligibility(
            db, student_id, course_id
        )

        if not eligibility.eligible:
            return eligibility

        # ── Mark enrollment as completed ─────────────────────────────────
        stmt_enr = select(Enrollment).where(
            and_(
                Enrollment.student_id == student_id,
                Enrollment.course_id == course_id,
            )
        )
        res_enr = await db.execute(stmt_enr)
        enrollment = res_enr.scalar_one_or_none()

        if enrollment and enrollment.status != EnrollmentStatus.COMPLETED:
            enrollment.status = EnrollmentStatus.COMPLETED
            enrollment.progress_percentage = 100.0
            enrollment.completed_at = datetime.utcnow()
            db.add(enrollment)

        # ── Issue certificate (delegate to existing service) ─────────────
        from app.services.certificate_service import CertificateService
        await CertificateService.issue_certificate_if_eligible(
            db, student_id, course_id
        )

        await db.commit()
        return eligibility


eligibility_service = EligibilityService()
