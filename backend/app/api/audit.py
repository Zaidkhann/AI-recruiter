from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.db.models import AuditLog, User
from app.core.auth import require_role

router = APIRouter(prefix="/api/admin/audit-logs", tags=["Admin Services"])

@router.get("")
def get_audit_logs(
    limit: int = 100, 
    offset: int = 0,
    db: Session = Depends(get_db),
    _current_user: User = Depends(require_role("admin"))
):
    """Retrieve system security audit logs (Admin only)."""
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).offset(offset).limit(limit).all()
    
    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "timestamp": log.timestamp.isoformat() if log.timestamp else None,
            "username": log.username,
            "user_id": log.user_id,
            "action": log.action,
            "ip_address": log.ip_address,
            "details": log.details
        })
    return result
