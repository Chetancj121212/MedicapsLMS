"""Progress tracking models — lecture progress and quiz attempts."""

from datetime import datetime
from sqlalchemy import Column, Integer, Float, Boolean, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from app.database import Base


class LectureProgress(Base):
    __tablename__ = "lecture_progress"
    __table_args__ = (
        UniqueConstraint("student_id", "lecture_id", name="uq_student_lecture"),
    )

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    lecture_id = Column(Integer, ForeignKey("lectures.id"), nullable=False)
    watched_seconds = Column(Float, default=0.0, nullable=False)
    youtube_play_time_seconds = Column(Float, default=0.0, nullable=False)
    video_play_time_seconds = Column(Float, default=0.0, nullable=False)
    watched_segments = Column(Text, nullable=True, default="[]")
    completion_percentage = Column(Float, default=0.0, nullable=False)
    last_position_seconds = Column(Float, default=0.0, nullable=False)
    active_screen_time_seconds = Column(Float, default=0.0, nullable=False)
    last_activity_at = Column(DateTime, nullable=True)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    last_watched_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    student = relationship("Student", back_populates="lecture_progress")
    lecture = relationship("Lecture", back_populates="progress")


class QuizAttempt(Base):
    __tablename__ = "quiz_attempts"

    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(Integer, ForeignKey("students.id"), nullable=False)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    attempt_number = Column(Integer, nullable=False)
    score = Column(Float, default=0.0, nullable=False)
    total_marks = Column(Float, default=0.0, nullable=False)
    percentage = Column(Float, default=0.0, nullable=False)
    passed = Column(Boolean, default=False, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    submitted_at = Column(DateTime, nullable=True)

    # Relationships
    student = relationship("Student", back_populates="quiz_attempts")
    quiz = relationship("Quiz", back_populates="attempts")
    answers = relationship("QuizAnswer", back_populates="attempt", cascade="all, delete-orphan")


class QuizAnswer(Base):
    __tablename__ = "quiz_answers"

    id = Column(Integer, primary_key=True, index=True)
    attempt_id = Column(Integer, ForeignKey("quiz_attempts.id"), nullable=False)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    selected_option_id = Column(Integer, ForeignKey("quiz_options.id"), nullable=True)
    is_correct = Column(Boolean, default=False, nullable=False)
    marks_awarded = Column(Float, default=0.0, nullable=False)

    # Relationships
    attempt = relationship("QuizAttempt", back_populates="answers")
