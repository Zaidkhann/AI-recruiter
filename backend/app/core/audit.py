import logging
from sqlalchemy.orm import Session
from app.db.models import AuditLog

logger = logging.getLogger("security_audit")
logger.setLevel(logging.INFO)

# Make sure console logging is set up
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setLevel(logging.INFO)
    formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    ch.setFormatter(formatter)
    logger.addHandler(ch)

def log_audit_event(db: Session, action: str, username: str | None, user_id: int | None, ip_address: str | None, details: dict = None):
    """Save an audit log entry in the database and output it to the console log."""
    try:
        actual_user_id = None
        if user_id is not None:
            # Check if user actually exists in the DB to prevent FK violation
            from app.db.models import User
            user_exists = db.query(User).filter(User.id == user_id).first() is not None
            if user_exists:
                actual_user_id = user_id

        audit = AuditLog(
            username=username,
            user_id=actual_user_id,
            action=action,
            ip_address=ip_address,
            details=details
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to persist audit log: {e}")
    
    # Log to security console log
    logger.info(f"[SECURITY AUDIT] {action} - User: {username or 'Anonymous'} - IP: {ip_address or 'Unknown'} - Details: {details or {}}")
