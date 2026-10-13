import json
from datetime import datetime, timezone
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
        enforce_heartbeat_delta: bool = False,
    ) -> LectureProgress:
        now = datetime.utcnow()
        # Ensure last_activity_at is a timezone-naive UTC datetime and not in the future
        if last_activity_at is not None:
            if last_activity_at.tzinfo is not None:
                last_activity_at = last_activity_at.astimezone(timezone.utc).replace(tzinfo=None)
            if last_activity_at > now:
                last_activity_at = now
        else:
            last_activity_at = now

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

        # Parse and merge watched segments
        existing_segments = []
        if progress and progress.watched_segments:
            try:
                parsed = json.loads(progress.watched_segments)
                if isinstance(parsed, list):
                    existing_segments = parsed
            except Exception:
                existing_segments = []

        all_segments = list(existing_segments)
        if segments:
            all_segments.extend(segments)

        merged_segments = merge_segments(all_segments, max_duration=eff_duration if eff_duration > 0 else None)
        unique_from_segments = calculate_unique_watched(merged_segments)

        client_play = max(float(video_play_time_seconds or 0.0), float(watched_seconds or 0.0))
        client_active = float(active_screen_time_seconds or 0.0)

        # Enforce delta limits when requested (API updates from client)
        if enforce_heartbeat_delta:
            if not progress or not progress.last_watched_at:
                # First progress submission: allow at most 30 seconds
                client_play = min(client_play, 30.0)
                client_active = min(client_active, 30.0)
            else:
                elapsed = max(1.0, (now - progress.last_watched_at).total_seconds())
                max_delta = max(15.0, elapsed * 2.0 + 5.0)
                prev_play = progress.video_play_time_seconds or progress.watched_seconds or 0.0
                prev_active = progress.active_screen_time_seconds or 0.0
                client_play = min(client_play, prev_play + max_delta)
                client_active = min(client_active, prev_active + max_delta)

        # Unique watched playback seconds bounded by duration
        current_play_time = max(
            unique_from_segments,
            progress.video_play_time_seconds if progress else 0.0,
            progress.watched_seconds if progress else 0.0,
            client_play,
        )
        if eff_duration > 0:
            current_play_time = min(eff_duration, current_play_time)

        # Active Screen Time: only when video is in PLAYING state and tab is focused/visible
        raw_active_time = max(
            progress.active_screen_time_seconds if progress else 0.0,
            client_active,
        )
        if eff_duration > 0:
            raw_active_time = min(eff_duration * 1.5, raw_active_time)
        current_active_time = max(raw_active_time, current_play_time * 0.75) if current_play_time > 0 else raw_active_time

        if eff_duration > 0:
            watch_pct = min(100.0, round((current_play_time / eff_duration) * 100.0, 1))
            meets_watch_threshold = watch_pct >= threshold_pct
            meets_active_threshold = current_active_time >= (eff_duration * 0.5) or current_active_time >= (current_play_time * 0.7)

            # Completion can ONLY happen when watch requirement AND active screen requirement are satisfied, or already completed
            is_now_completed = is_already_done or (meets_watch_threshold and meets_active_threshold)
            final_pct = 100.0 if is_now_completed else watch_pct
        else:
            is_now_completed = is_already_done or (current_play_time >= 30.0)
            final_pct = 100.0 if is_now_completed else 0.0

        print(f"[VIDEO_PROGRESS] lectureId={lecture_id} studentId={student_id} watchedSeconds={current_play_time:.1f} watchedPercentage={final_pct:.1f}%")
        print(f"[LECTURE_COMPLETION] eligible={is_now_completed} (alreadyDone={is_already_done}, meetsWatch={meets_watch_threshold if eff_duration > 0 else True})")

        clamped_position = max(0.0, min(float(last_position_seconds or 0.0), eff_duration if eff_duration > 0 else float(last_position_seconds or 0.0)))

        if not progress:
            progress = LectureProgress(
                student_id=student_id,
                lecture_id=lecture_id,
                watched_seconds=current_play_time,
                watched_segments=json.dumps(merged_segments),
                completion_percentage=final_pct,
                last_position_seconds=clamped_position,
                youtube_play_time_seconds=current_play_time if lecture.video_source_type == "youtube" else 0.0,
                video_play_time_seconds=current_play_time,
                active_screen_time_seconds=current_active_time,
                last_activity_at=last_activity_at,
                completed=is_now_completed,
                completed_at=datetime.utcnow() if is_now_completed else None,
                last_watched_at=datetime.utcnow(),
            )
            db.add(progress)
        else:
            progress.watched_seconds = current_play_time
            progress.video_play_time_seconds = current_play_time
            progress.watched_segments = json.dumps(merged_segments)
            if lecture.video_source_type == "youtube":
                progress.youtube_play_time_seconds = current_play_time
            progress.active_screen_time_seconds = current_active_time
            progress.completion_percentage = final_pct
            progress.last_position_seconds = clamped_position
            progress.last_activity_at = last_activity_at
            progress.last_watched_at = datetime.utcnow()
            if is_now_completed:
                progress.completed = True
                if not progress.completed_at:
                    progress.completed_at = datetime.utcnow()
                progress.completion_percentage = 100.0

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
        needs_db_commit = False

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
                    needs_db_commit = True

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
                    "video_path": lec.video_path if not is_locked else None,
                    "video_source_type": lec.video_source_type if not is_locked else None,
                    "video_source_url": lec.video_source_url if not is_locked else None,
                    "video_id": lec.video_id if not is_locked else None,
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

        if needs_db_commit:
            await db.commit()

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

    @staticmethod
    async def is_lecture_locked(db: AsyncSession, student_id: int, lecture_id: int) -> bool:
        """Check if a lecture is locked for the student according to sequential course progression."""
        stmt = select(Lecture).options(selectinload(Lecture.module)).where(Lecture.id == lecture_id)
        res = await db.execute(stmt)
        lecture = res.scalar_one_or_none()
        if not lecture or not lecture.module:
            return True
        course_id = lecture.module.course_id
        curriculum = await ProgressService.get_course_curriculum_status(db, student_id, course_id)
        for mod in curriculum.get("modules", []):
            for item in mod.get("items", []):
                if item.get("type") == "lecture" and item.get("id") == lecture_id:
                    return bool(item.get("is_locked"))
        return False

    @staticmethod
    async def is_quiz_locked(db: AsyncSession, student_id: int, quiz_id: int) -> bool:
        """Check if a quiz is locked for the student according to sequential course progression."""
        stmt = select(Quiz).options(selectinload(Quiz.module)).where(Quiz.id == quiz_id)
        res = await db.execute(stmt)
        quiz = res.scalar_one_or_none()
        if not quiz:
            return True
        course_id = quiz.course_id or (quiz.module.course_id if quiz.module else None)
        if not course_id:
            return False
        curriculum = await ProgressService.get_course_curriculum_status(db, student_id, course_id)
        for mod in curriculum.get("modules", []):
            for item in mod.get("items", []):
                if item.get("type") == "quiz" and item.get("id") == quiz_id:
                    return bool(item.get("is_locked"))
        for final_q in curriculum.get("final_quizzes", []):
            if final_q.get("id") == quiz_id:
                return bool(final_q.get("is_locked"))
        return False


progress_service = ProgressService()

