import asyncio
import logging
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import settings

logger = logging.getLogger("lms.database")

engine_kwargs = {
    "echo": False,
    "future": True,
}

if settings.database_url.startswith("postgresql"):
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_size": 10,
        "max_overflow": 20,
        "pool_recycle": 1800,  # Recycle connections idle for 30 minutes
        "pool_timeout": 30,     # Wait up to 30s for connection from pool
        "connect_args": {
            "command_timeout": 60,
            "server_settings": {
                "application_name": "medicaps_lms",
            },
        },
    })

engine = create_async_engine(
    settings.database_url,
    **engine_kwargs,
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
            if session.is_active:
                await session.commit()
        except Exception:
            if session.is_active:
                try:
                    await session.rollback()
                except Exception as rb_exc:
                    logger.warning(f"Error during database rollback: {rb_exc}")
            raise
        finally:
            await session.close()


async def check_database_health() -> bool:
    """Fast probe to verify database connectivity."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return True
    except Exception as exc:
        logger.warning(f"Database health check probe failed: {exc}")
        return False


async def init_db(max_retries: int = 5, retry_interval: float = 2.0):
    """Create all tables and run backward-compatible schema migrations with retry logic."""
    sanitized_url = settings.database_url.split("@")[-1] if "@" in settings.database_url else settings.database_url
    logger.info(f"Connecting to database ({sanitized_url})...")

    attempt = 0
    while attempt < max_retries:
        attempt += 1
        try:
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

                    sqlite_lecture_progress = {
                        "watched_segments": "TEXT DEFAULT '[]'",
                        "youtube_play_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
                        "video_play_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
                        "active_screen_time_seconds": "FLOAT DEFAULT 0 NOT NULL",
                        "last_activity_at": "DATETIME",
                    }
                    for column, definition in sqlite_lecture_progress.items():
                        try:
                            await conn.execute(text(f"ALTER TABLE lecture_progress ADD COLUMN {column} {definition}"))
                        except Exception:
                            pass

                    sqlite_lectures = {
                        "video_source_type": "VARCHAR(20)",
                        "video_source_url": "VARCHAR(1000)",
                        "video_id": "VARCHAR(255)",
                    }
                    for column, definition in sqlite_lectures.items():
                        try:
                            await conn.execute(text(f"ALTER TABLE lectures ADD COLUMN {column} {definition}"))
                        except Exception:
                            pass

                    sqlite_users = {
                        "full_name": "VARCHAR(200)",
                        "email": "VARCHAR(320)",
                        "department": "VARCHAR(200)",
                    }
                    for column, definition in sqlite_users.items():
                        try:
                            await conn.execute(text(f"ALTER TABLE users ADD COLUMN {column} {definition}"))
                        except Exception:
                            pass

                elif conn.dialect.name == "postgresql":
                    # Safe idempotent column additions for PostgreSQL
                    pg_migrations = [
                        "ALTER TABLE lecture_progress ADD COLUMN IF NOT EXISTS watched_segments TEXT DEFAULT '[]'",
                        "ALTER TABLE lecture_progress ADD COLUMN IF NOT EXISTS youtube_play_time_seconds DOUBLE PRECISION DEFAULT 0 NOT NULL",
                        "ALTER TABLE lecture_progress ADD COLUMN IF NOT EXISTS video_play_time_seconds DOUBLE PRECISION DEFAULT 0 NOT NULL",
                        "ALTER TABLE lecture_progress ADD COLUMN IF NOT EXISTS active_screen_time_seconds DOUBLE PRECISION DEFAULT 0 NOT NULL",
                        "ALTER TABLE lecture_progress ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP",
                        "ALTER TABLE lectures ADD COLUMN IF NOT EXISTS video_source_type VARCHAR(20)",
                        "ALTER TABLE lectures ADD COLUMN IF NOT EXISTS video_source_url VARCHAR(1000)",
                        "ALTER TABLE lectures ADD COLUMN IF NOT EXISTS video_id VARCHAR(255)",
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name VARCHAR(200)",
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(320)",
                        "ALTER TABLE users ADD COLUMN IF NOT EXISTS department VARCHAR(200)",
                    ]
                    for stmt in pg_migrations:
                        try:
                            await conn.execute(text(stmt))
                        except Exception as migration_exc:
                            logger.debug(f"PostgreSQL migration notice: {migration_exc}")

            logger.info("Database tables initialized successfully.")
            return

        except Exception as exc:
            if attempt < max_retries:
                logger.warning(
                    f"Database initialization attempt {attempt}/{max_retries} failed ({sanitized_url}): {exc}. "
                    f"Retrying in {retry_interval}s..."
                )
                await asyncio.sleep(retry_interval)
                retry_interval *= 1.5
            else:
                logger.error(
                    f"Failed to connect to or initialize database after {max_retries} attempts ({sanitized_url}): {exc}",
                    exc_info=True
                )
                raise
