import json
import asyncio
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Candidate, Job, User
from app.core.auth import require_role
from app.services.linkedin_intelligence import linkedin_intelligence_engine
from app.services.benchmarking_engine import benchmarking_engine
from app.services.ranking_audit import ranking_audit_engine
from app.services.talent_rediscovery import talent_rediscovery_engine
from app.services.pipeline_events import pipeline_events_service
from pydantic import BaseModel

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])

class TalentRediscoveryQuery(BaseModel):
    job_description: str
    limit: Optional[int] = 10

@router.get("/{candidate_id}/linkedin")
def get_linkedin_intelligence(
    candidate_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
        
    if not candidate.linkedin_intelligence:
        candidate.linkedin_intelligence = linkedin_intelligence_engine.analyze(
            career_history=candidate.career_history,
            skills=candidate.skills,
            certifications=candidate.certifications,
            education=candidate.education,
            github_stats=candidate.github_stats,
            behavioral_profile=candidate.behavioral_profile
        )
        db.add(candidate)
        db.commit()
        db.refresh(candidate)
        
    return candidate.linkedin_intelligence

@router.get("/{candidate_id}/benchmark")
def get_candidate_benchmark(
    candidate_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    job = db.query(Job).filter(Job.id == job_id).first()
    if not candidate or not job:
        raise HTTPException(status_code=404, detail="Candidate or Job not found")
        
    from app.services.ranking_engine import ranking_engine
    ranked_result = ranking_engine.rank_candidates(db, job_id)
    all_candidates = ranking_engine._flatten_ranking_result(ranked_result)
    match = next((item for item in all_candidates if item["id"] == candidate_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Candidate cannot be ranked for this job")
        
    return match["benchmark_data"]

@router.get("/{candidate_id}/audit")
def get_ranking_audit(
    candidate_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    from app.services.ranking_engine import ranking_engine
    ranked_result = ranking_engine.rank_candidates(db, job_id)
    all_candidates = ranking_engine._flatten_ranking_result(ranked_result)
    match = next((item for item in all_candidates if item["id"] == candidate_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Candidate cannot be ranked for this job")
        
    return match["ranking_audit"]

@router.post("/talent-rediscovery")
def rediscover_talent(
    payload: TalentRediscoveryQuery,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("recruiter"))
):
    results = talent_rediscovery_engine.rediscover(db, payload.job_description, payload.limit)
    return results

@router.get("/pipeline-events/{session_id}")
async def stream_pipeline_events(session_id: str):
    async def event_generator():
        sent_count = 0
        
        # If it's a demo session, populate pre-baked events
        if session_id.startswith("demo_"):
            demo_events = pipeline_events_service.generate_demo_events()
            for event in demo_events:
                yield f"data: {json.dumps(event)}\n\n"
                await asyncio.sleep(0.8) # simulate delay for demo presentation
            return

        # Regular session tracking
        # First send any existing events
        events = pipeline_events_service.get_events(session_id)
        for event in events:
            yield f"data: {json.dumps(event)}\n\n"
        sent_count = len(events)

        while True:
            events = pipeline_events_service.get_events(session_id)
            if len(events) > sent_count:
                for i in range(sent_count, len(events)):
                    yield f"data: {json.dumps(events[i])}\n\n"
                sent_count = len(events)
                
                # Exit loop if pipeline is complete
                if events and events[-1]["stage"] == "decision_generated" and events[-1]["status"] == "complete":
                    break
            await asyncio.sleep(0.5)

    return StreamingResponse(event_generator(), media_type="text/event-stream")
