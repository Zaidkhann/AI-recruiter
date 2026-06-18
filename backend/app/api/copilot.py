from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import Job, User
from app.db.redis_client import redis_manager
from app.services.llm_service import llm_service
from pydantic import BaseModel, Field
from app.core.auth import require_role
from app.core.audit import log_audit_event
from app.core.prompt_protection import enforce_prompt_protection

router = APIRouter(prefix="/api/copilot", tags=["Copilot"])

class CopilotQuery(BaseModel):
    session_id: str = Field(..., min_length=3, max_length=100)
    job_id: int
    prompt: str = Field(..., min_length=2, max_length=1000)

@router.post("")
def chat_with_copilot(
    payload: CopilotQuery, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    # 1. Enforce prompt injection safety check
    try:
        enforce_prompt_protection(payload.prompt)
    except HTTPException as e:
        log_audit_event(
            db=db,
            action="PROMPT_INJECTION_DETECTED",
            username=current_user.username,
            user_id=current_user.id,
            ip_address=client_ip,
            details={"input": payload.prompt, "type": "copilot_query"}
        )
        raise e

    job = db.query(Job).filter(Job.id == payload.job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job context not found")

    # Fetch history from Redis
    history = redis_manager.get_copilot_chat(payload.session_id)

    # Call LLM Copilot interpreter
    result = llm_service.copilot_chat(history, payload.prompt, job.title)

    # Append new conversation turn to Redis
    user_msg = {"role": "user", "content": payload.prompt}
    assistant_msg = {"role": "assistant", "content": result["answer"], "adjustments": result.get("weight_adjustments")}
    
    redis_manager.append_copilot_chat(payload.session_id, user_msg)
    redis_manager.append_copilot_chat(payload.session_id, assistant_msg)

    log_audit_event(
        db=db,
        action="COPILOT_QUERY",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"session_id": payload.session_id, "job_id": payload.job_id}
    )

    return result

