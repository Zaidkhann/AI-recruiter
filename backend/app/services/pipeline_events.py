"""
Pipeline Events Service
Tracks and emits stage events during resume ingestion for
real-time pipeline visualization on the frontend.
"""

import logging
import time
import json
import asyncio
from typing import Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class PipelineStage:
    """Represents a single stage in the resume ingestion pipeline."""
    STAGES = [
        "resume_uploaded",
        "ai_parsing",
        "skill_extraction",
        "embedding_generation",
        "github_analysis",
        "linkedin_intelligence",
        "knowledge_graph_mapping",
        "behavioral_intelligence",
        "ranking_engine",
        "decision_generated",
    ]

    STAGE_LABELS = {
        "resume_uploaded": "Resume Uploaded",
        "ai_parsing": "AI Resume Parsing",
        "skill_extraction": "Skill Extraction",
        "embedding_generation": "Embedding Generation",
        "github_analysis": "GitHub Analysis",
        "linkedin_intelligence": "LinkedIn Intelligence",
        "knowledge_graph_mapping": "Knowledge Graph Mapping",
        "behavioral_intelligence": "Behavioral Intelligence",
        "ranking_engine": "Ranking Engine",
        "decision_generated": "Decision Generated",
    }


class PipelineEventsService:
    """Manages pipeline event sessions for real-time visualization."""

    def __init__(self):
        # session_id → list of events
        self._sessions: dict[str, list] = defaultdict(list)
        # session_id → current stage index
        self._stage_index: dict[str, int] = {}
        # session_id → creation timestamp (for cleanup)
        self._created_at: dict[str, float] = {}

    def create_session(self, session_id: str) -> str:
        """Start a new pipeline tracking session."""
        self._sessions[session_id] = []
        self._stage_index[session_id] = -1
        self._created_at[session_id] = time.time()
        logger.info(f"Pipeline session created: {session_id}")
        return session_id

    def emit_stage(
        self,
        session_id: str,
        stage: str,
        status: str = "complete",
        details: Optional[dict] = None,
        duration_ms: Optional[int] = None,
    ):
        """Record a pipeline stage event."""
        if session_id not in self._sessions:
            self.create_session(session_id)

        event = {
            "stage": stage,
            "label": PipelineStage.STAGE_LABELS.get(stage, stage),
            "status": status,
            "timestamp": time.time(),
            "duration_ms": duration_ms or 0,
            "details": details or {},
            "stage_index": PipelineStage.STAGES.index(stage) if stage in PipelineStage.STAGES else -1,
            "total_stages": len(PipelineStage.STAGES),
        }

        self._sessions[session_id].append(event)
        logger.info(f"Pipeline [{session_id}] → {stage}: {status} ({duration_ms}ms)")

    def get_events(self, session_id: str) -> list:
        """Get all events for a session."""
        return self._sessions.get(session_id, [])

    def get_current_state(self, session_id: str) -> dict:
        """Get the current pipeline state summary."""
        events = self._sessions.get(session_id, [])
        if not events:
            return {
                "session_id": session_id,
                "status": "idle",
                "current_stage": None,
                "completed_stages": 0,
                "total_stages": len(PipelineStage.STAGES),
                "events": [],
            }

        completed = [e for e in events if e["status"] == "complete"]
        processing = [e for e in events if e["status"] == "processing"]
        errors = [e for e in events if e["status"] == "error"]

        current_stage = None
        if processing:
            current_stage = processing[-1]["stage"]
        elif completed:
            # Next stage after last completed
            last_idx = completed[-1].get("stage_index", -1)
            if last_idx + 1 < len(PipelineStage.STAGES):
                current_stage = PipelineStage.STAGES[last_idx + 1]

        overall_status = "processing"
        if errors:
            overall_status = "error"
        elif len(completed) >= len(PipelineStage.STAGES):
            overall_status = "complete"

        total_duration = sum(e.get("duration_ms", 0) for e in events)

        return {
            "session_id": session_id,
            "status": overall_status,
            "current_stage": current_stage,
            "completed_stages": len(completed),
            "total_stages": len(PipelineStage.STAGES),
            "total_duration_ms": total_duration,
            "events": events,
        }

    def cleanup_old_sessions(self, max_age_seconds: int = 3600):
        """Remove sessions older than max_age_seconds."""
        now = time.time()
        expired = [
            sid for sid, created in self._created_at.items()
            if now - created > max_age_seconds
        ]
        for sid in expired:
            self._sessions.pop(sid, None)
            self._stage_index.pop(sid, None)
            self._created_at.pop(sid, None)
        if expired:
            logger.info(f"Cleaned up {len(expired)} expired pipeline sessions")

    def generate_demo_events(self) -> list:
        """
        Generate a set of demo events for presentation purposes.
        Returns pre-baked events that show a complete pipeline run.
        """
        base_time = time.time()
        demo_events = []

        stage_durations = {
            "resume_uploaded": 0,
            "ai_parsing": 1200,
            "skill_extraction": 350,
            "embedding_generation": 800,
            "github_analysis": 2100,
            "linkedin_intelligence": 450,
            "knowledge_graph_mapping": 600,
            "behavioral_intelligence": 380,
            "ranking_engine": 1500,
            "decision_generated": 200,
        }

        cumulative_ms = 0
        for stage in PipelineStage.STAGES:
            duration = stage_durations.get(stage, 500)
            cumulative_ms += duration

            demo_events.append({
                "stage": stage,
                "label": PipelineStage.STAGE_LABELS.get(stage, stage),
                "status": "complete",
                "timestamp": base_time + (cumulative_ms / 1000.0),
                "duration_ms": duration,
                "details": {"demo": True},
                "stage_index": PipelineStage.STAGES.index(stage),
                "total_stages": len(PipelineStage.STAGES),
            })

        return demo_events


pipeline_events_service = PipelineEventsService()
