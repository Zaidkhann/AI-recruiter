from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Job, Candidate, User
from app.services.ranking_engine import ranking_engine
from app.services.llm_service import llm_service
from pydantic import BaseModel, Field, field_validator
from app.core.auth import require_role
from app.core.audit import log_audit_event

router = APIRouter(prefix="/api/rank", tags=["Ranking"])

class RankQuery(BaseModel):
    job_id: int
    weights: dict[str, float] = Field(default=None)  # Optional custom slider weights
    benchmark_profile: str = Field(default=None)  # Optional benchmark overlay override
    semantic_threshold: float | None = Field(default=None, ge=0.0, le=1.0)
    overall_threshold: float | None = Field(default=None, ge=0.0, le=1.0)

    @field_validator("weights")
    @classmethod
    def validate_weights(cls, v):
        if v is not None:
            allowed_keys = {
                "semantic", "adjacency", "trajectory", "behavioral", "success", "learning", "market", "potential",
                "skill_transferability", "career_growth_momentum", "startup_readiness", "leadership_impact",
                "open_source_influence", "learning_agility", "domain_expertise", "team_complement_score",
                "retention_prediction", "interview_success_prediction"
            }
            for key, val in v.items():
                if key not in allowed_keys:
                    raise ValueError(f"Invalid weight factor: {key}")
                if not (0.0 <= val <= 1.0):
                    raise ValueError(f"Weight for factor '{key}' must be between 0.0 and 1.0")
        return v

@router.post("")
def rank_candidates(
    payload: RankQuery, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("viewer"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job description not found")

    # Apply benchmark override without mutating the persisted record
    if payload.benchmark_profile and payload.benchmark_profile != "DEFAULT":
        original_benchmark = job.benchmark_profile
        job.benchmark_profile = payload.benchmark_profile

    ranked_result = ranking_engine.rank_candidates(
        db,
        payload.job_id,
        payload.weights,
        semantic_threshold=payload.semantic_threshold,
        overall_threshold=payload.overall_threshold,
    )

    # Roll back any in-memory override to avoid accidental persistence
    if payload.benchmark_profile and payload.benchmark_profile != "DEFAULT":
        job.benchmark_profile = original_benchmark
        db.expire(job)

    # Log rank computation occasionally or only if weights are customized to avoid spamming
    if payload.weights:
        log_audit_event(
            db=db,
            action="RANK_COMPUTATION",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"job_id": payload.job_id, "weights": payload.weights, "benchmark_profile": payload.benchmark_profile}
        )

    return ranked_result

@router.get("/{job_id}/candidate/{candidate_id}/decision")
def get_candidate_decision(
    job_id: int, 
    candidate_id: int, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("viewer"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    job = db.query(Job).filter(Job.id == job_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    
    if not job or not candidate:
        raise HTTPException(status_code=404, detail="Job or Candidate not found")

    # Check if explanations/debates are already cached on Candidate for this job
    cache_key = f"job_{job_id}"
    cache = candidate.ranking_explanations or {}
    
    if cache_key in cache:
        return cache[cache_key]

    # Otherwise, generate them using LLM
    job_details = {
        "title": job.title,
        "description": job.description,
        "skills_required": job.graph_schema.get("skills_required", []) if job.graph_schema else []
    }
    
    candidate_profile = {
        "name": candidate.name,
        "skills": candidate.skills,
        "career_history": candidate.career_history,
        "github_username": candidate.github_username,
        "github_stats": candidate.github_stats
    }

    # Generate Simulated Hiring Committee Debate
    debate = llm_service.generate_debate(candidate_profile, job_details)
    
    # Generate Decision Card (strengths, risks, interview questions, email outreach)
    decision_card = llm_service.generate_decision_card(candidate_profile, job_details)

    decision_data = {
        "status": decision_card.get("status", "success"),
        "debate": debate,
        "strengths": decision_card.get("strengths", []),
        "risks": decision_card.get("risks_and_gaps", []),
        "interview_questions": decision_card.get("suggested_interview_questions", []),
        "outreach_email": decision_card.get("personalized_outreach_email", "")
    }

    # Save to candidate cache
    cache[cache_key] = decision_data
    candidate.ranking_explanations = cache
    db.commit()

    log_audit_event(
        db=db,
        action="DECISION_EXPLANATION_GENERATED",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": job_id, "candidate_id": candidate_id}
    )

    return decision_data

@router.get("/compare")
def compare_candidates_route(
    job_id: int,
    candidate_a: int,
    candidate_b: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("viewer"))
):
    comparison = ranking_engine.compare_candidates(db, candidate_a, candidate_b, job_id)
    if "error" in comparison:
        raise HTTPException(status_code=400, detail=comparison["error"])
    return comparison

