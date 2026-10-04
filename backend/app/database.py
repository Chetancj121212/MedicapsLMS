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
        from app.models import user, student, course, module, lecture, quiz, question, enrollment, progress, certificate, audit
        await conn.run_sync(Base.metadata.create_all)

        if conn.dialect.name == "sqlite":
            certificate_schema = await conn.execute(
                text(
                    "SELECT sql FROM sqlite_master "
                    "WHERE type = 'table' AND name = 'certificates'"
                )
            )
            schema_sql = certificate_schema.scalar() or ""
            normalized_schema = schema_sql.replace(" ", "").replace("\n", "")
            if "UNIQUE(student_id,course_id)" in normalized_schema:
                await conn.execute(text("ALTER TABLE certificates RENAME TO certificates_old"))
                await conn.execute(
                    text(
                        "CREATE TABLE certificates ("
                        "id INTEGER NOT NULL PRIMARY KEY, "
                        "certificate_number VARCHAR(50) NOT NULL UNIQUE, "
                        "student_id INTEGER NOT NULL, "
                        "course_id INTEGER NOT NULL, "
                        "issued_at DATETIME NOT NULL, "
                        "certificate_file VARCHAR(500), "
                        "is_revoked BOOLEAN NOT NULL, "
                        "revoked_at DATETIME, "
                        "FOREIGN KEY(student_id) REFERENCES students (id), "
                        "FOREIGN KEY(course_id) REFERENCES courses (id)"
                        ")"
                    )
                )
                await conn.execute(
                    text(
                        "INSERT INTO certificates "
                        "(id, certificate_number, student_id, course_id, issued_at, "
                        "certificate_file, is_revoked, revoked_at) "
                        "SELECT id, certificate_number, student_id, course_id, issued_at, "
                        "certificate_file, is_revoked, revoked_at "
                        "FROM certificates_old"
                    )
                )
                await conn.execute(text("DROP TABLE certificates_old"))

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

        user_migrations = {
            "full_name": "VARCHAR(200)",
            "email": "VARCHAR(320)",
            "department": "VARCHAR(200)",
        }
        for column, definition in user_migrations.items():
            try:
                await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {definition}"))
            except Exception:
                pass

