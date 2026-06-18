import logging
from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from app.db.database import Base, engine, db_status, SessionLocal, migrate_candidate_email_non_unique
from app.db.qdrant_client import qdrant_manager, vector_status
from app.db.redis_client import redis_manager, cache_status
from app.services.llm_service import llm_status
from app.db.models import Candidate, Job, GraphNode, GraphEdge, AuditLog
from app.api import jobs, candidates, rank, copilot, team, auth, audit, intelligence
from app.db.seed import seed_data
from app.core.rate_limit import RateLimitMiddleware
from app.core.security_headers import SecurityHeadersMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Candidate Intelligence & Ranking API",
    description="Enterprise AI recruiter using twin graphs and resilient multi-stage evaluation pipelines.",
    version="1.0.0"
)

# Set up CORS middleware (Strict Allowed Origins)
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register rate limiter and security headers
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)


# Startup event
@app.on_event("startup")
def startup_event():
    logger.info("Starting up Candidate Intelligence & Ranking Platform...")
    
    # Initialize SQL Database Tables
    Base.metadata.create_all(bind=engine)
    migrate_candidate_email_non_unique(engine)
    logger.info("Database tables initialized.")

    # 1. Trigger pings to check actual external status and set status dicts
    qdrant_manager.ping()
    redis_manager.ping()

    # 2. Check if database is empty and auto-seed it if needed
    db = SessionLocal()
    candidates_count = 0
    jobs_count = 0
    try:
        candidates_count = db.query(Candidate).count()
        jobs_count = db.query(Job).count()
        if candidates_count == 0:
            logger.info("No candidates found in database. Running auto-seeding...")
            seed_data()
            candidates_count = db.query(Candidate).count()
            jobs_count = db.query(Job).count()
            logger.info("Automatic database seeding completed.")
    except Exception as e:
        logger.error(f"Error during auto-seeding check: {e}")
    finally:
        db.close()

    # 3. Print Infrastructure Report
    is_fallback = (db_status["status"] == "fallback" or 
                   cache_status["status"] == "fallback" or 
                   vector_status["status"] == "fallback" or
                   llm_status["status"] == "unavailable")
    mode_str = "Fallback (Resilient Degraded)" if is_fallback else "Live (Production Grid)"

    logger.info("\n" + "=" * 60)
    logger.info("SYSTEM INFRASTRUCTURE STATUS REPORT")
    logger.info("-" * 60)
    logger.info(f"Execution Mode:     {mode_str}")
    logger.info(f"Database Layer:     {db_status['type'].upper()} ({db_status['status']})")
    logger.info(f"Caching Layer:      {cache_status['type'].upper()} ({cache_status['status']})")
    logger.info(f"Vector Store:       {vector_status['type'].upper()} ({vector_status['status']})")
    logger.info(f"Gemini LLM:         {llm_status['provider'].upper()} ({llm_status['status']})")
    logger.info(f"Seeded Jobs:        {jobs_count}")
    logger.info(f"Seeded Candidates:  {candidates_count}")
    logger.info("=" * 60 + "\n")

# Register Routers
app.include_router(auth.router)
app.include_router(audit.router)
app.include_router(jobs.router)
app.include_router(candidates.router)
app.include_router(rank.router)
app.include_router(copilot.router)
app.include_router(team.router)
app.include_router(intelligence.router)

@app.get("/health")
def legacy_health_check():
    return {
        "status": "healthy",
        "postgres": "connected" if db_status["type"] == "postgresql" else "offline",
        "qdrant": "connected" if vector_status["type"] == "qdrant" else "offline",
        "redis": "connected" if cache_status["type"] == "redis" else "offline"
    }

@app.get("/api/health")
def api_health():
    qdrant_manager.ping()
    redis_manager.ping()
    is_fallback = (db_status["status"] == "fallback" or 
                   cache_status["status"] == "fallback" or 
                   vector_status["status"] == "fallback" or
                   llm_status["status"] == "unavailable")
    return {
        "status": "healthy" if not is_fallback else "degraded",
        "mode": "fallback" if is_fallback else "live",
        "database": db_status,
        "cache": cache_status,
        "vector_db": vector_status,
        "llm": llm_status
    }

@app.get("/api/system/status")
def get_system_status():
    qdrant_manager.ping()
    redis_manager.ping()
    
    db = SessionLocal()
    candidates_count = 0
    jobs_count = 0
    nodes_count = 0
    edges_count = 0
    ranking_runs = 0
    audit_events = 0
    embeddings_count = 0
    try:
        candidates_count = db.query(Candidate).count()
        jobs_count = db.query(Job).count()
        nodes_count = db.query(GraphNode).count()
        edges_count = db.query(GraphEdge).count()
        ranking_runs = db.query(AuditLog).filter(AuditLog.action.in_(["RANK_COMPUTATION", "RANK_CANDIDATES"])).count()
        audit_events = db.query(AuditLog).count()
        
        # Calculate embeddings count
        if not qdrant_manager._use_fallback:
            try:
                # Get points count from candidates collection
                res = qdrant_manager.client.get_collection(qdrant_manager.collection_name)
                embeddings_count = res.points_count
            except Exception:
                embeddings_count = candidates_count
        else:
            embeddings_count = len(qdrant_manager._local_index.id_to_vector)
            if embeddings_count == 0:
                embeddings_count = candidates_count
    except Exception as e:
        logger.error(f"Error querying system status counts: {e}")
    finally:
        db.close()
        
    is_fallback = (db_status["status"] == "fallback" or 
                   cache_status["status"] == "fallback" or 
                   vector_status["status"] == "fallback" or
                   llm_status["status"] == "unavailable")
    
    return {
        "mode": "fallback" if is_fallback else "live",
        "database": db_status["type"],
        "cache": cache_status["type"],
        "vector": vector_status["type"],
        "llm": "connected" if llm_status["status"] == "connected" else "unavailable",
        "candidates": candidates_count,
        "jobs": jobs_count,
        "rankings": max(1, ranking_runs),  # Return at least 1 for display if 0, or raw counts
        "embeddings": embeddings_count,
        "candidates_stored": candidates_count,
        "jobs_stored": jobs_count,
        "embeddings_stored": embeddings_count,
        "ranking_runs": ranking_runs,
        "knowledge_graph_nodes": nodes_count,
        "knowledge_graph_edges": edges_count,
        "audit_events": audit_events
    }

from app.core.auth import require_role
from app.core.audit import log_audit_event
from app.db.models import User
from app.db.database import get_db

@app.post("/api/seed-db")
def trigger_db_seeding(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    """Resets the SQL and Qdrant databases and seeds them with high quality default data (Admin only)."""
    client_ip = request.client.host if request.client else "unknown"
    try:
        seed_data()
        log_audit_event(
            db=db,
            action="DATABASE_SEED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"status": "success"}
        )
        return {"status": "success", "message": "Database and collections reset and seeded successfully!"}
    except Exception as e:
        logger.error(f"Error seeding database: {e}")
        log_audit_event(
            db=db,
            action="DATABASE_SEED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"status": "error", "message": str(e)}
        )
        return {"status": "error", "message": str(e)}


