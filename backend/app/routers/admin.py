"""Admin management API: Dashboard, Course Builder, Content Uploader, Student Management, and Certificate Revocation."""

import io
import os
import csv
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, or_
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.user import User, UserRole
from app.models.student import Student
from app.models.course import Course, CourseStatus
from app.models.module import Module
from app.models.lecture import Lecture
from app.models.quiz import Quiz
from app.models.question import Question, QuestionType, QuizOption
from app.models.enrollment import Enrollment, EnrollmentStatus
from app.models.progress import QuizAttempt, LectureProgress
from app.models.certificate import Certificate
from app.schemas.schemas import (
    CourseCreate,
    CourseUpdate,
    ModuleCreate,
    ModuleUpdate,
    LectureCreate,
    LectureUpdate,
    QuizCreate,
    QuizUpdate,
    QuestionCreate,
    QuestionUpdate,
    StudentCreate,
    StudentUpdate,
    ResetPasswordRequest,
    AdminDashboardResponse,
    AdminEnrollRequest,
    AdminEnrollmentUpdate,
    AdminIssueCertificateRequest,
)
from app.services.auth_service import require_admin, hash_password
from app.services.storage.local import storage_service
from app.utils.video import detect_video_source, get_mp4_duration, get_youtube_duration

router = APIRouter(prefix="/api/admin", tags=["Admin"], dependencies=[Depends(require_admin)])


# ─── Dashboard ───────────────────────────────────────────────────────────────

@router.get("/dashboard", response_model=AdminDashboardResponse)
async def get_admin_dashboard(db: AsyncSession = Depends(get_db)):
    tot_students = (await db.execute(select(func.count(Student.id)))).scalar() or 0
    tot_courses = (await db.execute(select(func.count(Course.id)))).scalar() or 0
    pub_courses = (
        await db.execute(select(func.count(Course.id)).where(Course.status == CourseStatus.PUBLISHED))
    ).scalar() or 0
    tot_certs = (await db.execute(select(func.count(Certificate.id)))).scalar() or 0

    # Recent activities
    activities = []

    # Recent certificates
    recent_certs = (
        await db.execute(
            select(Certificate)
            .options(selectinload(Certificate.student), selectinload(Certificate.course))
            .order_by(Certificate.issued_at.desc())
            .limit(5)
        )
    ).scalars().all()

    for c in recent_certs:
        activities.append({
            "type": "CERTIFICATE_ISSUED",
            "message": f"Certificate {c.certificate_number} issued to {c.student.full_name if c.student else 'Student'} for {c.course.title if c.course else 'Course'}",
            "timestamp": c.issued_at,
        })

    # Recent enrollments
    recent_enr = (
        await db.execute(
            select(Enrollment)
            .options(selectinload(Enrollment.student), selectinload(Enrollment.course))
            .order_by(Enrollment.enrolled_at.desc())
            .limit(5)
        )
    ).scalars().all()

    for e in recent_enr:
        activities.append({
            "type": "STUDENT_ENROLLED",
            "message": f"{e.student.full_name if e.student else 'Student'} enrolled in {e.course.title if e.course else 'Course'}",
            "timestamp": e.enrolled_at,
        })

    activities.sort(key=lambda x: x["timestamp"], reverse=True)

    return AdminDashboardResponse(
        total_students=tot_students,
        total_courses=tot_courses,
        published_courses=pub_courses,
        certificates_issued=tot_certs,
        recent_activities=activities[:10],
    )


# ─── Course Management & Builder ─────────────────────────────────────────────

@router.get("/courses")
async def list_admin_courses(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Course)
        .options(
            selectinload(Course.modules).selectinload(Module.lectures),
            selectinload(Course.modules).selectinload(Module.quizzes),
            selectinload(Course.enrollments),
            selectinload(Course.certificates),
        )
        .order_by(Course.created_at.desc())
    )
    res = await db.execute(stmt)
    courses = res.scalars().all()

    return [
        {
            "id": c.id,
            "course_code": c.course_code,
            "title": c.title,
            "short_description": c.short_description,
            "instructor_name": c.instructor_name,
            "status": c.status.value if hasattr(c.status, "value") else str(c.status),
            "created_at": c.created_at,
            "module_count": len(c.modules),
            "lecture_count": sum(len(m.lectures) for m in c.modules),
            "quiz_count": sum(len(m.quizzes) for m in c.modules),
            "enrolled_count": len(c.enrollments),
            "certificates_count": len(c.certificates),
        }
        for c in courses
    ]


@router.post("/courses")
async def create_course(data: CourseCreate, db: AsyncSession = Depends(get_db)):
    # Check if course_code exists
    exist = await db.execute(select(Course).where(Course.course_code == data.course_code))
    if exist.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Course code already exists")

    course = Course(
        course_code=data.course_code,
        title=data.title,
        short_description=data.short_description,
        description=data.description,
        instructor_name=data.instructor_name,
        estimated_duration=data.estimated_duration,
        status=CourseStatus.DRAFT,
    )
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course


@router.get("/courses/{course_id}/builder")
async def get_course_for_builder(course_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Course)
        .where(Course.id == course_id)
        .options(
            selectinload(Course.modules).selectinload(Module.lectures),
            selectinload(Course.modules).selectinload(Module.quizzes).selectinload(Quiz.questions).selectinload(Question.options),
        )
    )
    res = await db.execute(stmt)
    course = res.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    return course


@router.put("/courses/{course_id}")
async def update_course(course_id: int, data: CourseUpdate, db: AsyncSession = Depends(get_db)):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if data.title is not None:
        course.title = data.title
    if data.course_code is not None:
        course.course_code = data.course_code
    if data.short_description is not None:
        course.short_description = data.short_description
    if data.description is not None:
        course.description = data.description
    if data.instructor_name is not None:
        course.instructor_name = data.instructor_name
    if data.estimated_duration is not None:
        course.estimated_duration = data.estimated_duration
    if data.status is not None:
        try:
            course.status = CourseStatus(data.status)
            if course.status == CourseStatus.PUBLISHED and not course.published_at:
                course.published_at = datetime.utcnow()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid course status")

    await db.commit()
    await db.refresh(course)
    return course


@router.delete("/courses/{course_id}")
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db)):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    await db.delete(course)
    await db.commit()
    return {"message": "Course deleted"}


# ─── Module Management ───────────────────────────────────────────────────────

@router.post("/courses/{course_id}/modules")
async def add_module(course_id: int, data: ModuleCreate, db: AsyncSession = Depends(get_db)):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Determine order index
    count_res = await db.execute(select(func.count(Module.id)).where(Module.course_id == course_id))
    order_idx = count_res.scalar() or 0

    mod = Module(
        course_id=course_id,
        title=data.title,
        description=data.description,
        order_index=data.order_index if data.order_index is not None else order_idx,
    )
    db.add(mod)
    await db.commit()
    await db.refresh(mod)
    return mod


@router.put("/modules/{module_id}")
async def update_module(module_id: int, data: ModuleUpdate, db: AsyncSession = Depends(get_db)):
    mod = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    if data.title is not None:
        mod.title = data.title
    if data.description is not None:
        mod.description = data.description
    if data.order_index is not None:
        mod.order_index = data.order_index

    await db.commit()
    await db.refresh(mod)
    return mod


@router.delete("/modules/{module_id}")
async def delete_module(module_id: int, db: AsyncSession = Depends(get_db)):
    mod = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")
    await db.delete(mod)
    await db.commit()
    return {"message": "Module deleted"}


# ─── Lecture Management & Local Video Upload ─────────────────────────────────

@router.post("/modules/{module_id}/lectures")
async def add_lecture(
    module_id: int,
    title: str = Form(...),
    description: Optional[str] = Form(None),
    order_index: Optional[int] = Form(0),
    completion_threshold: Optional[float] = Form(90.0),
    is_required: Optional[bool] = Form(True),
    video_file: Optional[UploadFile] = File(None),
    video_url_path: Optional[str] = Form(None),
    duration: Optional[float] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    mod = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    video_path = video_url_path
    video_source_type = "local"
    video_id = None
    if video_url_path:
        try:
            video_source_type, video_id = detect_video_source(video_url_path)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if video_source_type == "youtube" and video_id:
            yt_dur = get_youtube_duration(video_id)
            if yt_dur and yt_dur > 0:
                if duration is None or duration == 300.0 or duration <= 0:
                    duration = round(yt_dur, 1)
    if video_file and video_file.filename:
        # Validate format
        if not video_file.filename.lower().endswith(".mp4"):
            raise HTTPException(status_code=400, detail="Only MP4 video format is supported for prototype")

        uploaded_rel_path = await storage_service.upload(
            video_file.file, video_file.filename, subfolder="videos"
        )
        video_path = uploaded_rel_path
        video_source_type = "local"

        # Directly fetch duration (seconds) from the uploaded video file length
        clean_path = uploaded_rel_path.replace("/uploads/", "")
        full_path = os.path.join(storage_service.base_dir, clean_path)
        extracted_dur = get_mp4_duration(full_path)
        if extracted_dur and extracted_dur > 0:
            if duration is None or duration == 300.0 or duration <= 0:
                duration = round(extracted_dur, 1)

    lecture = Lecture(
        module_id=module_id,
        title=title,
        description=description,
        video_path=video_path,
        video_source_type=video_source_type,
        video_source_url=video_url_path if video_source_type != "local" else None,
        video_id=video_id,
        duration=duration or 300.0,
        order_index=order_index or 0,
        completion_threshold=completion_threshold or 90.0,
        is_required=is_required if is_required is not None else True,
        is_published=True,
    )
    db.add(lecture)
    await db.commit()
    await db.refresh(lecture)
    return lecture


@router.put("/lectures/{lecture_id}")
async def update_lecture(
    lecture_id: int,
    data: LectureUpdate,
    db: AsyncSession = Depends(get_db),
):
    lec = (await db.execute(select(Lecture).where(Lecture.id == lecture_id))).scalar_one_or_none()
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")

    if data.title is not None:
        lec.title = data.title
    if data.description is not None:
        lec.description = data.description
    if data.duration is not None:
        lec.duration = data.duration
    if data.order_index is not None:
        lec.order_index = data.order_index
    if data.completion_threshold is not None:
        lec.completion_threshold = data.completion_threshold
    if data.is_required is not None:
        lec.is_required = data.is_required
    if data.video_source_url is not None:
        try:
            source_type, video_id = detect_video_source(data.video_source_url)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        lec.video_source_type = source_type
        lec.video_source_url = data.video_source_url
        lec.video_path = data.video_source_url
        lec.video_id = video_id
        if source_type == "youtube" and video_id:
            yt_dur = get_youtube_duration(video_id)
            if yt_dur and yt_dur > 0:
                if data.duration is None or data.duration == 300.0 or data.duration <= 0:
                    lec.duration = round(yt_dur, 1)

    await db.commit()
    await db.refresh(lec)
    return lec


@router.delete("/lectures/{lecture_id}")
async def delete_lecture(lecture_id: int, db: AsyncSession = Depends(get_db)):
    lec = (await db.execute(select(Lecture).where(Lecture.id == lecture_id))).scalar_one_or_none()
    if not lec:
        raise HTTPException(status_code=404, detail="Lecture not found")
    if lec.video_path:
        await storage_service.delete(lec.video_path)
    await db.delete(lec)
    await db.commit()
    return {"message": "Lecture deleted"}


# ─── Quiz Management ─────────────────────────────────────────────────────────

@router.post("/modules/{module_id}/quizzes")
async def add_quiz(
    module_id: int,
    data: QuizCreate,
    db: AsyncSession = Depends(get_db),
):
    mod = (await db.execute(select(Module).where(Module.id == module_id))).scalar_one_or_none()
    if not mod:
        raise HTTPException(status_code=404, detail="Module not found")

    quiz = Quiz(
        module_id=module_id,
        course_id=mod.course_id,
        title=data.title,
        description=data.description,
        passing_percentage=data.passing_percentage or 100.0,
        max_attempts=data.max_attempts,
        randomize_questions=data.randomize_questions or False,
        is_final_assessment=data.is_final_assessment or False,
        order_index=data.order_index or 0,
        is_published=True,
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)
    return quiz


@router.post("/courses/{course_id}/final-quiz")
async def add_final_quiz(
    course_id: int,
    data: QuizCreate,
    db: AsyncSession = Depends(get_db),
):
    course = (await db.execute(select(Course).where(Course.id == course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    quiz = Quiz(
        course_id=course_id,
        module_id=None,
        title=data.title,
        description=data.description,
        passing_percentage=data.passing_percentage or 100.0,
        max_attempts=data.max_attempts,
        randomize_questions=data.randomize_questions or False,
        is_final_assessment=True,
        order_index=data.order_index or 0,
        is_published=True,
    )
    db.add(quiz)
    await db.commit()
    await db.refresh(quiz)
    return quiz


@router.get("/quizzes/{quiz_id}")
async def get_quiz_admin(quiz_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Quiz)
        .where(Quiz.id == quiz_id)
        .options(
            selectinload(Quiz.questions).selectinload(Question.options),
        )
    )
    res = await db.execute(stmt)
    quiz = res.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")
    return quiz


@router.put("/quizzes/{quiz_id}")
async def update_quiz(quiz_id: int, data: QuizUpdate, db: AsyncSession = Depends(get_db)):
    quiz = (await db.execute(select(Quiz).where(Quiz.id == quiz_id))).scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    if data.title is not None:
        quiz.title = data.title
    if data.description is not None:
        quiz.description = data.description
    if data.passing_percentage is not None:
        quiz.passing_percentage = data.passing_percentage
    if data.max_attempts is not None:
        quiz.max_attempts = data.max_attempts
    if data.randomize_questions is not None:
        quiz.randomize_questions = data.randomize_questions

    await db.commit()
    await db.refresh(quiz)
    return quiz


@router.delete("/quizzes/{quiz_id}")
async def delete_quiz(quiz_id: int, db: AsyncSession = Depends(get_db)):
    quiz = (await db.execute(select(Quiz).where(Quiz.id == quiz_id))).scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    # Delete quiz questions and options
    questions = (await db.execute(select(Question).where(Question.quiz_id == quiz_id))).scalars().all()
    for q in questions:
        opts = (await db.execute(select(QuizOption).where(QuizOption.question_id == q.id))).scalars().all()
        for opt in opts:
            await db.delete(opt)
        await db.delete(q)

    # Delete quiz attempts
    attempts = (await db.execute(select(QuizAttempt).where(QuizAttempt.quiz_id == quiz_id))).scalars().all()
    for a in attempts:
        await db.delete(a)

    await db.delete(quiz)
    await db.commit()
    return {"message": "Quiz deleted"}


@router.post("/quizzes/{quiz_id}/questions")
async def add_question(
    quiz_id: int,
    data: QuestionCreate,
    db: AsyncSession = Depends(get_db),
):
    quiz = (await db.execute(select(Quiz).where(Quiz.id == quiz_id))).scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Quiz not found")

    q_type = QuestionType.MCQ if data.question_type == "MCQ" else QuestionType.TRUE_FALSE

    question = Question(
        quiz_id=quiz_id,
        question_text=data.question_text,
        question_type=q_type,
        marks=data.marks or 1.0,
        order_index=data.order_index or 0,
        explanation=data.explanation,
    )
    db.add(question)
    await db.flush()

    for idx, opt in enumerate(data.options):
        option = QuizOption(
            question_id=question.id,
            option_text=opt.option_text,
            is_correct=opt.is_correct,
            order_index=opt.order_index if opt.order_index is not None else idx,
        )
        db.add(option)

    await db.commit()
    await db.refresh(question)
    return question


@router.get("/questions/{question_id}")
async def get_question(question_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.options))
    )
    res = await db.execute(stmt)
    q = res.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return q


@router.put("/questions/{question_id}")
async def update_question(question_id: int, data: QuestionUpdate, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Question)
        .where(Question.id == question_id)
        .options(selectinload(Question.options))
    )
    res = await db.execute(stmt)
    question = res.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    if data.question_text is not None:
        question.question_text = data.question_text
    if data.question_type is not None:
        question.question_type = QuestionType.MCQ if data.question_type == "MCQ" else QuestionType.TRUE_FALSE
    if data.marks is not None:
        question.marks = data.marks
    if data.order_index is not None:
        question.order_index = data.order_index
    if data.explanation is not None:
        question.explanation = data.explanation

    if data.options is not None:
        # Remove old options
        for old_opt in question.options:
            await db.delete(old_opt)
        await db.flush()

        for idx, opt in enumerate(data.options):
            new_opt = QuizOption(
                question_id=question.id,
                option_text=opt.option_text,
                is_correct=opt.is_correct,
                order_index=opt.order_index if opt.order_index is not None else idx,
            )
            db.add(new_opt)

    await db.commit()
    await db.refresh(question)
    return question


@router.delete("/questions/{question_id}")
async def delete_question(question_id: int, db: AsyncSession = Depends(get_db)):
    q = (await db.execute(select(Question).where(Question.id == question_id))).scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    # Delete options
    opts = (await db.execute(select(QuizOption).where(QuizOption.question_id == question_id))).scalars().all()
    for opt in opts:
        await db.delete(opt)
    await db.delete(q)
    await db.commit()
    return {"message": "Question deleted"}


# ─── Student Management ──────────────────────────────────────────────────────

@router.get("/students")
async def list_students(
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Student)
        .options(
            selectinload(Student.enrollments),
            selectinload(Student.certificates),
        )
        .order_by(Student.created_at.desc())
    )
    if search:
        s = f"%{search}%"
        stmt = stmt.where(
            or_(
                Student.full_name.ilike(s),
                Student.enrollment_number.ilike(s),
                Student.email.ilike(s),
            )
        )
    res = await db.execute(stmt)
    students = res.scalars().all()

    return [
        {
            "id": s.id,
            "user_id": s.user_id,
            "full_name": s.full_name,
            "enrollment_number": s.enrollment_number,
            "email": s.email,
            "department": s.department,
            "program": s.program,
            "semester": s.semester,
            "academic_year": s.academic_year,
            "created_at": s.created_at,
            "enrolled_count": len(s.enrollments),
            "certificates_count": len(s.certificates),
        }
        for s in students
    ]


@router.get("/students/{student_id}")
async def get_student_detail(student_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Student)
        .where(Student.id == student_id)
        .options(
            selectinload(Student.enrollments).selectinload(Enrollment.course),
            selectinload(Student.certificates).selectinload(Certificate.course),
            selectinload(Student.quiz_attempts).selectinload(QuizAttempt.quiz),
        )
    )
    res = await db.execute(stmt)
    student = res.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return {
        "id": student.id,
        "user_id": student.user_id,
        "full_name": student.full_name,
        "enrollment_number": student.enrollment_number,
        "email": student.email,
        "department": student.department,
        "program": student.program,
        "semester": student.semester,
        "academic_year": student.academic_year,
        "created_at": student.created_at,
        "enrollments": [
            {
                "id": e.id,
                "course_id": e.course_id,
                "course_title": e.course.title if e.course else "Unknown",
                "status": e.status.value if hasattr(e.status, "value") else str(e.status),
                "progress_percentage": e.progress_percentage,
                "enrolled_at": e.enrolled_at,
                "completed_at": e.completed_at,
            }
            for e in student.enrollments
        ],
        "certificates": [
            {
                "id": c.id,
                "certificate_number": c.certificate_number,
                "course_title": c.course.title if c.course else "Course",
                "issued_at": c.issued_at.strftime("%d %B %Y"),
                "is_revoked": c.is_revoked,
            }
            for c in student.certificates
        ],
        "quiz_attempts": [
            {
                "id": a.id,
                "quiz_title": a.quiz.title if a.quiz else "Quiz",
                "attempt_number": a.attempt_number,
                "score": a.score,
                "total_marks": a.total_marks,
                "percentage": a.percentage,
                "passed": a.passed,
                "submitted_at": a.submitted_at,
            }
            for a in student.quiz_attempts
        ],
    }


@router.post("/students")
async def create_student(data: StudentCreate, db: AsyncSession = Depends(get_db)):
    # Check duplicate enrollment number
    exist_stud = await db.execute(
        select(Student).where(Student.enrollment_number == data.enrollment_number)
    )
    if exist_stud.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Enrollment number already exists")

    # Check duplicate user
    exist_user = await db.execute(
        select(User).where(User.username == data.enrollment_number)
    )
    if exist_user.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already exists")

    # Create User
    user = User(
        username=data.enrollment_number,
        password_hash=hash_password(data.password),
        role=UserRole.STUDENT,
        is_active=True,
    )
    db.add(user)
    await db.flush()

    # Create Student
    student = Student(
        user_id=user.id,
        full_name=data.full_name,
        enrollment_number=data.enrollment_number,
        email=data.email,
        department=data.department or "Electronics and Communication Engineering",
        program=data.program,
        semester=data.semester,
        academic_year=data.academic_year,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


@router.put("/students/{student_id}")
async def update_student(
    student_id: int,
    data: StudentUpdate,
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if data.full_name is not None:
        student.full_name = data.full_name
    if data.email is not None:
        student.email = data.email
    if data.department is not None:
        student.department = data.department
    if data.program is not None:
        student.program = data.program
    if data.semester is not None:
        student.semester = data.semester
    if data.academic_year is not None:
        student.academic_year = data.academic_year

    await db.commit()
    await db.refresh(student)
    return student


@router.delete("/students/{student_id}")
async def delete_student(student_id: int, db: AsyncSession = Depends(get_db)):
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    user_id = student.user_id

    # Cascade delete enrollments
    enrs = (await db.execute(select(Enrollment).where(Enrollment.student_id == student_id))).scalars().all()
    for e in enrs:
        await db.delete(e)

    # Cascade delete certificates
    certs = (await db.execute(select(Certificate).where(Certificate.student_id == student_id))).scalars().all()
    for c in certs:
        await db.delete(c)

    # Cascade delete quiz attempts
    qas = (await db.execute(select(QuizAttempt).where(QuizAttempt.student_id == student_id))).scalars().all()
    for qa in qas:
        await db.delete(qa)

    # Cascade delete lecture progress
    lps = (await db.execute(select(LectureProgress).where(LectureProgress.student_id == student_id))).scalars().all()
    for lp in lps:
        await db.delete(lp)

    await db.delete(student)

    # Delete User account
    if user_id:
        usr = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
        if usr:
            await db.delete(usr)

    await db.commit()
    return {"message": "Student and associated account deleted successfully"}


# ─── Enrollment Management ───────────────────────────────────────────────────

@router.post("/students/{student_id}/enroll")
async def admin_enroll_student(
    student_id: int,
    data: AdminEnrollRequest,
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = (await db.execute(select(Course).where(Course.id == data.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Check if already enrolled
    exist = (
        await db.execute(
            select(Enrollment).where(
                and_(Enrollment.student_id == student_id, Enrollment.course_id == data.course_id)
            )
        )
    ).scalar_one_or_none()
    if exist:
        raise HTTPException(status_code=400, detail="Student is already enrolled in this course")

    enr = Enrollment(
        student_id=student_id,
        course_id=data.course_id,
        status=EnrollmentStatus.ENROLLED,
        progress_percentage=0.0,
    )
    db.add(enr)
    await db.commit()
    await db.refresh(enr)
    return enr


@router.put("/enrollments/{enrollment_id}")
async def update_enrollment(
    enrollment_id: int,
    data: AdminEnrollmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    enr = (await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))).scalar_one_or_none()
    if not enr:
        raise HTTPException(status_code=404, detail="Enrollment not found")

    if data.status is not None:
        try:
            enr.status = EnrollmentStatus(data.status)
            if enr.status == EnrollmentStatus.COMPLETED and not enr.completed_at:
                enr.completed_at = datetime.utcnow()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid enrollment status")

    if data.progress_percentage is not None:
        enr.progress_percentage = min(100.0, max(0.0, float(data.progress_percentage)))

    await db.commit()
    await db.refresh(enr)
    return enr


@router.delete("/enrollments/{enrollment_id}")
async def delete_enrollment(enrollment_id: int, db: AsyncSession = Depends(get_db)):
    enr = (await db.execute(select(Enrollment).where(Enrollment.id == enrollment_id))).scalar_one_or_none()
    if not enr:
        raise HTTPException(status_code=404, detail="Enrollment not found")
    await db.delete(enr)
    await db.commit()
    return {"message": "Enrollment removed successfully"}


@router.post("/students/{student_id}/reset-password")
async def reset_student_password(
    student_id: int,
    data: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    user = (await db.execute(select(User).where(User.id == student.user_id))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user.password_hash = hash_password(data.new_password)
    await db.commit()
    return {"message": "Password reset successfully"}


@router.post("/students/import-csv")
async def import_students_csv(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    """CSV Import supporting: full_name, enrollment_number, password, email, semester, academic_year."""
    content = await file.read()
    decoded = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(decoded))

    created = 0
    errors = []

    for row_idx, row in enumerate(reader, start=2):
        name = row.get("full_name") or row.get("name")
        enr = row.get("enrollment_number") or row.get("enrollment")
        pwd = row.get("password") or "Medicaps@123"
        email = row.get("email")
        sem = row.get("semester")

        if not name or not enr:
            errors.append(f"Row {row_idx}: Missing full_name or enrollment_number")
            continue

        # Check existing
        existing = await db.execute(select(Student).where(Student.enrollment_number == enr))
        if existing.scalar_one_or_none():
            errors.append(f"Row {row_idx}: Enrollment {enr} already exists")
            continue

        try:
            user = User(
                username=enr,
                password_hash=hash_password(pwd),
                role=UserRole.STUDENT,
                is_active=True,
            )
            db.add(user)
            await db.flush()

            student = Student(
                user_id=user.id,
                full_name=name,
                enrollment_number=enr,
                email=email,
                department=row.get("department", "Electronics and Communication Engineering"),
                program=row.get("program", "B.Tech ECE"),
                semester=int(sem) if sem and sem.isdigit() else None,
                academic_year=row.get("academic_year", "2026-2027"),
            )
            db.add(student)
            created += 1
        except Exception as e:
            errors.append(f"Row {row_idx}: Failed to add - {str(e)}")

    await db.commit()
    return {"created_count": created, "errors": errors}


# ─── Certificate Revocation & Listing ────────────────────────────────────────

@router.get("/certificates")
async def list_all_certificates(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Certificate)
        .options(selectinload(Certificate.student), selectinload(Certificate.course))
        .order_by(Certificate.issued_at.desc())
    )
    res = await db.execute(stmt)
    certs = res.scalars().all()

    return [
        {
            "id": c.id,
            "certificate_number": c.certificate_number,
            "student_name": c.student.full_name if c.student else "Student",
            "enrollment_number": c.student.enrollment_number if c.student else "N/A",
            "course_title": c.course.title if c.course else "Course",
            "issued_at": c.issued_at.strftime("%d %B %Y"),
            "is_revoked": c.is_revoked,
            "revoked_at": c.revoked_at.strftime("%d %B %Y") if c.revoked_at else None,
        }
        for c in certs
    ]


@router.post("/certificates/{certificate_id}/revoke")
async def toggle_revoke_certificate(certificate_id: int, db: AsyncSession = Depends(get_db)):
    cert = (await db.execute(select(Certificate).where(Certificate.id == certificate_id))).scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    cert.is_revoked = not cert.is_revoked
    cert.revoked_at = datetime.utcnow() if cert.is_revoked else None
    await db.commit()
    await db.refresh(cert)

    return {
        "message": f"Certificate {'revoked' if cert.is_revoked else 'restored'} successfully",
        "is_revoked": cert.is_revoked,
    }


@router.post("/certificates/issue")
async def admin_issue_certificate(
    data: AdminIssueCertificateRequest,
    db: AsyncSession = Depends(get_db),
):
    student = (await db.execute(select(Student).where(Student.id == data.student_id))).scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    course = (await db.execute(select(Course).where(Course.id == data.course_id))).scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    from app.services.certificate_service import CertificateService
    cert = await CertificateService.issue_certificate(db, student.id, course.id)
    if not cert:
        raise HTTPException(status_code=500, detail="Failed to issue certificate")

    return {
        "message": "Certificate issued successfully",
        "certificate_id": cert.id,
        "certificate_number": cert.certificate_number,
    }


@router.delete("/certificates/{certificate_id}")
async def delete_certificate(certificate_id: int, db: AsyncSession = Depends(get_db)):
    cert = (await db.execute(select(Certificate).where(Certificate.id == certificate_id))).scalar_one_or_none()
    if not cert:
        raise HTTPException(status_code=404, detail="Certificate not found")

    await db.delete(cert)
    await db.commit()
    return {"message": "Certificate deleted successfully"}
