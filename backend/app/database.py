"""Database engine, session factory, and base model."""

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    """Dependency that yields a database session."""
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


from sqlalchemy import text


async def init_db():
    """Create all tables and run backward-compatible schema migrations."""
    async with engine.begin() as conn:
        from app.models import user, student, course, module, lecture, quiz, question, enrollment, progress, certificate
        await conn.run_sync(Base.metadata.create_all)

        migrations = {
            "watched_segments": "TEXT DEFAULT '[]'",
            "youtube_play_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
            "video_play_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
            "active_screen_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
            "last_activity_at": "DATETIME",
        }
        for column, definition in migrations.items():
            try:
                await conn.execute(text(f"ALTER TABLE lecture_progress ADD COLUMN {column} {definition}"))
            except Exception:
                pass

        lecture_migrations = {
            "video_source_type": "VARCHAR(20)",
            "video_source_url": "VARCHAR(1000)",
            "video_id": "VARCHAR(255)",
        }
        for column, definition in lecture_migrations.items():
            try:
                await conn.execute(text(f"ALTER TABLE lectures ADD COLUMN {column} {definition}"))
            except Exception:
                pass

