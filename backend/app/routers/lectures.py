"""Lecture progress tracking and video streaming endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from app.database import get_db
from app.models.lecture import Lecture
from app.models.student import Student
from app.models.user import User
from app.models.progress import LectureProgress
from app.schemas.schemas import LectureProgressUpdate, LectureProgressResponse
from app.services.auth_service import get_current_user
from app.services.progress_service import progress_service

router = APIRouter(prefix="/api/lectures", tags=["Lectures"])


@router.post("/{lecture_id}/progress", response_model=LectureProgressResponse)
async def update_lecture_progress(
    lecture_id: int,
    data: LectureProgressUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        student = Student(
            user_id=current_user.id,
            full_name=current_user.username.capitalize() + " (Preview)",
            enrollment_number=f"STAFF-{current_user.id:04d}",
            email=f"{current_user.username}@medicaps.ac.in",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    try:
        progress = await progress_service.update_lecture_progress(
            db=db,
            student_id=student.id,
            lecture_id=lecture_id,
            watched_seconds=data.watched_seconds,
            completion_percentage=data.completion_percentage,
            last_position_seconds=data.last_position_seconds,
            segments=data.segments,
            duration=data.duration,
            video_play_time_seconds=data.video_play_time_seconds,
            active_screen_time_seconds=data.active_screen_time_seconds,
            last_activity_at=data.last_activity_at,
        )

        stmt_lec = select(Lecture).where(Lecture.id == lecture_id)
        res_lec = await db.execute(stmt_lec)
        lecture = res_lec.scalar_one_or_none()
        threshold = float(lecture.completion_threshold if (lecture and lecture.completion_threshold) else 90.0)

        return LectureProgressResponse(
            lecture_id=progress.lecture_id,
            watched_seconds=progress.watched_seconds,
            completion_percentage=progress.completion_percentage,
            last_position_seconds=progress.last_position_seconds,
            completed=progress.completed,
            completed_at=progress.completed_at,
            watched_segments=None,
            youtube_play_time_seconds=progress.youtube_play_time_seconds,
            video_play_time_seconds=progress.video_play_time_seconds,
            unique_watched_seconds=progress.watched_seconds,
            active_screen_time_seconds=progress.active_screen_time_seconds,
            completion_threshold=threshold,
            last_activity_at=progress.last_activity_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/{lecture_id}/progress", response_model=LectureProgressResponse)
async def get_lecture_progress(
    lecture_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt_stud = select(Student).where(Student.user_id == current_user.id)
    res_stud = await db.execute(stmt_stud)
    student = res_stud.scalar_one_or_none()
    if not student:
        student = Student(
            user_id=current_user.id,
            full_name=current_user.username.capitalize() + " (Preview)",
            enrollment_number=f"STAFF-{current_user.id:04d}",
            email=f"{current_user.username}@medicaps.ac.in",
        )
        db.add(student)
        await db.commit()
        await db.refresh(student)

    stmt_lec = select(Lecture).where(Lecture.id == lecture_id)
    res_lec = await db.execute(stmt_lec)
    lecture = res_lec.scalar_one_or_none()
    threshold = float(lecture.completion_threshold if (lecture and lecture.completion_threshold) else 90.0)

    stmt = select(LectureProgress).where(
        and_(
            LectureProgress.student_id == student.id,
            LectureProgress.lecture_id == lecture_id,
        )
    )
    res = await db.execute(stmt)
    progress = res.scalar_one_or_none()

    if not progress:
        return LectureProgressResponse(
            lecture_id=lecture_id,
            watched_seconds=0.0,
            completion_percentage=0.0,
            last_position_seconds=0.0,
            completed=False,
            completed_at=None,
            youtube_play_time_seconds=0.0,
            video_play_time_seconds=0.0,
            unique_watched_seconds=0.0,
            active_screen_time_seconds=0.0,
            completion_threshold=threshold,
            last_activity_at=None,
        )

    if progress.completed or progress.completion_percentage >= 100.0:
        progress.completion_percentage = 100.0

    return LectureProgressResponse(
        lecture_id=progress.lecture_id,
        watched_seconds=progress.watched_seconds,
        completion_percentage=progress.completion_percentage,
        last_position_seconds=progress.last_position_seconds,
        completed=progress.completed,
        completed_at=progress.completed_at,
        watched_segments=None,
        youtube_play_time_seconds=progress.youtube_play_time_seconds,
        video_play_time_seconds=progress.video_play_time_seconds,
        unique_watched_seconds=progress.watched_seconds,
        active_screen_time_seconds=progress.active_screen_time_seconds,
        completion_threshold=threshold,
        last_activity_at=progress.last_activity_at,
    )
