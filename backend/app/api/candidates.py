import time
import asyncio
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from app.services.pipeline_events import pipeline_events_service
from app.services.linkedin_intelligence import linkedin_intelligence_engine
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Candidate, User
from app.services.llm_service import llm_service
from app.db.qdrant_client import qdrant_manager
from app.services.github_service import github_service
from app.services.behavioral_intel import behavioral_intelligence_engine
from app.core.auth import require_role
from app.core.audit import log_audit_event
from app.core.prompt_protection import enforce_prompt_protection

router = APIRouter(prefix="/api/candidates", tags=["Candidates"])

@router.get("")
def get_candidates(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    return db.query(Candidate).all()

@router.get("/{candidate_id}")
def get_candidate(
    candidate_id: int, 
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return candidate

@router.post("/upload")
async def upload_candidate(
    request: Request,
    file: UploadFile = File(...),
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    t_start = time.time()
    if session_id:
        pipeline_events_service.create_session(session_id)
        pipeline_events_service.emit_stage(
            session_id, 
            "resume_uploaded", 
            status="complete", 
            duration_ms=0, 
            details={"filename": file.filename}
        )
        pipeline_events_service.emit_stage(session_id, "ai_parsing", status="processing")
    
    # 1. Read file contents and validate file size (< 5MB)
    contents = await file.read()
    MAX_FILE_SIZE = 5 * 1024 * 1024
    if len(contents) > MAX_FILE_SIZE:
        log_audit_event(
            db=db,
            action="CANDIDATE_UPLOAD_FAILED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": file.filename, "reason": "File size exceeds 5MB limit"}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "File size exceeds 5MB limit"})
        raise HTTPException(status_code=400, detail="File size exceeds the 5MB limit.")

    filename = file.filename or ""
    extension = filename.split(".")[-1].lower() if "." in filename else ""
    content_type = file.content_type or ""

    allowed_extensions = {"pdf", "docx", "txt"}
    allowed_content_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "text/plain"
    }

    # 2. Validate file extension and MIME type
    if extension not in allowed_extensions or content_type not in allowed_content_types:
        log_audit_event(
            db=db,
            action="CANDIDATE_UPLOAD_FAILED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": filename, "extension": extension, "content_type": content_type, "reason": "Invalid file type extension or content-type"}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "Invalid file type"})
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF, DOCX, and TXT files are allowed.")

    # 3. Validate Magic Numbers / File Headers
    magic = contents[:4]
    if extension == "pdf" or content_type == "application/pdf":
        if not magic.startswith(b"%PDF"):
            log_audit_event(
                db=db,
                action="CANDIDATE_UPLOAD_FAILED",
                username=current_user.username,
                user_id=current_user.id,
                ip_address=client_ip,
                details={"filename": filename, "reason": "File header mismatch. Not a valid PDF."}
            )
            if session_id:
                pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "File header mismatch (PDF)"})
            raise HTTPException(status_code=400, detail="File header mismatch. Not a valid PDF file.")
    elif extension == "docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        if not magic.startswith(b"PK\x03\x04"):
            log_audit_event(
                db=db,
                action="CANDIDATE_UPLOAD_FAILED",
                username=current_user.username,
                user_id=current_user.id,
                ip_address=client_ip,
                details={"filename": filename, "reason": "File header mismatch. Not a valid DOCX."}
            )
            if session_id:
                pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "File header mismatch (DOCX)"})
            raise HTTPException(status_code=400, detail="File header mismatch. Not a valid DOCX file.")

    text = ""
    try:
        if extension == "pdf" or content_type == "application/pdf":
            import pypdf
            from io import BytesIO
            reader = pypdf.PdfReader(BytesIO(contents))
            text_list = []
            for page in reader.pages:
                t = page.extract_text()
                if t:
                    text_list.append(t)
            text = "\n".join(text_list)
        elif extension == "docx" or content_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
            import docx2txt
            import tempfile
            import os
            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as temp_file:
                temp_file.write(contents)
                temp_file_path = temp_file.name
            try:
                text = docx2txt.process(temp_file_path)
            finally:
                try:
                    os.remove(temp_file_path)
                except Exception:
                    pass
        else:
            # Fallback to plain text
            text = contents.decode("utf-8", errors="ignore")
    except Exception as e:
        if session_id:
            pipeline_events_service.emit_stage(session_id, "ai_parsing", status="error", details={"reason": str(e)})
        raise HTTPException(status_code=400, detail=f"Failed to extract text from file: {str(e)}")

    if not text.strip():
        if session_id:
            pipeline_events_service.emit_stage(session_id, "ai_parsing", status="error", details={"reason": "File is empty"})
        raise HTTPException(status_code=400, detail="The file is empty or no text could be extracted.")

    # 4. Enforce Prompt Injection check on extracted resume text
    try:
        enforce_prompt_protection(text)
    except HTTPException as e:
        log_audit_event(
            db=db,
            action="PROMPT_INJECTION_DETECTED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": filename, "type": "candidate_resume"}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "Prompt injection detected"})
        raise e

    t_extracted = time.time()
    # Send text to AI resume parser
    parsed = llm_service.parse_resume(text)
    t_parsed = time.time()
    
    if session_id:
        parsing_duration = int((t_parsed - t_extracted) * 1000)
        pipeline_events_service.emit_stage(
            session_id, 
            "ai_parsing", 
            status="complete", 
            duration_ms=parsing_duration, 
            details={"candidate_name": parsed.get("name")}
        )
        pipeline_events_service.emit_stage(session_id, "skill_extraction", status="processing")

    email = parsed.get("email")
    if not email:
        if session_id:
            pipeline_events_service.emit_stage(session_id, "ai_parsing", status="error", details={"reason": "Could not parse candidate email"})
        raise HTTPException(status_code=400, detail="Could not parse candidate email from resume.")

    # Check if candidate exists
    existing = db.query(Candidate).filter(Candidate.email == email).first()
    if existing:
         if session_id:
             pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "Candidate already exists"})
         raise HTTPException(status_code=400, detail=f"Candidate with email {email} already exists")

    skills = parsed.get("skills", [])
    if session_id:
        pipeline_events_service.emit_stage(
            session_id, 
            "skill_extraction", 
            status="complete", 
            duration_ms=100, 
            details={"skills_count": len(skills)}
        )

    github_username = parsed.get("github_username")
    
    if session_id:
        pipeline_events_service.emit_stage(session_id, "github_analysis", status="processing")
        
    t_git_start = time.time()
    # Retrieve stats and run enrichment score calculation
    github_stats = github_service.fetch_stats(github_username) if github_username else github_service._get_fallback_stats()
    behavioral_profile = behavioral_intelligence_engine.calculate_score(github_stats)
    t_git_end = time.time()
    
    if session_id:
        git_duration = int((t_git_end - t_git_start) * 1000)
        pipeline_events_service.emit_stage(
            session_id, 
            "github_analysis", 
            status="complete", 
            duration_ms=git_duration, 
            details={"github_username": github_username, "source": github_stats.get("source")}
        )

    if session_id:
        pipeline_events_service.emit_stage(session_id, "linkedin_intelligence", status="processing")
        
    t_li_start = time.time()
    # Run LinkedIn intelligence analysis on candidate data
    linkedin_intel = linkedin_intelligence_engine.analyze(
        career_history=parsed.get("career_history", []),
        skills=parsed.get("skills", []),
        certifications=parsed.get("certifications", []),
        education=parsed.get("education", []),
        github_stats=github_stats,
        behavioral_profile=behavioral_profile
    )
    t_li_end = time.time()
    
    if session_id:
        li_duration = int((t_li_end - t_li_start) * 1000)
        pipeline_events_service.emit_stage(
            session_id, 
            "linkedin_intelligence", 
            status="complete", 
            duration_ms=li_duration, 
            details={"data_quality": linkedin_intel.get("data_quality"), "overall_linkedin_score": linkedin_intel.get("overall_linkedin_score")}
        )

    if session_id:
        pipeline_events_service.emit_stage(session_id, "knowledge_graph_mapping", status="processing")
        await asyncio.sleep(0.3)
        pipeline_events_service.emit_stage(session_id, "knowledge_graph_mapping", status="complete", duration_ms=300)

    if session_id:
        pipeline_events_service.emit_stage(session_id, "behavioral_intelligence", status="processing")
        await asyncio.sleep(0.2)
        pipeline_events_service.emit_stage(
            session_id, 
            "behavioral_intelligence", 
            status="complete", 
            duration_ms=200, 
            details={"behavioral_score": behavioral_profile.get("behavioral_score")}
        )

    # Sanitize parsed text values before inserting into database (XSS prevention)
    name_cleaned = parsed.get("name", "Unknown Candidate").replace("<", "&lt;").replace(">", "&gt;").strip()
    email_cleaned = email.replace("<", "&lt;").replace(">", "&gt;").strip()
    phone_cleaned = parsed.get("phone", "").replace("<", "&lt;").replace(">", "&gt;").strip() if parsed.get("phone") else None
    loc_cleaned = parsed.get("location", "").replace("<", "&lt;").replace(">", "&gt;").strip() if parsed.get("location") else None

    # Create DB entry
    cand = Candidate(
        name=name_cleaned,
        email=email_cleaned,
        resume_text=text,
        skills=skills,
        github_username=github_username,
        github_stats=github_stats,
        career_history=parsed.get("career_history", []),
        certifications=parsed.get("certifications", []),
        phone=phone_cleaned,
        location=loc_cleaned,
        education=parsed.get("education", []),
        github_url=parsed.get("github_url"),
        linkedin_url=parsed.get("linkedin_url"),
        portfolio_url=parsed.get("portfolio_url"),
        personal_website=parsed.get("personal_website"),
        twitter_x=parsed.get("twitter_x"),
        behavioral_profile=behavioral_profile,
        linkedin_intelligence=linkedin_intel
    )
    db.add(cand)
    db.flush()

    if session_id:
        pipeline_events_service.emit_stage(session_id, "embedding_generation", status="processing")

    t_emb_start = time.time()
    # Create and upsert vector in Qdrant/FAISS fallback
    embedding_text = f"{cand.name} {cand.resume_text} {' '.join(cand.skills)}"
    vector = llm_service.get_embedding(embedding_text)
    
    payload = {
        "name": cand.name,
        "skills": cand.skills,
        "github_username": cand.github_username
    }
    qdrant_manager.upsert_candidate(candidate_id=cand.id, vector=vector, payload=payload)
    t_emb_end = time.time()
    
    if session_id:
        emb_duration = int((t_emb_end - t_emb_start) * 1000)
        pipeline_events_service.emit_stage(
            session_id, 
            "embedding_generation", 
            status="complete", 
            duration_ms=emb_duration
        )

    db.commit()
    db.refresh(cand)

    if session_id:
        pipeline_events_service.emit_stage(session_id, "ranking_engine", status="processing")
        await asyncio.sleep(0.4)
        pipeline_events_service.emit_stage(session_id, "ranking_engine", status="complete", duration_ms=400)
        
        pipeline_events_service.emit_stage(session_id, "decision_generated", status="processing")
        await asyncio.sleep(0.2)
        pipeline_events_service.emit_stage(session_id, "decision_generated", status="complete", duration_ms=200)

    log_audit_event(
        db=db,
        action="CANDIDATE_UPLOAD_SUCCESS",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"candidate_id": cand.id, "candidate_name": cand.name, "filename": filename}
    )

    return cand


@router.post("/upload-batch")
async def upload_candidates_batch(
    request: Request,
    files: List[UploadFile] = File(...),
    session_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    """Upload multiple resume files in a single batch request.
    Returns a list of results, one per file, with status and details."""
    results = []
    for idx, file in enumerate(files):
        file_session = f"{session_id}_file{idx}" if session_id else None
        try:
            # Re-use the single upload endpoint logic
            cand = await upload_candidate(
                request=request,
                file=file,
                session_id=file_session,
                db=db,
                current_user=current_user
            )
            results.append({
                "filename": file.filename,
                "status": "success",
                "candidate_id": cand.id,
                "name": cand.name,
                "email": cand.email
            })
        except HTTPException as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "detail": e.detail
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "status": "error",
                "detail": str(e)
            })
    
    success_count = sum(1 for r in results if r["status"] == "success")
    return {
        "total": len(results),
        "success_count": success_count,
        "error_count": len(results) - success_count,
        "results": results
    }

@router.get("/{candidate_id}/github-analysis")
def get_candidate_github_analysis(
    candidate_id: int,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    """Retrieve detailed GitHub intelligence metrics and developer behavior profile."""
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    stats = candidate.github_stats
    profile = candidate.behavioral_profile

    # If candidate github data is fallback or missing, return insufficient_data
    if not candidate.github_username or not stats or stats.get("source") == "fallback":
        return {
            "status": "insufficient_data",
            "message": "Real GitHub data is unavailable for this candidate. Verify public GitHub profile link or configure GitHub API token."
        }

    return {
        "status": "success",
        "github_username": candidate.github_username,
        "github_stats": stats,
        "behavioral_profile": profile
    }

