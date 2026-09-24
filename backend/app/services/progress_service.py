import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models.course import Course
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.progress import LectureProgress, QuizAttempt
from app.models.certificate import Certificate


def merge_segments(
    segments: Optional[List[List[float]]], max_duration: Optional[float] = None
) -> List[List[float]]:
    """
    Merge overlapping or contiguous video segments [[start, end], ...].
    Ensures that no segment portion is counted more than once.
    """
    if not segments:
        return []
    valid = []
    for item in segments:
        if isinstance(item, (list, tuple)) and len(item) == 2:
            try:
                s, e = float(item[0]), float(item[1])
                start = max(0.0, s)
                end = min(max(0.0, e), max_duration) if max_duration else max(0.0, e)
                if end > start:
                    valid.append([start, end])
            except (ValueError, TypeError):
                continue
    if not valid:
        return []
    # Sort by start time, then end time
    valid.sort(key=lambda x: (x[0], x[1]))
    merged = [valid[0]]
    for current in valid[1:]:
        last = merged[-1]
        # Overlapping or contiguous with 0.5s tolerance
        if current[0] <= last[1] + 0.5:
            last[1] = max(last[1], current[1])
        else:
            merged.append(current)
    return [[round(s, 2), round(e, 2)] for s, e in merged]


def calculate_unique_watched(merged: List[List[float]]) -> float:
    return round(sum(e - s for s, e in merged), 2)


class ProgressService:
    @staticmethod
    async def get_or_create_enrollment(
        db: AsyncSession, student_id: int, course_id: int
    ) -> Enrollment:
        stmt = select(Enrollment).where(
            and_(Enrollment.student_id == student_id, Enrollment.course_id == course_id)
        )
        res = await db.execute(stmt)
        enrollment = res.scalar_one_or_none()
        if not enrollment:
            enrollment = Enrollment(
                student_id=student_id,
                course_id=course_id,
                status=EnrollmentStatus.ENROLLED,
                progress_percentage=0.0,
            )
            db.add(enrollment)
            await db.commit()
            await db.refresh(enrollment)
        return enrollment

    @staticmethod
    async def update_lecture_progress(
        db: AsyncSession,
        student_id: int,
        lecture_id: int,
        watched_seconds: Optional[float] = 0.0,
        completion_percentage: Optional[float] = 0.0,
        last_position_seconds: float = 0.0,
        segments: Optional[List[List[float]]] = None,
        duration: Optional[float] = None,
        video_play_time_seconds: Optional[float] = 0.0,
        active_screen_time_seconds: Optional[float] = 0.0,
        last_activity_at: Optional[datetime] = None,
    ) -> LectureProgress:
        stmt = select(Lecture).options(selectinload(Lecture.module)).where(Lecture.id == lecture_id)
        res = await db.execute(stmt)
        lecture = res.scalar_one_or_none()
        if not lecture:
            raise ValueError("Lecture not found")

        # Update lecture duration if database was missing it and client provided a valid duration
        if duration is not None and duration > 0:
            if lecture.duration is None or lecture.duration <= 0:
                lecture.duration = round(duration, 1)
                db.add(lecture)

        eff_duration = lecture.duration or (duration if (duration and duration > 0) else 0.0)

        prog_stmt = select(LectureProgress).where(
            and_(
                LectureProgress.student_id == student_id,
                LectureProgress.lecture_id == lecture_id,
            )
        )
        res = await db.execute(prog_stmt)
        progress = res.scalar_one_or_none()

        # Parse existing segments
        existing_segments: List[List[float]] = []
        if progress and progress.watched_segments:
            try:
                existing_segments = json.loads(progress.watched_segments)
            except Exception:
                existing_segments = []

        # Merge existing + new incoming segments
        all_segments = existing_segments + (segments or [])
        merged = merge_segments(all_segments, eff_duration if eff_duration > 0 else None)
        unique_watched = calculate_unique_watched(merged)

        # Completion requires both unique coverage and active screen time.
        threshold_pct = lecture.completion_threshold if (lecture.completion_threshold and lecture.completion_threshold > 0) else 90.0
        
        is_already_done = progress is not None and progress.completed

        if eff_duration > 0:
            watch_ratio = unique_watched / eff_duration
            meets_threshold = watch_ratio >= (threshold_pct / 100.0)
            current_active_time = max(
                progress.active_screen_time_seconds if progress else 0.0,
                float(active_screen_time_seconds or 0.0),
            )
            meets_active_threshold = current_active_time >= eff_duration * 0.6
            is_now_completed = is_already_done or (meets_threshold and meets_active_threshold)
            calculated_pct = min(100.0, round(watch_ratio * 100.0, 1))
            final_pct = 100.0 if is_now_completed else calculated_pct
        else:
            # If duration is 0 or unknown, cannot validate completion
            is_now_completed = is_already_done
            final_pct = 100.0 if is_now_completed else 0.0

        if not progress:
            progress = LectureProgress(
                student_id=student_id,
                lecture_id=lecture_id,
                watched_seconds=unique_watched,
                watched_segments=json.dumps(merged),
                completion_percentage=final_pct,
                last_position_seconds=last_position_seconds,
                youtube_play_time_seconds=0.0,
                video_play_time_seconds=max(0.0, float(video_play_time_seconds or 0.0)),
                active_screen_time_seconds=max(0.0, float(active_screen_time_seconds or 0.0)),
                last_activity_at=last_activity_at or datetime.utcnow(),
                completed=is_now_completed,
                completed_at=datetime.utcnow() if is_now_completed else None,
                last_watched_at=datetime.utcnow(),
            )
            db.add(progress)
        else:
            progress.watched_seconds = unique_watched
            progress.watched_segments = json.dumps(merged)
            progress.completion_percentage = final_pct
            progress.last_position_seconds = last_position_seconds
            progress.video_play_time_seconds = max(
                progress.video_play_time_seconds or 0.0,
                float(video_play_time_seconds or 0.0),
            )
            if lecture.video_source_type == "youtube":
                progress.youtube_play_time_seconds = progress.video_play_time_seconds
            progress.active_screen_time_seconds = max(
                progress.active_screen_time_seconds or 0.0,
                float(active_screen_time_seconds or 0.0),
            )
            if last_activity_at:
                progress.last_activity_at = last_activity_at
            progress.last_watched_at = datetime.utcnow()
            if is_now_completed and not progress.completed:
                progress.completed = True
                progress.completed_at = datetime.utcnow()

        await db.commit()
        await db.refresh(progress)

        # Update overall enrollment status and progress
        course_id = lecture.module.course_id if lecture.module else None
        await ProgressService.recalculate_course_progress(db, student_id, course_id, lecture=lecture)
        return progress

    @staticmethod
    async def recalculate_course_progress(
        db: AsyncSession, student_id: int, course_id: Optional[int] = None, lecture: Optional[Lecture] = None
    ) -> None:
        if course_id is None and lecture is not None:
            if not lecture.module:
                mod_res = await db.execute(select(Module).where(Module.id == lecture.module_id))
                mod = mod_res.scalar_one_or_none()
                if mod:
                    course_id = mod.course_id
            else:
                course_id = lecture.module.course_id

        if not course_id:
            return

        enrollment = await ProgressService.get_or_create_enrollment(db, student_id, course_id)
        if enrollment.status != EnrollmentStatus.COMPLETED and enrollment.status != EnrollmentStatus.IN_PROGRESS:
            enrollment.status = EnrollmentStatus.IN_PROGRESS
            enrollment.started_at = enrollment.started_at or datetime.utcnow()

        # Count total lectures and completed lectures for this course
        stmt_lectures = (
            select(Lecture)
            .join(Module, Lecture.module_id == Module.id)
            .where(and_(Module.course_id == course_id, Lecture.is_published == True))
        )
        res_lec = await db.execute(stmt_lectures)
        all_lectures = res_lec.scalars().all()

        if all_lectures:
            lec_ids = [l.id for l in all_lectures]
            stmt_prog = select(LectureProgress).where(
                and_(
                    LectureProgress.student_id == student_id,
                    LectureProgress.lecture_id.in_(lec_ids),
                    (LectureProgress.completed == True) | (LectureProgress.completion_percentage >= 100.0),
                )
            )
            res_prog = await db.execute(stmt_prog)
            completed_count = len(res_prog.scalars().all())
            pct = round((completed_count / len(all_lectures)) * 100, 1)
            enrollment.progress_percentage = pct

        # Check if course is fully completed
        await ProgressService.check_and_complete_course(db, student_id, course_id)
        await db.commit()

    @staticmethod
    async def get_course_curriculum_status(
        db: AsyncSession, student_id: int, course_id: int
    ) -> Dict[str, Any]:
        """Calculates locked/unlocked/completed status for all modules, lectures, and quizzes."""
        stmt = (
            select(Course)
            .where(Course.id == course_id)
            .options(
                selectinload(Course.modules)
                .selectinload(Module.lectures),
                selectinload(Course.modules)
                .selectinload(Module.quizzes)
                .selectinload(Quiz.questions),
            )
        )
        res = await db.execute(stmt)
        course = res.scalar_one_or_none()
        if not course:
            raise ValueError("Course not found")

        # Get standalone final quizzes (if any)
        stmt_final = select(Quiz).where(
            and_(Quiz.course_id == course_id, Quiz.is_final_assessment == True, Quiz.is_published == True)
        ).options(selectinload(Quiz.questions))
        res_final = await db.execute(stmt_final)
        final_quizzes = res_final.scalars().all()

        # Get student's lecture progress
        stmt_lp = (
            select(LectureProgress)
            .join(Lecture, LectureProgress.lecture_id == Lecture.id)
            .join(Module, Lecture.module_id == Module.id)
            .where(and_(LectureProgress.student_id == student_id, Module.course_id == course_id))
        )
        res_lp = await db.execute(stmt_lp)
        lp_map = {lp.lecture_id: lp for lp in res_lp.scalars().all()}

        # Get student's passed quizzes
        stmt_qa = select(QuizAttempt).where(
            and_(QuizAttempt.student_id == student_id, QuizAttempt.passed == True)
        )
        res_qa = await db.execute(stmt_qa)
        passed_quiz_ids = {qa.quiz_id for qa in res_qa.scalars().all()}

        # Sort modules by order_index
        sorted_modules = sorted(course.modules, key=lambda m: m.order_index)

        modules_status = []
        previous_module_completed = True
        total_lectures = 0
        completed_lectures = 0
        current_module_title = None
        current_item_title = None

        for m_idx, mod in enumerate(sorted_modules):
            mod_locked = not previous_module_completed
            mod_lock_reason = f"Complete Module {m_idx} first" if mod_locked else None

            sorted_lectures = sorted([l for l in mod.lectures if l.is_published], key=lambda x: x.order_index)
            sorted_quizzes = sorted([q for q in mod.quizzes if q.is_published], key=lambda x: x.order_index)

            items_status = []
            previous_item_completed = True if not mod_locked else False
            all_module_lectures_completed = True

            # Process lectures in this module sequentially
            for l_idx, lec in enumerate(sorted_lectures):
                total_lectures += 1
                lp = lp_map.get(lec.id)
                is_completed = (lp.completed or (lp.completion_percentage >= 100.0)) if lp else False
                if is_completed:
                    completed_lectures += 1

                is_locked = mod_locked or not previous_item_completed
                lock_reason = None
                if is_locked:
                    if mod_locked:
                        lock_reason = mod_lock_reason
                    else:
                        prev_lec_title = sorted_lectures[l_idx - 1].title if l_idx > 0 else "previous lecture"
                        lock_reason = f"Complete '{prev_lec_title}' first"

                if not is_locked and not is_completed and current_item_title is None:
                    current_item_title = lec.title
                    current_module_title = mod.title

                items_status.append({
                    "id": lec.id,
                    "type": "lecture",
                    "title": lec.title,
                    "duration": lec.duration,
                    "video_path": lec.video_path,
                    "video_source_type": lec.video_source_type,
                    "video_source_url": lec.video_source_url,
                    "video_id": lec.video_id,
                    "is_locked": is_locked,
                    "is_completed": is_completed,
                    "lock_reason": lock_reason,
                    "order_index": lec.order_index,
                    "progress": {
                        "watched_seconds": lp.watched_seconds if lp else 0,
                        "completion_percentage": 100.0 if is_completed else (lp.completion_percentage if lp else 0),
                        "last_position_seconds": lp.last_position_seconds if lp else 0,
                        "unique_watched_seconds": lp.watched_seconds if lp else 0,
                        "video_play_time_seconds": lp.video_play_time_seconds if lp else 0,
                        "watched_segments": json.loads(lp.watched_segments) if lp and lp.watched_segments else [],
                        "active_screen_time_seconds": lp.active_screen_time_seconds if lp else 0,
                        "last_activity_at": lp.last_activity_at if lp else None,
                    } if lp else None
                })

                if not is_completed:
                    all_module_lectures_completed = False
                    previous_item_completed = False

            # Process quizzes in this module
            all_module_quizzes_passed = True
            for q_idx, qz in enumerate(sorted_quizzes):
                is_passed = qz.id in passed_quiz_ids
                # Quiz unlocks when all lectures in this module are completed
                is_locked = mod_locked or (not all_module_lectures_completed) or (not previous_item_completed)
                lock_reason = None
                if is_locked:
                    if mod_locked:
                        lock_reason = mod_lock_reason
                    elif not all_module_lectures_completed:
                        lock_reason = f"Complete all lectures in {mod.title} first"
                    else:
                        lock_reason = "Complete previous content first"

                if not is_locked and not is_passed and current_item_title is None:
                    current_item_title = qz.title
                    current_module_title = mod.title

                items_status.append({
                    "id": qz.id,
                    "type": "quiz",
                    "title": qz.title,
                    "passing_percentage": qz.passing_percentage,
                    "max_attempts": qz.max_attempts,
                    "is_locked": is_locked,
                    "is_completed": is_passed,
                    "lock_reason": lock_reason,
                    "order_index": qz.order_index,
                })

                if not is_passed:
                    all_module_quizzes_passed = False
                    previous_item_completed = False

            module_is_completed = all_module_lectures_completed and all_module_quizzes_passed
            modules_status.append({
                "id": mod.id,
                "title": mod.title,
                "order_index": mod.order_index,
                "is_locked": mod_locked,
                "is_completed": module_is_completed,
                "lock_reason": mod_lock_reason,
                "items": items_status,
            })

            previous_module_completed = module_is_completed

        # Check final assessments
        final_assessment_items = []
        for fq in final_quizzes:
            is_passed = fq.id in passed_quiz_ids
            is_locked = not previous_module_completed
            lock_reason = "Complete all modules first" if is_locked else None

            if not is_locked and not is_passed and current_item_title is None:
                current_item_title = fq.title
                current_module_title = "Final Assessment"

            final_assessment_items.append({
                "id": fq.id,
                "type": "quiz",
                "title": fq.title,
                "passing_percentage": fq.passing_percentage,
                "is_locked": is_locked,
                "is_completed": is_passed,
                "lock_reason": lock_reason,
                "is_final": True,
                "order_index": fq.order_index,
            })

        enrollment = await ProgressService.get_or_create_enrollment(db, student_id, course_id)

        return {
            "enrollment": enrollment,
            "modules": modules_status,
            "final_quizzes": final_assessment_items,
            "total_lectures": total_lectures,
            "completed_lectures": completed_lectures,
            "current_module": current_module_title,
            "current_item": current_item_title,
        }

    @staticmethod
    async def check_and_complete_course(
        db: AsyncSession, student_id: int, course_id: int
    ) -> bool:
        """
        Requirements from Section 19:
        - All required lectures completed
        - All required module quizzes passed
        - Final assessment passed (if exists) at required passing percentage
        """
        enrollment = await ProgressService.get_or_create_enrollment(db, student_id, course_id)
        if enrollment.status == EnrollmentStatus.COMPLETED:
            return True

        # Check all published required lectures
        stmt_lec = (
            select(Lecture)
            .join(Module, Lecture.module_id == Module.id)
            .where(
                and_(
                    Module.course_id == course_id,
                    Lecture.is_published == True,
                    Lecture.is_required == True,
                )
            )
        )
        res_lec = await db.execute(stmt_lec)
        lectures = res_lec.scalars().all()

        if lectures:
            lec_ids = [l.id for l in lectures]
            stmt_prog = select(LectureProgress).where(
                and_(
                    LectureProgress.student_id == student_id,
                    LectureProgress.lecture_id.in_(lec_ids),
                    (LectureProgress.completed == True) | (LectureProgress.completion_percentage >= 100.0),
                )
            )
            res_prog = await db.execute(stmt_prog)
            completed_lec_ids = {p.lecture_id for p in res_prog.scalars().all()}
            if len(completed_lec_ids) < len(lec_ids):
                return False

        # Check all required quizzes
        stmt_qz = (
            select(Quiz)
            .outerjoin(Module, Quiz.module_id == Module.id)
            .where(
                and_(
                    (Module.course_id == course_id) | (Quiz.course_id == course_id),
                    Quiz.is_published == True,
                    Quiz.is_required == True,
                )
            )
        )
        res_qz = await db.execute(stmt_qz)
        quizzes = res_qz.scalars().all()

        if quizzes:
            quiz_ids = [q.id for q in quizzes]
            stmt_qa = select(QuizAttempt).where(
                and_(
                    QuizAttempt.student_id == student_id,
                    QuizAttempt.quiz_id.in_(quiz_ids),
                    QuizAttempt.passed == True,
                )
            )
            res_qa = await db.execute(stmt_qa)
            passed_quiz_ids = {a.quiz_id for a in res_qa.scalars().all()}
            if len(passed_quiz_ids) < len(quiz_ids):
                return False

        # If we reached here, student completed the course!
        enrollment.status = EnrollmentStatus.COMPLETED
        enrollment.progress_percentage = 100.0
        enrollment.completed_at = datetime.utcnow()
        await db.commit()

        # Automatically issue certificate if not already issued
        from app.services.certificate_service import CertificateService
        await CertificateService.issue_certificate_if_eligible(db, student_id, course_id)
        return True


progress_service = ProgressService()
