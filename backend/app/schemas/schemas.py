"""Pydantic schemas for all API request/response models."""

import json
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ─── Auth ────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    role: str
    user_id: int


class UserResponse(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool

    class Config:
        from_attributes = True


# ─── Student ─────────────────────────────────────────────────────────────────

class StudentCreate(BaseModel):
    full_name: str
    enrollment_number: str
    password: str
    email: Optional[str] = None
    department: Optional[str] = "Electronics and Communication Engineering"
    program: Optional[str] = None
    semester: Optional[int] = None
    academic_year: Optional[str] = None


class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    department: Optional[str] = None
    program: Optional[str] = None
    semester: Optional[int] = None
    academic_year: Optional[str] = None


class StudentResponse(BaseModel):
    id: int
    user_id: int
    full_name: str
    enrollment_number: str
    email: Optional[str] = None
    department: Optional[str] = None
    program: Optional[str] = None
    semester: Optional[int] = None
    academic_year: Optional[str] = None
    profile_photo: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ResetPasswordRequest(BaseModel):
    new_password: str


# ─── Course ──────────────────────────────────────────────────────────────────

class CourseCreate(BaseModel):
    course_code: str
    title: str
    short_description: Optional[str] = None
    description: Optional[str] = None
    instructor_name: Optional[str] = None
    estimated_duration: Optional[str] = None


class CourseUpdate(BaseModel):
    course_code: Optional[str] = None
    title: Optional[str] = None
    short_description: Optional[str] = None
    description: Optional[str] = None
    instructor_name: Optional[str] = None
    estimated_duration: Optional[str] = None
    status: Optional[str] = None


class LectureResponse(BaseModel):
    id: int
    module_id: int
    title: str
    description: Optional[str] = None
    video_path: Optional[str] = None
    video_source_type: Optional[str] = None
    video_source_url: Optional[str] = None
    video_id: Optional[str] = None
    thumbnail: Optional[str] = None
    duration: Optional[float] = None
    order_index: int
    completion_threshold: float
    is_required: bool
    is_published: bool

    class Config:
        from_attributes = True


class QuizBriefResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    passing_percentage: float
    max_attempts: Optional[int] = None
    is_required: bool
    is_published: bool
    is_final_assessment: bool
    order_index: int

    class Config:
        from_attributes = True


class ModuleResponse(BaseModel):
    id: int
    course_id: int
    title: str
    description: Optional[str] = None
    order_index: int
    is_required: bool
    lectures: List[LectureResponse] = []
    quizzes: List[QuizBriefResponse] = []

    class Config:
        from_attributes = True


class CourseResponse(BaseModel):
    id: int
    course_code: str
    title: str
    short_description: Optional[str] = None
    description: Optional[str] = None
    instructor_name: Optional[str] = None
    thumbnail: Optional[str] = None
    estimated_duration: Optional[str] = None
    status: str
    published_at: Optional[datetime] = None
    created_at: datetime
    modules: List[ModuleResponse] = []

    class Config:
        from_attributes = True


class CourseListResponse(BaseModel):
    id: int
    course_code: str
    title: str
    short_description: Optional[str] = None
    instructor_name: Optional[str] = None
    thumbnail: Optional[str] = None
    estimated_duration: Optional[str] = None
    status: str
    module_count: int = 0
    lecture_count: int = 0
    quiz_count: int = 0

    class Config:
        from_attributes = True


# ─── Module ──────────────────────────────────────────────────────────────────

class ModuleCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: Optional[int] = 0


class ModuleUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


# ─── Lecture ─────────────────────────────────────────────────────────────────

class LectureCreate(BaseModel):
    title: str
    description: Optional[str] = None
    order_index: Optional[int] = 0
    completion_threshold: Optional[float] = 90.0
    is_required: Optional[bool] = True


class LectureUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    duration: Optional[float] = None
    order_index: Optional[int] = None
    completion_threshold: Optional[float] = None
    is_required: Optional[bool] = None
    video_source_url: Optional[str] = None


# ─── Quiz ────────────────────────────────────────────────────────────────────

class QuizCreate(BaseModel):
    title: str
    description: Optional[str] = None
    passing_percentage: Optional[float] = 100.0
    max_attempts: Optional[int] = None
    randomize_questions: Optional[bool] = False
    is_final_assessment: Optional[bool] = False
    order_index: Optional[int] = 0


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    passing_percentage: Optional[float] = None
    max_attempts: Optional[int] = None
    randomize_questions: Optional[bool] = None


class OptionCreate(BaseModel):
    option_text: str
    is_correct: bool = False
    order_index: Optional[int] = 0


class QuestionCreate(BaseModel):
    question_text: str
    question_type: str = "MCQ"
    marks: Optional[float] = 1.0
    order_index: Optional[int] = 0
    explanation: Optional[str] = None
    options: List[OptionCreate] = []


class QuestionUpdate(BaseModel):
    question_text: Optional[str] = None
    question_type: Optional[str] = None
    marks: Optional[float] = None
    order_index: Optional[int] = None
    explanation: Optional[str] = None
    options: Optional[List[OptionCreate]] = None


class AdminEnrollRequest(BaseModel):
    course_id: int


class AdminEnrollmentUpdate(BaseModel):
    status: Optional[str] = None
    progress_percentage: Optional[float] = None


class AdminIssueCertificateRequest(BaseModel):
    student_id: int
    course_id: int


class OptionResponse(BaseModel):
    id: int
    option_text: str
    order_index: int

    class Config:
        from_attributes = True


class OptionWithAnswerResponse(OptionResponse):
    """Admin-only response that includes correct answer."""
    is_correct: bool


class QuestionResponse(BaseModel):
    id: int
    question_text: str
    question_type: str
    marks: float
    order_index: int
    options: List[OptionResponse] = []

    class Config:
        from_attributes = True


class QuestionWithAnswerResponse(BaseModel):
    """Admin-only response that includes correct answers and explanation."""
    id: int
    question_text: str
    question_type: str
    marks: float
    order_index: int
    explanation: Optional[str] = None
    options: List[OptionWithAnswerResponse] = []

    class Config:
        from_attributes = True


class QuizDetailResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    passing_percentage: float
    max_attempts: Optional[int] = None
    randomize_questions: bool
    is_final_assessment: bool
    questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True


class QuizAdminDetailResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    passing_percentage: float
    max_attempts: Optional[int] = None
    randomize_questions: bool
    is_final_assessment: bool
    questions: List[QuestionWithAnswerResponse] = []

    class Config:
        from_attributes = True


# ─── Quiz Submission ─────────────────────────────────────────────────────────

class QuizAnswerSubmit(BaseModel):
    question_id: int
    selected_option_id: int


class QuizSubmission(BaseModel):
    answers: List[QuizAnswerSubmit]


class QuizResultResponse(BaseModel):
    attempt_id: int
    attempt_number: int
    score: float
    total_marks: float
    percentage: float
    passed: bool
    hint: Optional[str] = None


class QuizAttemptResponse(BaseModel):
    id: int
    attempt_number: int
    score: float
    total_marks: float
    percentage: float
    passed: bool
    started_at: datetime
    submitted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Progress ────────────────────────────────────────────────────────────────

class LectureProgressUpdate(BaseModel):
    watched_seconds: Optional[float] = 0.0
    completion_percentage: Optional[float] = 0.0
    last_position_seconds: float = 0.0
    segments: Optional[List[List[float]]] = None
    duration: Optional[float] = None
    video_play_time_seconds: Optional[float] = 0.0
    active_screen_time_seconds: Optional[float] = 0.0
    last_activity_at: Optional[datetime] = None


class LectureProgressResponse(BaseModel):
    lecture_id: int
    watched_seconds: float
    completion_percentage: float
    last_position_seconds: float
    completed: bool
    completed_at: Optional[datetime] = None
    watched_segments: Optional[List[List[float]]] = None
    youtube_play_time_seconds: float = 0.0
    video_play_time_seconds: float = 0.0
    unique_watched_seconds: float = 0.0
    active_screen_time_seconds: float = 0.0
    last_activity_at: Optional[datetime] = None

    @field_validator("watched_segments", mode="before")
    @classmethod
    def parse_watched_segments(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v

    class Config:
        from_attributes = True


class EnrollmentResponse(BaseModel):
    id: int
    course_id: int
    course_title: Optional[str] = None
    course_code: Optional[str] = None
    status: str
    progress_percentage: float
    enrolled_at: datetime
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ─── Content Unlock Status ──────────────────────────────────────────────────

class ContentItemStatus(BaseModel):
    id: int
    type: str  # "lecture" or "quiz"
    title: str
    is_locked: bool
    is_completed: bool
    lock_reason: Optional[str] = None
    order_index: int


class ModuleStatusResponse(BaseModel):
    id: int
    title: str
    order_index: int
    is_locked: bool
    is_completed: bool
    lock_reason: Optional[str] = None
    items: List[ContentItemStatus] = []


class CourseProgressResponse(BaseModel):
    enrollment: EnrollmentResponse
    modules: List[ModuleStatusResponse] = []
    total_lectures: int = 0
    completed_lectures: int = 0
    current_module: Optional[str] = None
    current_item: Optional[str] = None


# ─── Certificate ─────────────────────────────────────────────────────────────

class CertificateResponse(BaseModel):
    id: int
    certificate_number: str
    student_name: str
    enrollment_number: str
    course_name: str
    issued_at: datetime
    certificate_file: Optional[str] = None
    is_revoked: bool

    class Config:
        from_attributes = True


class CertificateVerifyResponse(BaseModel):
    valid: bool
    certificate: Optional[dict] = None
    message: Optional[str] = None


# ─── Dashboard ───────────────────────────────────────────────────────────────

class StudentDashboardResponse(BaseModel):
    student: StudentResponse
    enrolled_courses: int = 0
    in_progress_courses: int = 0
    completed_courses: int = 0
    certificates_earned: int = 0
    enrollments: List[EnrollmentResponse] = []


class AdminDashboardResponse(BaseModel):
    total_students: int = 0
    total_courses: int = 0
    published_courses: int = 0
    certificates_issued: int = 0
    recent_activities: List[dict] = []
