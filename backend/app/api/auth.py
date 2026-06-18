from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field
from app.db.database import get_db
from app.db.models import User
from app.core.auth import get_password_hash, verify_password, create_access_token, get_current_user
from app.core.audit import log_audit_event

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    role: str = Field(default="viewer", pattern="^(viewer|recruiter|admin)$")

class UserLogin(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    username: str
    role: str

class UserProfile(BaseModel):
    id: int
    username: str
    role: str

@router.post("/register", response_model=UserProfile)
def register(payload: UserRegister, request: Request, db: Session = Depends(get_db)):
    """Register a new user account."""
    client_ip = request.client.host if request.client else "unknown"
    
    # Clean input to prevent XSS/HTML injection in usernames
    username_cleaned = payload.username.replace("<", "&lt;").replace(">", "&gt;").strip()
    
    existing = db.query(User).filter(User.username == username_cleaned).first()
    if existing:
        log_audit_event(
            db=db,
            action="REGISTRATION_FAILED",
            username=username_cleaned,
            user_id=None,
            ip_address=client_ip,
            details={"reason": "Username already exists"}
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    hashed = get_password_hash(payload.password)
    user = User(
        username=username_cleaned,
        hashed_password=hashed,
        role=payload.role
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    log_audit_event(
        db=db,
        action="REGISTRATION_SUCCESS",
        username=user.username,
        user_id=user.id,
        ip_address=client_ip,
        details={"assigned_role": user.role}
    )
    return user

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    """Authenticate and return JWT token."""
    client_ip = request.client.host if request.client else "unknown"
    
    # Inputs sanitization
    username_cleaned = payload.username.strip()
    
    user = db.query(User).filter(User.username == username_cleaned).first()
    if not user or not verify_password(payload.password, user.hashed_password):
        log_audit_event(
            db=db,
            action="LOGIN_FAILED",
            username=username_cleaned,
            user_id=None,
            ip_address=client_ip,
            details={"reason": "Invalid credentials"}
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    
    log_audit_event(
        db=db,
        action="LOGIN_SUCCESS",
        username=user.username,
        user_id=user.id,
        ip_address=client_ip,
        details={"role": user.role}
    )
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "username": user.username,
        "role": user.role
    }

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    """Retrieve details of current authenticated session."""
    return current_user
