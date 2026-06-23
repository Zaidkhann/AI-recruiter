from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Job, User
from app.services.llm_service import llm_service
from pydantic import BaseModel, Field
from app.core.auth import require_role
from app.core.audit import log_audit_event

from typing import Optional, List

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])

class JobCreate(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=10, max_length=2000)
    benchmark_profile: str = Field(default="GENERAL_ENGINEER", pattern="^(YC_FOUNDER|YC_FOUNDING_ENGINEER|FAANG_STAFF|DEV_OPS|GENERAL_ENGINEER|DEFAULT)$")
    required_skills: Optional[List[str]] = Field(default=None)

class SuggestSkillsQuery(BaseModel):
    title: str = Field(..., min_length=3, max_length=150)
    description: str = Field(..., min_length=10, max_length=2000)

@router.post("/suggest-skills")
def suggest_skills_endpoint(
    payload: SuggestSkillsQuery,
    _current_user: User = Depends(require_role("recruiter"))
):
    skills = llm_service.suggest_skills(payload.title, payload.description)
    return {"skills": skills}

@router.get("")
def get_jobs(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    return db.query(Job).all()

@router.get("/{job_id}")
def get_job(
    job_id: int, 
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@router.post("")
def create_job(
    payload: JobCreate, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    # Sanitize input strings to prevent XSS
    title_cleaned = payload.title.replace("<", "&lt;").replace(">", "&gt;").strip()
    desc_cleaned = payload.description.replace("<", "&lt;").replace(">", "&gt;").strip()
    
    # Parse description using LLM
    graph_schema = llm_service.parse_job_description(desc_cleaned)
    if payload.required_skills is not None:
        graph_schema["skills_required"] = payload.required_skills
        graph_schema["required_skills"] = payload.required_skills
    
    new_job = Job(
        title=title_cleaned,
        description=desc_cleaned,
        benchmark_profile=payload.benchmark_profile,
        graph_schema=graph_schema
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)
    
    log_audit_event(
        db=db,
        action="JOB_CREATE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": new_job.id, "job_title": new_job.title}
    )
    
    return new_job

from app.services.talent_rediscovery import talent_rediscovery_engine

class JobStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|archived|closed)$")

@router.put("/{job_id}")
def update_job(
    job_id: int,
    payload: JobCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    title_cleaned = payload.title.replace("<", "&lt;").replace(">", "&gt;").strip()
    desc_cleaned = payload.description.replace("<", "&lt;").replace(">", "&gt;").strip()
    
    graph_schema = llm_service.parse_job_description(desc_cleaned)
    if payload.required_skills is not None:
        graph_schema["skills_required"] = payload.required_skills
        graph_schema["required_skills"] = payload.required_skills

    job.title = title_cleaned
    job.description = desc_cleaned
    job.benchmark_profile = payload.benchmark_profile
    job.graph_schema = graph_schema
    
    db.commit()
    db.refresh(job)

    log_audit_event(
        db=db,
        action="JOB_UPDATE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": job.id, "job_title": job.title}
    )

    return job

@router.delete("/{job_id}")
def delete_job(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job_title = job.title
    db.delete(job)
    db.commit()

    log_audit_event(
        db=db,
        action="JOB_DELETE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": job_id, "job_title": job_title}
    )

    return {"status": "success", "message": f"Job {job_id} deleted successfully."}

@router.put("/{job_id}/status")
def update_job_status(
    job_id: int,
    payload: JobStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    old_status = job.status
    job.status = payload.status
    db.commit()
    db.refresh(job)

    log_audit_event(
        db=db,
        action="JOB_STATUS_CHANGE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": job.id, "old_status": old_status, "new_status": payload.status}
    )

    return job

@router.post("/{job_id}/clone")
def clone_job(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    cloned_job = Job(
        title=f"Clone of {job.title}",
        description=job.description,
        benchmark_profile=job.benchmark_profile,
        graph_schema=job.graph_schema,
        status="active"
    )
    db.add(cloned_job)
    db.commit()
    db.refresh(cloned_job)

    log_audit_event(
        db=db,
        action="JOB_CLONE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"original_job_id": job.id, "cloned_job_id": cloned_job.id}
    )

    return cloned_job

@router.post("/{job_id}/rediscover-talent")
def rediscover_talent_for_job(
    job_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    rediscovered = talent_rediscovery_engine.rediscover(db, job.description, limit=10)

    log_audit_event(
        db=db,
        action="TALENT_REDISCOVERY",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"job_id": job_id}
    )

    return {"matches": rediscovered}

