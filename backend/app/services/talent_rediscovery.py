"""
Talent Rediscovery Engine
Finds hidden candidate matches for new job descriptions by searching
the vector store for semantic matches that were not previously top-ranked.
"""

import logging
from sqlalchemy.orm import Session
from app.db.models import Candidate
from app.db.qdrant_client import qdrant_manager
from app.services.llm_service import llm_service
from app.services.skill_adjacency import skill_adjacency_engine

logger = logging.getLogger(__name__)


class TalentRediscoveryEngine:
    """Discovers hidden candidate matches using semantic search and skill adjacency."""

    def rediscover(self, db: Session, job_description: str, limit: int = 10) -> list:
        """
        Given a raw job description text, find candidates with strong transferable
        skills that may have been overlooked by direct keyword matching.

        Args:
            db: SQLAlchemy session
            job_description: Raw job description text
            limit: Maximum number of rediscovered candidates to return

        Returns:
            List of rediscovered candidate dicts with rediscovery_score and reason.
        """
        # 1. Generate embedding for the new job description
        query_vector = llm_service.get_embedding(job_description)
        is_embedding_failed = all(v == 0.0 for v in query_vector)

        # 2. Search Qdrant for semantic matches
        qdrant_results = qdrant_manager.search_candidates(query_vector, limit=50)
        retrieved_ids = [res["candidate_id"] for res in qdrant_results]
        semantic_scores = {res["candidate_id"]: res["score"] for res in qdrant_results}

        if not retrieved_ids:
            candidates = db.query(Candidate).all()
            retrieved_ids = [c.id for c in candidates]
            semantic_scores = {c.id: 0.5 for c in candidates}
        else:
            candidates = db.query(Candidate).filter(Candidate.id.in_(retrieved_ids)).all()

        # 3. Extract skills from job description using simple heuristic
        jd_skills = self._extract_skills_from_text(job_description)

        # 4. Score each candidate for rediscovery potential
        rediscovery_candidates = []
        for candidate in candidates:
            c_skills = candidate.skills or []
            c_skills_lower = {s.lower() for s in c_skills}
            jd_skills_lower = {s.lower() for s in jd_skills}

            # Direct keyword overlap
            direct_match = len(c_skills_lower & jd_skills_lower)
            total_required = max(1, len(jd_skills_lower))
            direct_match_ratio = direct_match / total_required

            # Semantic similarity from Qdrant
            sem_score = semantic_scores.get(candidate.id, 0.5)
            if is_embedding_failed:
                sem_score = direct_match_ratio

            # Skill adjacency score (captures transferable skills)
            adjacency_score = skill_adjacency_engine.calculate_match(db, c_skills, jd_skills)

            # Rediscovery score: high semantic + high adjacency + LOW direct match = hidden gem
            # A candidate who matches semantically but doesn't match keywords is a rediscovery
            if direct_match_ratio < 0.5 and (sem_score > 0.4 or adjacency_score > 0.4):
                # This candidate has transferable skills but not direct keyword match
                rediscovery_score = int(round(
                    (sem_score * 0.40 + adjacency_score * 0.40 + (1.0 - direct_match_ratio) * 0.20) * 100
                ))
            elif adjacency_score > direct_match_ratio + 0.15:
                # Adjacency significantly exceeds direct match — hidden talent
                rediscovery_score = int(round(
                    (sem_score * 0.35 + adjacency_score * 0.45 + (adjacency_score - direct_match_ratio) * 0.20) * 100
                ))
            else:
                # Not a rediscovery — too obvious a match or too weak
                continue

            rediscovery_score = max(1, min(100, rediscovery_score))

            # Generate reason
            reason = self._generate_reason(
                candidate, c_skills, jd_skills, direct_match_ratio, adjacency_score, sem_score
            )

            # Identify transferable skills (skills adjacent to required but not exact matches)
            transferable = [s for s in c_skills if s.lower() not in jd_skills_lower][:5]

            rediscovery_candidates.append({
                "candidate_id": candidate.id,
                "candidate_name": candidate.name,
                "email": candidate.email,
                "skills": c_skills,
                "rediscovery_score": rediscovery_score,
                "semantic_similarity": round(sem_score, 2),
                "skill_adjacency": round(adjacency_score, 2),
                "direct_match_ratio": round(direct_match_ratio, 2),
                "reason": reason,
                "transferable_skills": transferable,
                "github_username": candidate.github_username,
            })

        # Sort by rediscovery score descending
        rediscovery_candidates.sort(key=lambda x: x["rediscovery_score"], reverse=True)

        return rediscovery_candidates[:limit]

    def _extract_skills_from_text(self, text: str) -> list:
        """Simple heuristic skill extraction from job description text."""
        known_skills = [
            "Python", "Java", "JavaScript", "TypeScript", "Go", "Rust", "C++", "C#", "Ruby", "PHP",
            "Kotlin", "Swift", "Scala", "React", "Vue", "Angular", "Next.js", "Svelte", "Node.js",
            "FastAPI", "Django", "Flask", "Spring", "Express", "Docker", "Kubernetes", "Terraform",
            "AWS", "GCP", "Azure", "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
            "Kafka", "RabbitMQ", "GraphQL", "REST", "gRPC", "PyTorch", "TensorFlow", "OpenAI",
            "Gemini", "LangChain", "Qdrant", "FAISS", "Hugging Face", "CI/CD", "Git",
            "Linux", "Nginx", "Prometheus", "Grafana", "Datadog",
        ]
        text_lower = text.lower()
        found = [s for s in known_skills if s.lower() in text_lower]
        return found

    def _generate_reason(
        self, candidate, c_skills: list, jd_skills: list,
        direct_ratio: float, adjacency: float, semantic: float
    ) -> str:
        """Generate a human-readable reason for the rediscovery."""
        c_skills_lower = {s.lower() for s in c_skills}
        jd_skills_lower = {s.lower() for s in jd_skills}

        # Find what they have that's adjacent but not direct
        adjacent_skills = [s for s in c_skills if s.lower() not in jd_skills_lower]

        if adjacency > 0.6 and direct_ratio < 0.3:
            return (
                f"Strong transferable skills ({', '.join(adjacent_skills[:3])}) "
                f"despite no direct keyword match. "
                f"Skill adjacency score of {adjacency:.0%} suggests rapid ramp-up potential."
            )
        elif semantic > 0.6 and direct_ratio < 0.4:
            return (
                f"High semantic similarity ({semantic:.0%}) to job requirements "
                f"with complementary skills in {', '.join(adjacent_skills[:3])}. "
                f"Strong candidate for cross-functional roles."
            )
        else:
            return (
                f"Hidden match with {adjacency:.0%} skill adjacency and "
                f"{semantic:.0%} semantic fit. Adjacent skills: {', '.join(adjacent_skills[:2])}."
            )


talent_rediscovery_engine = TalentRediscoveryEngine()
