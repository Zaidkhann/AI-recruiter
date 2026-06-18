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

