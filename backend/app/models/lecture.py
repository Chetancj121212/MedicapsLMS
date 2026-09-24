"""Lecture model — video lectures within modules."""

from sqlalchemy import Column, Integer, String, Text, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


class Lecture(Base):
    __tablename__ = "lectures"

    id = Column(Integer, primary_key=True, index=True)
    module_id = Column(Integer, ForeignKey("modules.id"), nullable=False)
    title = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    video_path = Column(String(500), nullable=True)
    video_source_type = Column(String(20), nullable=True)
    video_source_url = Column(String(1000), nullable=True)
    video_id = Column(String(255), nullable=True)
    thumbnail = Column(String(500), nullable=True)
    duration = Column(Float, nullable=True)  # Duration in seconds
    order_index = Column(Integer, nullable=False, default=0)
    completion_threshold = Column(Float, default=90.0, nullable=False)  # Percentage
    is_required = Column(Boolean, default=True, nullable=False)
    is_published = Column(Boolean, default=True, nullable=False)

    # Relationships
    module = relationship("Module", back_populates="lectures")
    progress = relationship("LectureProgress", back_populates="lecture", cascade="all, delete-orphan")
