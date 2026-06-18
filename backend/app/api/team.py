from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import TeamMember, User
from pydantic import BaseModel, Field
from app.core.auth import require_role
from app.core.audit import log_audit_event

router = APIRouter(prefix="/api/team", tags=["Team"])

class TeamMemberCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    role: str = Field(..., min_length=2, max_length=100)
    skills: list[str] = Field(default=[])

@router.get("")
def get_team_members(
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("viewer"))
):
    return db.query(TeamMember).all()

@router.post("")
def add_team_member(
    payload: TeamMemberCreate, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("recruiter"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    # Sanitize input strings to prevent XSS
    name_cleaned = payload.name.replace("<", "&lt;").replace(">", "&gt;").strip()
    role_cleaned = payload.role.replace("<", "&lt;").replace(">", "&gt;").strip()
    skills_cleaned = [s.replace("<", "&lt;").replace(">", "&gt;").strip() for s in payload.skills]
    
    member = TeamMember(
        name=name_cleaned,
        role=role_cleaned,
        skills=skills_cleaned
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    
    log_audit_event(
        db=db,
        action="TEAM_MEMBER_ADD",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"member_id": member.id, "member_name": member.name}
    )
    return member

@router.delete("/{member_id}")
def remove_team_member(
    member_id: int, 
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role("admin"))
):
    client_ip = request.client.host if request.client else "unknown"
    
    member = db.query(TeamMember).filter(TeamMember.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Team member not found")
        
    member_name = member.name
    db.delete(member)
    db.commit()
    
    log_audit_event(
        db=db,
        action="TEAM_MEMBER_DELETE",
        username=current_user.username,
        user_id=current_user.id,
        ip_address=client_ip,
        details={"member_id": member_id, "member_name": member_name}
    )
    return {"message": "Team member removed"}

