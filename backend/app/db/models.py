import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, Float
from sqlalchemy.orm import relationship
from app.db.database import Base

class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=False)
    status = Column(String, default="active")
    benchmark_profile = Column(String, default="GENERAL_ENGINEER")  # YC_FOUNDER, FAANG_STAFF, DEV_OPS, etc.
    graph_schema = Column(JSON, nullable=True)  # Job Knowledge Graph cached JSON representation
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    email = Column(String, nullable=False, index=True)
    resume_text = Column(Text, nullable=True)
    career_history = Column(JSON, nullable=True)  # List of jobs [{company, title, start_date, end_date, description, level}]
    github_username = Column(String, nullable=True, index=True)
    github_stats = Column(JSON, nullable=True)  # {languages: [], repos: [], commits_count: int, contribution_history: []}
    skills = Column(JSON, nullable=True)  # ["Python", "Rust", ...]
    certifications = Column(JSON, nullable=True)  # ["AWS Certified Solution Architect"]
    phone = Column(String, nullable=True)
    location = Column(String, nullable=True)
    education = Column(JSON, nullable=True)  # List of schools/degrees
    github_url = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    portfolio_url = Column(String, nullable=True)
    personal_website = Column(String, nullable=True)
    twitter_x = Column(String, nullable=True)
    behavioral_profile = Column(JSON, nullable=True)  # {commit_frequency: float, code_complexity: float, peak_hours: []}
    ranking_explanations = Column(JSON, nullable=True)  # Cache for re-ranking summaries, risk cards, etc.
    linkedin_intelligence = Column(JSON, nullable=True)  # LinkedIn Intelligence Engine scores
    benchmark_data = Column(JSON, nullable=True)  # Benchmark percentile data
    redrob_signals = Column(JSON, nullable=True)  # Redrob candidate intelligence signals
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class TeamMember(Base):
    __tablename__ = "team_members"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)
    skills = Column(JSON, nullable=True)  # ["React", "Typescript", "Node.js"]
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class GraphNode(Base):
    __tablename__ = "graph_nodes"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(String, nullable=False, index=True)  # SKILL, ROLE, COMPANY, CANDIDATE, TEAM_MEMBER
    name = Column(String, nullable=False, index=True)
    attributes = Column(JSON, nullable=True)

class GraphEdge(Base):
    __tablename__ = "graph_edges"

    id = Column(Integer, primary_key=True, index=True)
    from_node_id = Column(Integer, ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    to_node_id = Column(Integer, ForeignKey("graph_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True)  # IS_A, RELATED_TO, WORKED_AT, HAS_SKILL, IN_TEAM
    weight = Column(Float, default=1.0)

    from_node = relationship("GraphNode", foreign_keys=[from_node_id])
    to_node = relationship("GraphNode", foreign_keys=[to_node_id])

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, nullable=False, unique=True, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="viewer")  # admin, recruiter, viewer
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    username = Column(String, nullable=True, index=True)
    action = Column(String, nullable=False, index=True)
    ip_address = Column(String, nullable=True)
    details = Column(JSON, nullable=True)

    user = relationship("User", foreign_keys=[user_id])

class ATSRecord(Base):
    __tablename__ = "ats_records"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    stage = Column(String, default="applied", nullable=False, index=True)  # applied, screening, interview, offer, hired, rejected
    notes = Column(Text, nullable=True)
    updated_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    candidate = relationship("Candidate", foreign_keys=[candidate_id])
    job = relationship("Job", foreign_keys=[job_id])

