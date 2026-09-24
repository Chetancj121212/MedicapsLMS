"""Question and QuizOption models."""

import enum
from sqlalchemy import Column, Integer, String, Text, Boolean, Float, Enum, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class QuestionType(str, enum.Enum):
    MCQ = "MCQ"
    TRUE_FALSE = "TRUE_FALSE"


class Question(Base):
    __tablename__ = "questions"

    id = Column(Integer, primary_key=True, index=True)
    quiz_id = Column(Integer, ForeignKey("quizzes.id"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(Enum(QuestionType), nullable=False, default=QuestionType.MCQ)
    marks = Column(Float, default=1.0, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)
    explanation = Column(Text, nullable=True)  # Shown as hint after failure

    # Relationships
    quiz = relationship("Quiz", back_populates="questions")
    options = relationship("QuizOption", back_populates="question", cascade="all, delete-orphan", order_by="QuizOption.order_index")


class QuizOption(Base):
    __tablename__ = "quiz_options"

    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey("questions.id"), nullable=False)
    option_text = Column(String(500), nullable=False)
    is_correct = Column(Boolean, default=False, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)

    # Relationships
    question = relationship("Question", back_populates="options")
