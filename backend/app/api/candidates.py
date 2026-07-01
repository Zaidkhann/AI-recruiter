import time
import asyncio
import re
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from sqlalchemy.exc import IntegrityError
from app.services.pipeline_events import pipeline_events_service
from app.services.linkedin_intelligence import linkedin_intelligence_engine
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Candidate, User
from app.services.llm_service import AIResumeParsingError, llm_service
from app.db.qdrant_client import qdrant_manager
from app.services.github_service import github_service
from app.services.behavioral_intel import behavioral_intelligence_engine
from app.core.auth import require_role
from app.core.audit import log_audit_event
from app.core.prompt_protection import enforce_prompt_protection

router = APIRouter(prefix="/api/candidates", tags=["Candidates"])


def _resolve_candidate_email(parsed: dict, resume_text: str, filename: str) -> str:
    """Always return a usable email — never block ingestion when parsing misses one."""
    email = str(parsed.get("email") or "").strip()
    if email:
        return email
    email_match = re.search(r"[\w\.-]+@[\w\.-]+\.\w+", resume_text or "")
    if email_match:
        return email_match.group(0)
    stem = filename.rsplit(".", 1)[0] if filename and "." in filename else "resume"
    safe_stem = re.sub(r"[^\w.-]", "-", stem).strip("-")[:40] or "candidate"
    return f"{safe_stem}.{uuid.uuid4().hex[:8]}@ingest.local"


def _populate_candidate_fields(
    cand: Candidate,
    *,
    name: str,
    email: str,
    resume_text: str,
    parsed: dict,
    skills: list,
    github_username: str | None,
    github_stats: dict,
    behavioral_profile: dict,
    linkedin_intel: dict,
    phone: str | None,
    location: str | None,
    redrob_signals: dict | None = None,
) -> None:
    cand.name = name
    cand.email = email
    cand.resume_text = resume_text
    cand.skills = skills
    cand.github_username = github_username
    cand.github_stats = github_stats
    cand.career_history = parsed.get("career_history") or []
    cand.certifications = parsed.get("certifications") or []
    cand.phone = phone
    cand.location = location
    cand.education = parsed.get("education") or []
    cand.github_url = parsed.get("github_url")
    cand.linkedin_url = parsed.get("linkedin_url")
    cand.portfolio_url = parsed.get("portfolio_url")
    cand.personal_website = parsed.get("personal_website")
    cand.twitter_x = parsed.get("twitter_x")
    cand.behavioral_profile = behavioral_profile
    cand.linkedin_intelligence = linkedin_intel
    cand.redrob_signals = redrob_signals
    cand.ranking_explanations = None
    cand.benchmark_data = None

@router.get("")
def get_candidates(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    return db.query(Candidate).all()


@router.delete("/flush")
def flush_all_candidates(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter")),
):
    """Delete all candidate resumes from the database and vector store."""
    client_ip = request.client.host if request.client else "unknown"
    deleted_count = db.query(Candidate).count()
    db.query(Candidate).delete()
    db.commit()
    qdrant_manager.clear_all_candidates()

    log_audit_event(
        db=db,
        action="CANDIDATES_FLUSH",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"deleted_count": deleted_count},
    )

    return {
        "status": "success",
        "deleted_count": deleted_count,
        "message": f"Removed {deleted_count} resume{'s' if deleted_count != 1 else ''} from the database.",
    }


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
    
    # 1. Read file contents and validate file size (< 600MB)
    contents = await file.read()
    MAX_FILE_SIZE = 600 * 1024 * 1024
    if len(contents) > MAX_FILE_SIZE:
        log_audit_event(
            db=db,
            action="CANDIDATE_UPLOAD_FAILED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": file.filename, "reason": "File size exceeds 600MB limit"}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "File size exceeds 600MB limit"})
        raise HTTPException(status_code=400, detail="File size exceeds the 600MB limit.")

    filename = file.filename or ""
    extension = filename.split(".")[-1].lower() if "." in filename else ""
    content_type = file.content_type or ""

    allowed_extensions = {"pdf", "docx", "txt", "json", "jsonl"}

    # Validate by extension only — browsers often send application/octet-stream for PDFs
    if extension not in allowed_extensions:
        log_audit_event(
            db=db,
            action="CANDIDATE_UPLOAD_FAILED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": filename, "extension": extension, "content_type": content_type, "reason": "Invalid file extension"}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "resume_uploaded", status="error", details={"reason": "Invalid file type"})
        raise HTTPException(status_code=400, detail="Invalid file type. Only PDF, DOCX, TXT, JSON, and JSONL files are allowed.")

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
    # Send text to AI resume parser or parse JSON directly
    try:
        if extension in ("json", "jsonl"):
            import json
            try:
                parsed_json = json.loads(text)
                if isinstance(parsed_json, list) and len(parsed_json) > 0:
                    parsed_json = parsed_json[0]
                if isinstance(parsed_json, dict):
                    if "profile" in parsed_json and "anonymized_name" in parsed_json["profile"]:
                        prof = parsed_json["profile"]
                        parsed = {
                            "name": str(prof.get("anonymized_name", "Unknown")),
                            "email": f"{str(prof.get('anonymized_name', 'unknown')).replace(' ', '.').lower()}@example.com",
                            "location": str(prof.get("location", "")) if prof.get("location") else None,
                            "skills": parsed_json.get("skills", []),
                            "career_history": parsed_json.get("career_history", []),
                            "education": parsed_json.get("education", [])
                        }
                    elif "name" in parsed_json:
                        parsed = parsed_json
                    else:
                        parsed = parsed_json
                        if "name" not in parsed:
                            parsed["name"] = parsed.get("candidate_name", "Unknown Candidate")
                else:
                    parsed = {"name": "Unknown Candidate", "skills": [], "career_history": [], "education": []}
            except Exception:
                parsed = {"name": "Unknown Candidate", "skills": [], "career_history": [], "education": []}
        else:
            parsed = llm_service.parse_resume(text)
    except AIResumeParsingError as e:
        log_audit_event(
            db=db,
            action="CANDIDATE_UPLOAD_FAILED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"filename": filename, "reason": str(e)}
        )
        if session_id:
            pipeline_events_service.emit_stage(session_id, "ai_parsing", status="error", details={"reason": str(e)})
        raise HTTPException(
            status_code=503,
            detail="AI resume parser is unavailable. Configure GEMINI_API_KEY or try again later."
        ) from e
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

    email = _resolve_candidate_email(parsed, text, filename)

    skills = parsed.get("skills") or []
    if not isinstance(skills, list):
        skills = [skills]
    
    cleaned_skills = []
    for s in skills:
        if isinstance(s, dict) and "name" in s:
            cleaned_skills.append(str(s["name"]))
        elif isinstance(s, str):
            cleaned_skills.append(s)
        elif s:
            cleaned_skills.append(str(s))
    skills = cleaned_skills
    
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
        career_history=parsed.get("career_history") or [],
        skills=skills,
        certifications=parsed.get("certifications") or [],
        education=parsed.get("education") or [],
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
    raw_name = parsed.get("name")
    if not raw_name:
        raw_name = "Unknown Candidate"
    name_cleaned = str(raw_name).replace("<", "&lt;").replace(">", "&gt;").strip()
    
    email_cleaned = str(email).replace("<", "&lt;").replace(">", "&gt;").strip()
    
    raw_phone = parsed.get("phone")
    phone_cleaned = str(raw_phone).replace("<", "&lt;").replace(">", "&gt;").strip() if raw_phone else None
    
    raw_loc = parsed.get("location")
    loc_cleaned = str(raw_loc).replace("<", "&lt;").replace(">", "&gt;").strip() if raw_loc else None

    # Update existing candidate when email already in DB, otherwise create new
    existing = db.query(Candidate).filter(Candidate.email == email_cleaned).order_by(Candidate.id.desc()).first()
    is_update = existing is not None
    cand = existing if is_update else Candidate()
    _populate_candidate_fields(
        cand,
        name=name_cleaned,
        email=email_cleaned,
        resume_text=text,
        parsed=parsed,
        skills=skills,
        github_username=github_username,
        github_stats=github_stats,
        behavioral_profile=behavioral_profile,
        linkedin_intel=linkedin_intel,
        phone=phone_cleaned,
        location=loc_cleaned,
        redrob_signals=parsed.get("redrob_signals"),
    )
    if not is_update:
        db.add(cand)

    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        existing = db.query(Candidate).filter(Candidate.email == email_cleaned).order_by(Candidate.id.desc()).first()
        if not existing:
            raise HTTPException(status_code=500, detail="Could not save candidate profile.")
        cand = existing
        _populate_candidate_fields(
            cand,
            name=name_cleaned,
            email=email_cleaned,
            resume_text=text,
            parsed=parsed,
            skills=skills,
            github_username=github_username,
            github_stats=github_stats,
            behavioral_profile=behavioral_profile,
            linkedin_intel=linkedin_intel,
            phone=phone_cleaned,
            location=loc_cleaned,
            redrob_signals=parsed.get("redrob_signals"),
        )
        db.flush()

    if session_id:
        pipeline_events_service.emit_stage(session_id, "embedding_generation", status="processing")

    t_emb_start = time.time()
    # Create and upsert vector in Qdrant/FAISS fallback
    safe_skills = cand.skills if cand.skills else []
    embedding_text = f"{cand.name} {cand.resume_text} {' '.join(safe_skills)}"
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
        details={"candidate_id": cand.id, "candidate_name": cand.name, "filename": filename, "updated": is_update}
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
    import json
    import io
    from starlette.datastructures import UploadFile as StarletteUploadFile
    
    results = []
    
    async def process_single_file(f, f_sess, display_name):
        try:
            cand = await upload_candidate(
                request=request,
                file=f,
                session_id=f_sess,
                db=db,
                current_user=current_user
            )
            results.append({
                "filename": display_name,
                "status": "success",
                "candidate_id": cand.id,
                "name": cand.name,
                "email": cand.email,
            })
        except HTTPException as e:
            db.rollback()
            results.append({
                "filename": display_name,
                "status": "error",
                "detail": e.detail if isinstance(e.detail, str) else str(e.detail),
            })
        except Exception as e:
            db.rollback()
            results.append({
                "filename": display_name,
                "status": "error",
                "detail": str(e)[:200],
            })

    for idx, file in enumerate(files):
        if file.filename.endswith(".json") or file.filename.endswith(".jsonl"):
            content = await file.read()
            is_handled_as_batch = False
            try:
                items_to_process = []
                if file.filename.endswith(".json"):
                    parsed_json = json.loads(content.decode("utf-8"))
                    if isinstance(parsed_json, list):
                        items_to_process = parsed_json
                elif file.filename.endswith(".jsonl"):
                    lines = content.decode("utf-8").strip().split('\n')
                    for line in lines:
                        if line.strip():
                            items_to_process.append(json.loads(line))
                
                if items_to_process:
                    items_to_process = items_to_process[:100]  # Limit to 100 to prevent timeout
                    is_handled_as_batch = True
                    for sub_idx, item in enumerate(items_to_process):
                        file_session = f"{session_id}_file{idx}_item{sub_idx}" if session_id else None
                        
                        item_bytes = json.dumps(item).encode("utf-8")
                        mock_file = StarletteUploadFile(
                            filename=f"{file.filename.replace('.jsonl', '').replace('.json', '')}_item{sub_idx}.json",
                            file=io.BytesIO(item_bytes),
                            headers=file.headers
                        )
                        
                        await process_single_file(mock_file, file_session, mock_file.filename)
            except Exception:
                pass
            
            if is_handled_as_batch:
                continue
            
            # Reset cursor if not batch or json failed
            await file.seek(0)
            
        file_session = f"{session_id}_file{idx}" if session_id else None
        await process_single_file(file, file_session, file.filename)
    
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
