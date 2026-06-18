import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

logger = logging.getLogger(__name__)

db_status = {
    "type": "postgresql",
    "status": "connected"
}

def create_resilient_engine():
    database_url = settings.DATABASE_URL
    
    if database_url.startswith("postgresql"):
        try:
            # Create a temporary test engine with a short timeout to check connectivity
            logger.info("Attempting connection to PostgreSQL...")
            test_engine = create_engine(
                database_url,
                pool_pre_ping=True,
                connect_args={"connect_timeout": 3}
            )
            with test_engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Connection succeeded, build the production engine
            db_status["type"] = "postgresql"
            db_status["status"] = "connected"
            logger.info("Successfully connected to PostgreSQL database.")
            return create_engine(
                database_url,
                pool_size=20,
                max_overflow=10,
                pool_pre_ping=True
            )
        except Exception as e:
            logger.warning(f"Failed to connect to PostgreSQL: {e}. Falling back to SQLite.")
    
    # Fallback to local SQLite database
    db_status["type"] = "sqlite"
    db_status["status"] = "fallback"
    logger.info("Initializing SQLite database at sqlite:///./recruiter.db")
    return create_engine(
        "sqlite:///./recruiter.db",
        connect_args={"check_same_thread": False}
    )

engine = create_resilient_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate_candidate_email_non_unique(engine_instance):
    """
    Drop legacy unique constraint on candidates.email so re-uploads are allowed.
    Safe to run on every startup (no-ops when already migrated).
    """
    try:
        with engine_instance.begin() as conn:
            dialect = engine_instance.dialect.name
            if dialect == "postgresql":
                conn.execute(text("ALTER TABLE candidates DROP CONSTRAINT IF EXISTS candidates_email_key"))
                conn.execute(text("DROP INDEX IF EXISTS ix_candidates_email"))
                conn.execute(text("CREATE INDEX IF NOT EXISTS ix_candidates_email ON candidates (email)"))
            elif dialect == "sqlite":
                table_sql = conn.execute(
                    text("SELECT sql FROM sqlite_master WHERE type='table' AND name='candidates'")
                ).scalar()
                if table_sql and "UNIQUE" in table_sql.upper() and "email" in table_sql.lower():
                    logger.warning(
                        "SQLite candidates table still has email UNIQUE. "
                        "Use Admin 'Reset & Seed Data' once to rebuild schema, or delete recruiter.db."
                    )
        logger.info("Candidate email uniqueness migration complete.")
    except Exception as e:
        logger.warning(f"Candidate email uniqueness migration skipped: {e}")

