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

        # Update lecture duration if client provided a valid duration
        if duration is not None and duration > 0:
            eff_duration = round(duration, 1)
            if lecture.duration is None or lecture.duration <= 0 or abs(lecture.duration - eff_duration) > 1.0:
                lecture.duration = eff_duration
                db.add(lecture)
        else:
            eff_duration = lecture.duration or 0.0

        prog_stmt = select(LectureProgress).where(
            and_(
                LectureProgress.student_id == student_id,
                LectureProgress.lecture_id == lecture_id,
            )
        )
        res = await db.execute(prog_stmt)
        progress = res.scalar_one_or_none()

        # Admin-configured threshold dynamically fetched from lecture model
        threshold_pct = float(
            lecture.completion_threshold
            if (lecture.completion_threshold and lecture.completion_threshold > 0)
            else 90.0
        )
        
        is_already_done = bool(progress and progress.completed)

        # Video Watch Progress: count total accumulated playback time
        current_play_time = max(
            progress.video_play_time_seconds if progress else 0.0,
            progress.watched_seconds if progress else 0.0,
            float(video_play_time_seconds or 0.0),
            float(watched_seconds or 0.0),
        )

        # Active Screen Time: only when video is in PLAYING state and tab is focused/visible
        current_active_time = max(
            progress.active_screen_time_seconds if progress else 0.0,
            float(active_screen_time_seconds or 0.0),
        )

        if eff_duration > 0:
            # Video watch percentage = total accumulated playback time / lecture duration
            watch_ratio = current_play_time / eff_duration
            watch_pct = min(100.0, round(watch_ratio * 100.0, 1))

            # Active screen time requirement is at least 60% of lecture duration
            meets_active_threshold = current_active_time >= (eff_duration * 0.6)

            # Video watch percentage must be >= admin-configured threshold
            meets_watch_threshold = watch_pct >= threshold_pct

            # Both conditions must be satisfied (AND logic)
            is_now_completed = is_already_done or (meets_watch_threshold and meets_active_threshold)
            final_pct = 100.0 if is_now_completed else watch_pct
        else:
            is_now_completed = is_already_done
            final_pct = 100.0 if is_now_completed else 0.0

        if not progress:
            progress = LectureProgress(
                student_id=student_id,
                lecture_id=lecture_id,
                watched_seconds=current_play_time,
                watched_segments="[]",
                completion_percentage=final_pct,
                last_position_seconds=last_position_seconds,
                youtube_play_time_seconds=current_play_time if lecture.video_source_type == "youtube" else 0.0,
                video_play_time_seconds=current_play_time,
                active_screen_time_seconds=current_active_time,
                last_activity_at=last_activity_at or datetime.utcnow(),
                completed=is_now_completed,
                completed_at=datetime.utcnow() if is_now_completed else None,
                last_watched_at=datetime.utcnow(),
            )
            db.add(progress)
        else:
            progress.watched_seconds = current_play_time
            progress.video_play_time_seconds = current_play_time
            if lecture.video_source_type == "youtube":
                progress.youtube_play_time_seconds = current_play_time
            progress.active_screen_time_seconds = current_active_time
            progress.completion_percentage = final_pct
            progress.last_position_seconds = last_position_seconds
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

        # Count total published lectures and completed lectures for this course
        # A lecture is completed only when `completed == True` (set by the
        # tracking system which enforces both watch threshold AND active screen time).
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
                    LectureProgress.completed == True,
                )
            )
            res_prog = await db.execute(stmt_prog)
            completed_count = len(res_prog.scalars().all())
            pct = round((completed_count / len(all_lectures)) * 100, 1)
            enrollment.progress_percentage = pct

        # Attempt course completion via centralized eligibility
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

                # Use the centralized completion check from EligibilityService
                from app.services.eligibility_service import EligibilityService
                is_completed = EligibilityService._is_lecture_completed(lec, lp)

                # Auto-reconcile: if our check says completed but DB flag is not set, update it
                if lp and is_completed and not lp.completed:
                    lp.completed = True
                    lp.completed_at = lp.completed_at or datetime.utcnow()
                    lp.completion_percentage = 100.0
                    db.add(lp)

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
                    "completion_threshold": lec.completion_threshold or 90.0,
                    "progress": {
                        "watched_seconds": (lp.video_play_time_seconds or lp.watched_seconds) if lp else 0,
                        "completion_percentage": 100.0 if is_completed else (lp.completion_percentage if lp else 0),
                        "last_position_seconds": lp.last_position_seconds if lp else 0,
                        "unique_watched_seconds": (lp.video_play_time_seconds or lp.watched_seconds) if lp else 0,
                        "video_play_time_seconds": (lp.video_play_time_seconds or lp.watched_seconds) if lp else 0,
                        "watched_segments": [],
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

        # Run centralized eligibility check and attempt course completion
        from app.services.eligibility_service import eligibility_service
        eligibility = await eligibility_service.complete_course_if_eligible(
            db, student_id, course_id
        )
        # Refresh enrollment to get updated status
        await db.refresh(enrollment)

        return {
            "enrollment": enrollment,
            "modules": modules_status,
            "final_quizzes": final_assessment_items,
            "total_lectures": total_lectures,
            "completed_lectures": completed_lectures,
            "current_module": current_module_title,
            "current_item": current_item_title,
            "eligibility": eligibility.to_dict(),
        }

    @staticmethod
    async def check_and_complete_course(
        db: AsyncSession, student_id: int, course_id: int
    ) -> bool:
        """
        Uses the centralized EligibilityService to determine if the course
        is complete. If eligible, marks the enrollment as COMPLETED and
        issues a certificate. Returns True if the course is now complete.
        """
        from app.services.eligibility_service import eligibility_service
        eligibility = await eligibility_service.complete_course_if_eligible(
            db, student_id, course_id
        )
        return eligibility.eligible


progress_service = ProgressService()
