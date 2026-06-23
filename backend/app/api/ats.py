"""Applicant Tracking System (ATS) API endpoints."""

from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.db.database import get_db
from app.db.models import ATSRecord, Candidate, Job, User
from app.core.auth import require_role
from app.core.audit import log_audit_event

router = APIRouter(prefix="/api/ats", tags=["ATS"])

VALID_STAGES = ["applied", "screening", "interview", "offer", "hired", "rejected"]


class ATSCreateRequest(BaseModel):
    candidate_id: int
    job_id: int
    stage: str = "applied"
    notes: Optional[str] = None


class ATSUpdateRequest(BaseModel):
    stage: str
    notes: Optional[str] = None


@router.get("")
def list_ats_records(
    job_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer")),
):
    """List all ATS records, optionally filtered by job_id."""
    query = db.query(ATSRecord)
    if job_id is not None:
        query = query.filter(ATSRecord.job_id == job_id)
    records = query.order_by(ATSRecord.updated_at.desc()).all()

    results = []
    for r in records:
        results.append({
            "id": r.id,
            "candidate_id": r.candidate_id,
            "candidate_name": r.candidate.name if r.candidate else "Unknown",
            "candidate_email": r.candidate.email if r.candidate else "",
            "job_id": r.job_id,
            "job_title": r.job.title if r.job else "Unknown",
            "stage": r.stage,
            "notes": r.notes,
            "updated_by": r.updated_by,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        })
    return results


@router.get("/summary")
def ats_summary(
    job_id: Optional[int] = None,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer")),
):
    """Return aggregated stage counts for the ATS pipeline board."""
    query = db.query(ATSRecord.stage, func.count(ATSRecord.id))
    if job_id is not None:
        query = query.filter(ATSRecord.job_id == job_id)
    rows = query.group_by(ATSRecord.stage).all()

    summary = {s: 0 for s in VALID_STAGES}
    for stage, count in rows:
        summary[stage] = count
    summary["total"] = sum(summary.values())
    return summary


@router.post("")
def create_ats_record(
    body: ATSCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter")),
):
    """Create a new ATS tracking record for a candidate-job pair."""
    if body.stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")

    # Verify candidate and job exist
    candidate = db.query(Candidate).filter(Candidate.id == body.candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    job = db.query(Job).filter(Job.id == body.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check for existing record
    existing = (
        db.query(ATSRecord)
        .filter(ATSRecord.candidate_id == body.candidate_id, ATSRecord.job_id == body.job_id)
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="ATS record already exists for this candidate-job pair. Use PATCH to update.")

    record = ATSRecord(
        candidate_id=body.candidate_id,
        job_id=body.job_id,
        stage=body.stage,
        notes=body.notes,
        updated_by=current_user.username,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        action="ATS_RECORD_CREATED",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={
            "candidate_id": body.candidate_id,
            "job_id": body.job_id,
            "stage": body.stage,
        },
    )

    return {
        "id": record.id,
        "candidate_id": record.candidate_id,
        "job_id": record.job_id,
        "stage": record.stage,
        "notes": record.notes,
        "updated_by": record.updated_by,
    }


@router.patch("/{record_id}")
def update_ats_stage(
    record_id: int,
    body: ATSUpdateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter")),
):
    """Move a candidate to a new stage in the ATS pipeline."""
    if body.stage not in VALID_STAGES:
        raise HTTPException(status_code=400, detail=f"Invalid stage. Must be one of: {', '.join(VALID_STAGES)}")

    record = db.query(ATSRecord).filter(ATSRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="ATS record not found")

    old_stage = record.stage
    record.stage = body.stage
    if body.notes is not None:
        record.notes = body.notes
    record.updated_by = current_user.username
    db.commit()
    db.refresh(record)

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        action="ATS_STAGE_UPDATED",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={
            "record_id": record_id,
            "candidate_id": record.candidate_id,
            "old_stage": old_stage,
            "new_stage": body.stage,
        },
    )

    return {
        "id": record.id,
        "candidate_id": record.candidate_id,
        "job_id": record.job_id,
        "stage": record.stage,
        "notes": record.notes,
        "updated_by": record.updated_by,
    }


@router.delete("/{record_id}")
def delete_ats_record(
    record_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter")),
):
    """Remove an ATS tracking record."""
    record = db.query(ATSRecord).filter(ATSRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="ATS record not found")

    db.delete(record)
    db.commit()

    client_ip = request.client.host if request.client else "unknown"
    log_audit_event(
        db=db,
        action="ATS_RECORD_DELETED",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"record_id": record_id},
    )

    return {"status": "deleted", "record_id": record_id}


@router.get("/score/{candidate_id}/{job_id}")
def ats_resume_score(
    candidate_id: int,
    job_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer")),
):
    """Calculate an ATS resume-to-job compatibility score.
    
    Analyzes the candidate's skills, resume text, and experience against
    the job description keywords, required skills, and role expectations.
    Returns a percentage match score with a detailed breakdown.
    """
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # -- Build the candidate keyword corpus --
    candidate_skills = [s.lower().strip() for s in (candidate.skills or [])]
    resume_lower = (candidate.resume_text or "").lower()
    certs_lower = [c.lower().strip() for c in (candidate.certifications or [])]

    # -- Build the job keyword targets --
    graph = job.graph_schema or {}
    required_skills = [s.lower().strip() for s in (graph.get("skills_required") or graph.get("required_skills") or [])]
    jd_lower = (job.description or "").lower()

    # Extract additional keywords from job description (simple tokeniser)
    import re
    _stop_words = {
        "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
        "of", "with", "by", "is", "are", "was", "were", "be", "been", "being",
        "have", "has", "had", "do", "does", "did", "will", "would", "shall",
        "should", "may", "might", "must", "can", "could", "this", "that",
        "these", "those", "i", "you", "he", "she", "it", "we", "they", "not",
        "no", "so", "if", "as", "about", "up", "out", "into", "from", "our",
        "your", "their", "its", "what", "which", "who", "whom", "where",
        "when", "why", "how", "all", "each", "every", "both", "few", "more",
        "most", "other", "some", "such", "than", "too", "very", "just",
        "also", "etc", "able", "work", "team", "role", "using", "new",
    }
    jd_tokens = set(re.findall(r"[a-z][a-z+#.]{1,}", jd_lower)) - _stop_words

    # ---- SCORING DIMENSIONS ----

    # 1. Skills match (most important — 50 % weight)
    if required_skills:
        matched_skills = [s for s in required_skills if s in candidate_skills or s in resume_lower]
        skills_score = len(matched_skills) / len(required_skills)
        matched_skills_list = matched_skills
        missing_skills_list = [s for s in required_skills if s not in matched_skills]
    else:
        skills_score = 0.5  # neutral when no requirements defined
        matched_skills_list = []
        missing_skills_list = []

    # 2. Keyword density (25 % weight)
    if jd_tokens:
        kw_hits = sum(1 for t in jd_tokens if t in resume_lower or t in candidate_skills)
        keyword_score = min(kw_hits / max(len(jd_tokens) * 0.4, 1), 1.0)
    else:
        keyword_score = 0.5

    # 3. Experience relevance (15 % weight) — career history mention overlap
    career_text = ""
    for entry in (candidate.career_history or []):
        career_text += " ".join(str(v) for v in entry.values()).lower() + " "
    if jd_tokens and career_text:
        exp_hits = sum(1 for t in jd_tokens if t in career_text)
        experience_score = min(exp_hits / max(len(jd_tokens) * 0.3, 1), 1.0)
    else:
        experience_score = 0.3

    # 4. Certification bonus (10 % weight)
    cert_score = min(len(certs_lower) * 0.25, 1.0) if certs_lower else 0.0

    # ---- COMPOSITE SCORE ----
    composite = (
        skills_score * 0.50
        + keyword_score * 0.25
        + experience_score * 0.15
        + cert_score * 0.10
    )
    ats_percentage = round(composite * 100, 1)

    # Determine verdict
    if ats_percentage >= 80:
        verdict = "Strong Match"
        verdict_color = "emerald"
    elif ats_percentage >= 60:
        verdict = "Good Match"
        verdict_color = "blue"
    elif ats_percentage >= 40:
        verdict = "Moderate Match"
        verdict_color = "amber"
    else:
        verdict = "Weak Match"
        verdict_color = "rose"

    return {
        "candidate_id": candidate_id,
        "job_id": job_id,
        "ats_score": ats_percentage,
        "verdict": verdict,
        "verdict_color": verdict_color,
        "breakdown": {
            "skills_match": round(skills_score * 100, 1),
            "keyword_density": round(keyword_score * 100, 1),
            "experience_relevance": round(experience_score * 100, 1),
            "certification_bonus": round(cert_score * 100, 1),
        },
        "matched_skills": matched_skills_list,
        "missing_skills": missing_skills_list,
        "total_required_skills": len(required_skills),
    }
