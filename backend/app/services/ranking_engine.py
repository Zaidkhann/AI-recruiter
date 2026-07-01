import json
import logging
import redis
import hashlib
from datetime import timedelta
from sqlalchemy.orm import Session
from app.core.config import settings
from app.db.models import Candidate, Job, TeamMember, GraphNode, GraphEdge
from app.db.qdrant_client import qdrant_manager
from app.services.llm_service import _skill_has_text_evidence, llm_service
from app.services.skill_adjacency import skill_adjacency_engine
from app.services.career_trajectory import career_trajectory_engine
from app.services.behavioral_intel import behavioral_intelligence_engine
from app.services.success_potential import success_potential_engine
from app.services.market_intel import market_intelligence_engine
from app.services.linkedin_intelligence import linkedin_intelligence_engine
from app.services.benchmarking_engine import benchmarking_engine
from app.services.ranking_audit import ranking_audit_engine

logger = logging.getLogger(__name__)

# Initialize Redis client
try:
    redis_client = redis.Redis(host=settings.REDIS_HOST, port=settings.REDIS_PORT, db=0, decode_responses=True)
    redis_client.ping()
except Exception as e:
    logger.warning(f"Redis not available, caching will be disabled. Error: {e}")
    redis_client = None

class RankingEngine:
    def __init__(self):
        # Default scaling coefficients
        self.beta = 0.15   # Team fit gap multiplier
        self.gamma = 0.15  # Hidden talent multiplier
        self.alpha = 0.10  # Benchmark multiplier

    def get_team_skills(self, db: Session) -> set:
        """Collects the union of all skills possessed by existing team members"""
        team_members = db.query(TeamMember).all()
        team_skills = set()
        for member in team_members:
            if member.skills:
                for skill in member.skills:
                    team_skills.add(skill.lower())
        return team_skills

    def calculate_team_gap_score(self, candidate_skills: list, required_skills: list, team_skills: set) -> float:
        """
        Calculates how well a candidate fills gaps.
        A gap is a skill that is REQUIRED for the job, NOT present in the existing team,
        and POSSESSED by the candidate.
        Returns a modifier in range [0.0, 1.0].
        """
        if not required_skills:
            return 0.0
            
        gaps_identified = [s.lower() for s in required_skills if s.lower() not in team_skills]
        if not gaps_identified:
            return 0.0

        gaps_filled = [s for s in candidate_skills if s.lower() in gaps_identified]
        return len(gaps_filled) / len(gaps_identified)

    def _get_cache_key(self, candidate_id: int, job_id: int) -> str:
        return f"ranking_explanation:{candidate_id}:{job_id}"

    def _get_cached_explanation(self, candidate_id: int, job_id: int):
        if not redis_client:
            return None
        key = self._get_cache_key(candidate_id, job_id)
        cached = redis_client.get(key)
        if cached:
            try:
                return json.loads(cached)
            except Exception:
                pass
        return None

    def _set_cached_explanation(self, candidate_id: int, job_id: int, explanation: dict):
        if not redis_client:
            return
        key = self._get_cache_key(candidate_id, job_id)
        redis_client.setex(key, timedelta(hours=24), json.dumps(explanation))

    def clear_job_cache(self, job_id: int):
        """Flushes cached ranking explanations for a specific job when it is updated."""
        if not redis_client:
            return
        pattern = f"ranking_explanation:*:{job_id}"
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)

    def _calculate_confidence_score(self, candidate: Candidate) -> int:
        score = 40  # base
        if candidate.resume_text and len(candidate.resume_text) > 200:
            score += 10
        if candidate.skills and len(candidate.skills) > 3:
            score += 10
        
        # GitHub verification status
        if candidate.github_stats and candidate.github_stats.get("source") != "fallback":
            score += 15
        elif candidate.github_username or candidate.github_url:
            score += 5
            
        # LinkedIn data quality / URL
        if candidate.linkedin_intelligence:
            quality = candidate.linkedin_intelligence.get("data_quality", "low")
            if quality == "high":
                score += 15
            elif quality == "medium":
                score += 10
            else:
                score += 5
        elif candidate.linkedin_url:
            score += 5
            
        # Career history depth
        if candidate.career_history:
            history_len = len(candidate.career_history)
            if history_len >= 3:
                score += 10
            elif history_len >= 1:
                score += 5

        # --- REDROB SIGNALS INTEGRATION ---
        redrob = candidate.redrob_signals or {}
        if redrob:
            if redrob.get("profile_completeness_score", 0) > 80:
                score += 10
            if redrob.get("verified_email"):
                score += 5
            if redrob.get("verified_phone"):
                score += 5

        return min(100, score)

    def _generate_rule_based_explanation(self, c_info: dict, job_skills: list) -> dict:
        c_skills = c_info.get("skills", [])
        c_skills_set = {s.lower() for s in c_skills} if c_skills else set()
        j_skills_set = {s.lower() for s in job_skills} if job_skills else set()
        
        missing = list(j_skills_set - c_skills_set)
        critical_missing = missing[:3]
        nice_missing = missing[3:]
        transferable = list(c_skills_set.intersection(j_skills_set))[:5]
        
        strengths = ["Strong core skill overlap"] if len(transferable) > 2 else []
        risks = ["Missing critical job skills"] if len(critical_missing) > 0 else []
        
        action = "Consider"
        if c_info["final_score"] > 0.8:
            action = "Strong Hire"
        elif c_info["final_score"] > 0.6:
            action = "Interview"
        elif c_info["final_score"] < 0.3:
            action = "Reject"

        return {
            "why_ranked": "Based on overall multi-factor matching (Rule-based).",
            "strengths": strengths,
            "risks": risks,
            "missing_skills": {
                "critical_missing_skills": critical_missing,
                "nice_to_have_missing_skills": nice_missing
            },
            "transferable_skills": transferable,
            "interview_questions": {
                "technical": [f"Can you discuss your experience with {s}?" for s in transferable[:2]],
                "behavioral": ["Can you describe a time you faced a difficult technical challenge?"],
                "role_specific": ["How do you approach learning new skills on the job?"]
            },
            "recommended_action": action
        }

    def _generate_llm_explanation(self, candidate_brief: dict, job_context: dict) -> dict:
        return llm_service.generate_explanation_card(candidate_brief, job_context)

    def compare_candidates(self, db: Session, candidate_a_id: int, candidate_b_id: int, job_id: int) -> dict:
        """
        Compare two candidates for a specific job.
        Uses the engine to score both and outputs a comparison.
        """
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {"error": "Job not found"}
        
        ranked_all = self.rank_candidates(db, job_id)
        all_candidates = self._flatten_ranking_result(ranked_all)
        cand_a_data = next((c for c in all_candidates if c["id"] == candidate_a_id), None)
        cand_b_data = next((c for c in all_candidates if c["id"] == candidate_b_id), None)

        if not cand_a_data or not cand_b_data:
            return {"error": "One or both candidates not found or could not be ranked"}

        score_diff = abs(cand_a_data["overall_score"] - cand_b_data["overall_score"])
        winner = cand_a_data if cand_a_data["overall_score"] >= cand_b_data["overall_score"] else cand_b_data
        loser = cand_b_data if cand_a_data["overall_score"] >= cand_b_data["overall_score"] else cand_a_data

        comparison = {
            "winner_id": winner["id"],
            "winner_name": winner["name"],
            "score_difference": round(score_diff, 2),
            "key_differentiators": [],
            "why": f"{winner['name']} scored higher overall, particularly leading in "
        }

        diffs = []
        for category in ["skills", "experience", "github", "leadership", "culture"]:
            w_score = winner["factor_breakdown"].get(category, 0)
            l_score = loser["factor_breakdown"].get(category, 0)
            if w_score > l_score + 5:
                diffs.append(f"{category} (+{round(w_score - l_score, 1)})")
        
        comparison["key_differentiators"] = diffs
        comparison["why"] += ", ".join(diffs) if diffs else "multiple balanced areas."

        return comparison

    def _calculate_domain_alignment(self, candidate: Candidate, domains: list, responsibilities: list) -> float:
        """
        Calculates how well a candidate's profile matches the job's target domains and responsibilities.
        Returns a score in range [0.0, 1.0].
        """
        if not domains and not responsibilities:
            return 0.5

        score_components = []
        candidate_text = (candidate.resume_text or "").lower()
        
        # Combine skills list
        c_skills = [s.lower() for s in (candidate.skills or [])]
        for skill in c_skills:
            candidate_text += f" {skill}"
            
        # Combine career history details
        for job in (candidate.career_history or []):
            candidate_text += f" {(job.get('title') or '').lower()}"
            candidate_text += f" {(job.get('description') or '').lower()}"

        # 1. Match domains (case-insensitive substring checks)
        if domains:
            domain_matches = 0
            for domain in domains:
                d_lower = domain.lower()
                if d_lower in candidate_text:
                    domain_matches += 1
                else:
                    words = [w for w in d_lower.split() if len(w) > 3]
                    if words and all(w in candidate_text for w in words):
                        domain_matches += 1
            score_components.append(domain_matches / len(domains))

        # 2. Match responsibilities (check overlap of important terms)
        if responsibilities:
            resp_score = 0.0
            for resp in responsibilities:
                resp_lower = resp.lower()
                keywords = [w for w in resp_lower.replace(",", "").replace(".", "").split() if len(w) > 4]
                if keywords:
                    matches = sum(1 for kw in keywords if kw in candidate_text)
                    resp_score += (matches / len(keywords))
            score_components.append(resp_score / len(responsibilities))

        return sum(score_components) / len(score_components) if score_components else 0.5

    def _calculate_requirement_compliance(self, candidate: Candidate, requirements: list, prerequisites: list) -> float:
        """
        Validates candidate qualifications against key requirements and inferred prerequisites.
        Returns a score in range [0.0, 1.0].
        """
        if not requirements and not prerequisites:
            return 0.5

        candidate_text = (candidate.resume_text or "").lower()
        original_text = candidate.resume_text or ""
        score_components = []
        
        c_skills = {s.lower() for s in (candidate.skills or [])}
        for skill in c_skills:
            candidate_text += f" {skill}"
        for job in (candidate.career_history or []):
            candidate_text += f" {(job.get('title') or '').lower()} {(job.get('description') or '').lower()}"

        # 1. Key requirements match
        if requirements:
            req_matches = 0
            for req in requirements:
                req_lower = req.lower()
                import re
                years_match = re.search(r'(\d+)\+?\s*years?', req_lower)
                if years_match:
                    req_years = int(years_match.group(1))
                    total_months = 0
                    for job in (candidate.career_history or []):
                        total_months += job.get("duration_months", 12) or 12
                    cand_years = total_months / 12.0
                    if cand_years >= req_years:
                        req_matches += 1.0
                        continue
                        
                if _skill_has_text_evidence(original_text, req):
                    req_matches += 1.0
                    continue
                        
                words = [w for w in req_lower.split() if len(w) > 4]
                if words:
                    match_ratio = sum(1 for w in words if w in candidate_text) / len(words)
                    req_matches += match_ratio
                else:
                    req_matches += 1.0 if req_lower in candidate_text else 0.0
            score_components.append(req_matches / len(requirements))

        # 2. Inferred prerequisites (skills checklist)
        if prerequisites:
            prereq_matches = 0
            for prereq in prerequisites:
                p_lower = prereq.lower()
                if p_lower in c_skills:
                    prereq_matches += 1.0
                elif _skill_has_text_evidence(original_text, prereq):
                    prereq_matches += 0.6
            score_components.append(prereq_matches / len(prerequisites))

        return sum(score_components) / len(score_components) if score_components else 0.5

    def _calculate_leadership_match(self, candidate: Candidate, leadership_reqs: list) -> float:
        """
        Evaluates candidate's alignment with job's leadership requirements.
        Returns a score in range [0.0, 1.0].
        """
        LEADERSHIP_TITLES = {"lead", "staff", "principal", "manager", "director", "architect", "head", "vp"}
        
        has_leadership_role = False
        for job in (candidate.career_history or []):
            title = (job.get("title") or "").lower()
            if any(lt in title for lt in LEADERSHIP_TITLES):
                has_leadership_role = True
                break
                
        linkedin_score = 0.5
        if candidate.linkedin_intelligence and "leadership_score" in candidate.linkedin_intelligence:
            linkedin_score = candidate.linkedin_intelligence["leadership_score"]

        # Build candidate full text to scan for leadership markers
        candidate_text = (candidate.resume_text or "").lower()
        c_skills = {s.lower() for s in (candidate.skills or [])}
        for skill in c_skills:
            candidate_text += f" {skill}"
        for job in (candidate.career_history or []):
            candidate_text += f" {(job.get('title') or '').lower()} {(job.get('description') or '').lower()}"

        leadership_verbs = ["led", "managed", "mentored", "architected", "launched", "scaled", "hired", "spearheaded"]
        verb_matches = sum(1 for verb in leadership_verbs if verb in candidate_text)
        verb_score = min(1.0, verb_matches / 4.0)

        base_score = 0.4
        if has_leadership_role:
            base_score += 0.4
        base_score += 0.2 * verb_score

        final_leadership = 0.6 * base_score + 0.4 * linkedin_score

        if leadership_reqs:
            req_score = 0.0
            for req in leadership_reqs:
                req_lower = req.lower()
                if req_lower in candidate_text:
                    req_score += 1.0
                else:
                    words = [w for w in req_lower.split() if len(w) >= 4]
                    if words:
                        req_score += sum(1 for w in words if w in candidate_text) / len(words)
            final_leadership = 0.8 * final_leadership + 0.2 * (req_score / len(leadership_reqs))

        return min(1.0, max(0.0, final_leadership))

    def _calculate_hidden_fit(self, candidate: Candidate, hidden_reqs: list) -> float:
        """
        Checks candidate traits against hidden job requirements.
        Returns a score in range [0.0, 1.0].
        """
        if not hidden_reqs:
            return 0.5

        candidate_text = (candidate.resume_text or "").lower()
        for job in (candidate.career_history or []):
            candidate_text += f" {(job.get('description') or '').lower()}"

        github_stats = candidate.github_stats or {}
        has_github = bool(github_stats) and github_stats.get("source") != "fallback"

        score = 0.0
        for req in hidden_reqs:
            req_lower = req.lower()
            req_score = 0.0
            
            if "test" in req_lower or "quality" in req_lower or "maturity" in req_lower:
                if has_github:
                    beh_scores = behavioral_intelligence_engine.calculate_score(github_stats)
                    req_score = beh_scores.get("engineering_maturity", 0.5)
                else:
                    req_score = 1.0 if "test" in candidate_text or "tdd" in candidate_text or "unittest" in candidate_text else 0.4
            elif "fast" in req_lower or "startup" in req_lower or "iteration" in req_lower or "ownership" in req_lower:
                if has_github:
                    beh_scores = behavioral_intelligence_engine.calculate_score(github_stats)
                    req_score = beh_scores.get("startup_readiness", 0.5)
                else:
                    req_score = 1.0 if "startup" in candidate_text or "founded" in candidate_text or "built" in candidate_text or "speed" in candidate_text or "fast" in candidate_text else 0.4
            else:
                words = [w for w in req_lower.split() if len(w) >= 4]
                if words:
                    req_score = sum(1 for w in words if w in candidate_text) / len(words)
                else:
                    req_score = 0.5

            score += req_score

        return min(1.0, max(0.0, score / len(hidden_reqs)))

    def _get_missing_required_skills(self, candidate_skills: list, required_skills: list) -> list:
        if not required_skills:
            return []
        c_set = {s.lower() for s in (candidate_skills or [])}
        return [skill for skill in required_skills if skill.lower() not in c_set]

    def _build_resume_preview(self, resume_text: str | None, max_len: int = 220) -> str:
        text = (resume_text or "").strip()
        if not text:
            return "No resume text available."
        normalized = " ".join(text.split())
        if len(normalized) <= max_len:
            return normalized
        return normalized[:max_len].rstrip() + "..."

    def _evaluate_disqualification(
        self,
        *,
        direct_match_ratio: float,
        semantic_score: float,
        transferable_val: float,
        adjacent_only_score: float,
        final_score: float,
        semantic_threshold: float,
        overall_threshold: float,
    ) -> tuple[bool, list[str]]:
        reasons = []
        is_disqualified = False

        has_direct_skills = direct_match_ratio >= 0.08
        has_adjacent_skills = adjacent_only_score >= 0.08
        has_transferable_skills = transferable_val >= 0.12
        has_skill_signal = has_direct_skills or has_adjacent_skills or has_transferable_skills
        has_semantic_signal = semantic_score >= semantic_threshold

        # 1. Overall score only disqualifies when there is no meaningful skill alignment
        if final_score < overall_threshold and not has_skill_signal:
            reasons.append("Overall ranking score below threshold with weak skill alignment")
            is_disqualified = True

        # 2. Skill mismatch — no direct, adjacent, or transferable overlap
        if not has_skill_signal:
            reasons.append("No matching required or adjacent skills explicitly listed")
            is_disqualified = True

        # 3. Semantic warning (informational; does not auto-disqualify on its own)
        if not has_semantic_signal:
            reasons.append("Semantic fit below threshold")

        # 4. Disqualify only when semantic fit AND explicit skill matches are both weak
        if (not has_semantic_signal) and (direct_match_ratio < 0.15 and adjacent_only_score < 0.15 and not has_transferable_skills):
            is_disqualified = True
            if "Poor semantic fit combined with low skill match" not in reasons:
                reasons.append("Poor semantic fit combined with low skill match")

        # 5. Critical mismatch — only for profiles with near-zero relevance on all axes
        if (
            semantic_score < (semantic_threshold * 0.5)
            and direct_match_ratio < 0.05
            and adjacent_only_score < 0.05
            and not has_transferable_skills
            and final_score < overall_threshold
        ):
            is_disqualified = True
            if "Critical semantic mismatch with job requirements" not in reasons:
                reasons.append("Critical semantic mismatch with job requirements")

        return is_disqualified, reasons

    def _flatten_ranking_result(self, result: dict | list) -> list:
        if isinstance(result, dict):
            return result.get("ranked", []) + result.get("disqualified", [])
        return result or []

    def _calculate_heuristic_score(self, candidate: Candidate) -> tuple[float, str]:
        """Calculates custom Redrob AI Engineer heuristic score and reasoning."""
        import re
        
        CORE_SKILLS = {
            'sentence-transformers', 'openai embeddings', 'bge', 'e5',
            'pinecone', 'weaviate', 'qdrant', 'milvus', 'opensearch', 'elasticsearch', 'faiss',
            'python', 'ndcg', 'mrr', 'map', 'a/b test', 'ab test'
        }
        NICE_TO_HAVE_SKILLS = {
            'lora', 'qlora', 'peft', 'xgboost', 'learning-to-rank', 'learning to rank',
            'distributed systems', 'large-scale inference'
        }
        CONSULTING_FIRMS = {
            'tcs', 'infosys', 'wipro', 'accenture', 'cognizant', 'capgemini', 'mindtree',
            'tata consultancy', 'ibm', 'deloitte', 'pwc', 'ey', 'kpmg'
        }
        RETRIEVAL_RANKING_REGEX = re.compile(r'\b(retrieval|ranking|search|recommendation system|recsys|vector db|vector database|embeddings?)\b', re.IGNORECASE)
        CV_ROBOTICS_REGEX = re.compile(r'\b(computer vision|speech|robotics|image classification)\b', re.IGNORECASE)
        NLP_REGEX = re.compile(r'\b(nlp|natural language|text processing|ir|information retrieval)\b', re.IGNORECASE)

        score = 0.0
        disqualifiers = []
        
        career = candidate.career_history or []
        skills = candidate.skills or []
        redrob = candidate.redrob_signals or {}
        
        total_career_months = sum(job.get('duration_months', 0) for job in career if job.get('duration_months'))
        yoe = total_career_months / 12.0
        
        latest_title = "AI Engineer"
        latest_company = "Tech Co"
        if career:
            latest_job = career[0]
            latest_title = latest_job.get('title', latest_title)
            latest_company = latest_job.get('company', latest_company)
            
        if 6 <= yoe <= 8:
            score += 15.0
        elif yoe >= 2:
            score += 10.0
        else:
            score += 5.0
            
        core_matches = 0
        nice_matches = 0
        core_skills_found = set()
        
        for s in skills:
            s_lower = s.lower()
            for core in CORE_SKILLS:
                if core in s_lower:
                    core_matches += 1.0
                    core_skills_found.add(core)
                    break
            for nice in NICE_TO_HAVE_SKILLS:
                if nice in s_lower:
                    nice_matches += 1.0
                    break
                    
        score += min(20.0, core_matches * 3.0)
        score += min(5.0, nice_matches * 1.5)
        
        consulting_job_count = 0
        product_job_count = 0
        retrieval_mentions = 0
        cv_mentions = 0
        nlp_mentions = 0
        
        for job in career:
            company = job.get('company', '').lower()
            desc = job.get('description', '')
            
            is_consulting = any(c in company for c in CONSULTING_FIRMS)
            if is_consulting:
                consulting_job_count += 1
            else:
                product_job_count += 1
                
            if RETRIEVAL_RANKING_REGEX.search(desc):
                retrieval_mentions += 1
            if CV_ROBOTICS_REGEX.search(desc):
                cv_mentions += 1
            if NLP_REGEX.search(desc):
                nlp_mentions += 1
                
        if product_job_count == 0 and consulting_job_count > 0:
            score -= 8.0
        elif product_job_count > 0:
            score += 10.0
            
        if retrieval_mentions > 0:
            score += 25.0
            
        if cv_mentions > 0 and nlp_mentions == 0 and retrieval_mentions == 0:
            score -= 5.0
            
        np_days = redrob.get('notice_period_days', 90)
        if np_days <= 30:
            score += 5.0
        elif np_days > 60:
            score -= 3.0
            
        loc = (candidate.location or '').lower()
        loc_bonus = False
        if any(city in loc for city in ['pune', 'noida']):
            score += 10.0
            loc_bonus = True
        elif any(city in loc for city in ['hyderabad', 'mumbai', 'delhi', 'ncr', 'bangalore', 'bengaluru', 'chennai', 'remote']):
            score += 5.0
        else:
            score -= 3.0
            
        if disqualifiers:
            score -= len(disqualifiers) * 3
            
        narrative_parts = []
        narrative_parts.append(f"{latest_title} at {latest_company} with {round(yoe, 1)} years of experience.")
        
        if retrieval_mentions > 0:
            if core_skills_found:
                top_skills = [s.title() for s in list(core_skills_found)[:3]]
                narrative_parts.append(f"Strong production evidence building retrieval/ranking systems using {', '.join(top_skills)}.")
            else:
                narrative_parts.append("Has built retrieval/ranking systems in production.")
        else:
            if len(core_skills_found) >= 2:
                top_skills = [s.title() for s in list(core_skills_found)[:3]]
                narrative_parts.append(f"Matches core AI stack ({', '.join(top_skills)}).")
            else:
                narrative_parts.append("Solid backend ML experience.")
                
        if np_days <= 30:
            narrative_parts.append(f"Can join immediately ({np_days} days notice).")
        
        if loc_bonus:
            narrative_parts.append("Based in preferred location.")
            
        if disqualifiers:
            narrative_parts.append(f"Concerns: {', '.join(disqualifiers)}.")
            
        max_possible = 95.0
        normalized = min(1.0, max(0.0, score / max_possible))
        return normalized, " ".join(narrative_parts)

    def rank_candidates(
        self,
        db: Session,
        job_id: int,
        weights: dict = None,
        semantic_threshold: float | None = None,
        overall_threshold: float | None = None,
    ) -> dict:
        """
        Executes the full retrieval and ranking pipeline.
        Returns ranked and disqualified candidate buckets with analytics metadata.
        """
        semantic_threshold = (
            semantic_threshold
            if semantic_threshold is not None
            else settings.DISQUALIFY_SEMANTIC_THRESHOLD
        )
        overall_threshold = (
            overall_threshold
            if overall_threshold is not None
            else settings.DISQUALIFY_OVERALL_THRESHOLD
        )

        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            return {
                "ranked": [],
                "disqualified": [],
                "analytics": {"total_processed": 0, "ranked_count": 0, "disqualified_count": 0},
                "thresholds": {
                    "semantic_threshold": semantic_threshold,
                    "overall_threshold": overall_threshold,
                },
            }

        default_weights = {
            "semantic": 1.0,           # Critical: Direct JD embedding match
            "adjacency": 0.9,          # Critical: Direct skill requirement match
            "domain_expertise": 0.85,  # High: Job domain alignment
            "skill_transferability": 0.7,
            "trajectory": 0.5,
            "behavioral": 0.4,
            "success": 0.5,
            "learning": 0.4,
            "market": 0.3,
            "potential": 0.5,
            "career_growth_momentum": 0.5,
            "startup_readiness": 0.3,
            "leadership_impact": 0.4,
            "open_source_influence": 0.2,
            "learning_agility": 0.4,
            "team_complement_score": 0.5,
            "retention_prediction": 0.4,
            "interview_success_prediction": 0.5
        }
        active_weights = {**default_weights, **(weights or {})}

        query_text = f"{job.title} {job.description}"
        query_vector = llm_service.get_embedding(query_text)
        is_embedding_failed = all(v == 0.0 for v in query_vector)
        
        qdrant_results = qdrant_manager.search_candidates(query_vector, limit=50)
        semantic_scores = {res["candidate_id"]: res["score"] for res in qdrant_results}

        # Always rank every candidate in the database. Qdrant top-k only supplies
        # semantic scores; newly uploaded resumes must not be excluded from ranking.
        candidates = db.query(Candidate).all()
        if not candidates:
            return {
                "ranked": [],
                "disqualified": [],
                "analytics": {"total_processed": 0, "ranked_count": 0, "disqualified_count": 0},
                "thresholds": {
                    "semantic_threshold": semantic_threshold,
                    "overall_threshold": overall_threshold,
                },
            }
        for candidate in candidates:
            semantic_scores.setdefault(candidate.id, 0.5)

        team_skills = self.get_team_skills(db)
        j_skills = job.graph_schema.get("skills_required", []) if job.graph_schema else []
        job_context = {
            "title": job.title,
            "description": job.description[:500],
            "skills_required": j_skills
        }

        db_updates_needed = False
        scored_candidates = []
        for candidate in candidates:
            # Ensure LinkedIn intelligence is generated
            if not candidate.linkedin_intelligence:
                candidate.linkedin_intelligence = linkedin_intelligence_engine.analyze(
                    career_history=candidate.career_history,
                    skills=candidate.skills,
                    certifications=candidate.certifications,
                    education=candidate.education,
                    github_stats=candidate.github_stats,
                    behavioral_profile=candidate.behavioral_profile
                )
                db.add(candidate)
                db_updates_needed = True

            c_skills = candidate.skills or []

            direct_match_ratio = skill_adjacency_engine.calculate_direct_match_ratio(c_skills, j_skills)
            adjacent_only_score = skill_adjacency_engine.calculate_adjacent_only_match(db, c_skills, j_skills)
            adjacency_score = skill_adjacency_engine.calculate_match(db, c_skills, j_skills)
            target_level = (job.graph_schema.get("experience_level") if job.graph_schema else None) or "SENIOR"
            trajectory_metrics = career_trajectory_engine.calculate_score(candidate.career_history or [], target_level)
            behavioral_metrics = behavioral_intelligence_engine.calculate_score(candidate.github_stats or {})
            success_metrics = success_potential_engine.calculate_score(candidate.career_history or [], trajectory_metrics)
            learning_velocity = market_intelligence_engine.calculate_learning_velocity(c_skills, candidate.career_history or [])
            market_score = market_intelligence_engine.calculate_market_score(c_skills)
            
            profile_eval = {
                "learning_velocity": learning_velocity,
                "behavioral_score": behavioral_metrics["overall"],
                "trajectory_score": trajectory_metrics["overall"],
                "stability_score": trajectory_metrics["stability_score"],
                "market_score": market_score,
                "leadership_score": success_metrics["leadership_potential"]
            }
            benchmark_profile = job.benchmark_profile or "GENERAL_ENGINEER"
            benchmark_compatibility = market_intelligence_engine.evaluate_benchmark(profile_eval, benchmark_profile)

            sem_score = semantic_scores.get(candidate.id, 0.5)
            if is_embedding_failed or sem_score == 0.5:
                c_skills_set = {s.lower() for s in c_skills} if c_skills else set()
                j_skills_set = {s.lower() for s in j_skills}
                if j_skills_set:
                    overlap_score = len(c_skills_set.intersection(j_skills_set)) / len(j_skills_set)
                    sem_score = max(sem_score, overlap_score, adjacency_score * 0.75)
                else:
                    sem_score = max(sem_score, 0.5)

            team_gap_val = self.calculate_team_gap_score(c_skills, j_skills, team_skills)
            transferable_val = max(
                adjacent_only_score * 0.85,
                max(0.0, adjacency_score - direct_match_ratio) if adjacency_score > direct_match_ratio else 0.0,
            )

            # Deep Job Understanding evaluations
            schema = job.graph_schema or {}
            domains = schema.get("domains", [])
            reqs = schema.get("key_requirements", [])
            prereqs = schema.get("inferred_prerequisites", [])
            leadership_reqs = schema.get("leadership_requirements", [])
            hidden_reqs = schema.get("hidden_requirements", [])
            responsibilities = schema.get("responsibilities", [])

            domain_alignment_score = self._calculate_domain_alignment(candidate, domains, responsibilities)
            requirement_compliance_score = self._calculate_requirement_compliance(candidate, reqs, prereqs)
            leadership_match_score = self._calculate_leadership_match(candidate, leadership_reqs)
            hidden_fit_score = self._calculate_hidden_fit(candidate, hidden_reqs)

            mixed_sem_score = 0.7 * sem_score + 0.3 * requirement_compliance_score

            factors = {
                "semantic": mixed_sem_score,
                "adjacency": adjacency_score,
                "trajectory": trajectory_metrics["overall"],
                "behavioral": behavioral_metrics["overall"],
                "success": success_metrics["success_probability"],
                "learning": learning_velocity,
                "market": market_score,
                "potential": (success_metrics["growth_trajectory"] + leadership_match_score) / 2.0,
                "skill_transferability": transferable_val,
                "career_growth_momentum": trajectory_metrics.get("promo_velocity", 0.5),
                "startup_readiness": (behavioral_metrics.get("startup_readiness", 0.5) + hidden_fit_score) / 2.0,
                "leadership_impact": (success_metrics.get("leadership_potential", 0.5) + leadership_match_score) / 2.0,
                "open_source_influence": behavioral_metrics.get("open_source_influence", 0.5),
                "learning_agility": learning_velocity,
                "domain_expertise": (sem_score + trajectory_metrics.get("level_alignment", 0.5) + domain_alignment_score) / 3.0,
                "team_complement_score": team_gap_val,
                "retention_prediction": success_metrics.get("retention_prediction", 0.5),
                "interview_success_prediction": (behavioral_metrics.get("behavioral_score", 0.5) + success_metrics.get("success_probability", 0.5) + hidden_fit_score) / 3.0
            }

            # --- REDROB SIGNALS INTEGRATION ---
            redrob = candidate.redrob_signals or {}
            redrob_boost = 0.0
            
            if redrob:
                github_activity_score = redrob.get("github_activity_score")
                if github_activity_score is not None:
                    factors["behavioral"] = min(1.0, max(0.0, github_activity_score / 10.0))
                
                interview_rate = redrob.get("interview_completion_rate")
                offer_rate = redrob.get("offer_acceptance_rate")
                if interview_rate is not None and offer_rate is not None:
                    engagement_modifier = (interview_rate + offer_rate) / 2.0
                    factors["retention_prediction"] = (factors["retention_prediction"] + engagement_modifier) / 2.0
                
                assessments = redrob.get("skill_assessment_scores", {})
                if assessments:
                    high_scores = sum(1 for val in assessments.values() if val > 50)
                    if high_scores > 0:
                        redrob_boost += 0.05 * high_scores
                        
                if redrob.get("recruiter_response_rate", 0) > 0.3:
                    redrob_boost += 0.05

            total_active_weight = sum(active_weights.values())
            raw_score = 0.0
            for f_name, f_val in factors.items():
                w = active_weights.get(f_name, 0.5)
                contribution = w * f_val
                max_contribution = 0.25 * total_active_weight
                if contribution > max_contribution:
                    contribution = max_contribution
                raw_score += contribution
            
            raw_score = raw_score / (total_active_weight if total_active_weight > 0 else 1.0)

            final_score = raw_score * (1.0 + self.beta * team_gap_val) * (1.0 + self.gamma * transferable_val)
            final_score = final_score * (1.0 + self.alpha * benchmark_compatibility)
            # Add hidden fit boost (up to 10% bonus modifier)
            final_score = final_score * (1.0 + 0.10 * hidden_fit_score)
            
            # Apply Redrob signal boost
            final_score = final_score * (1.0 + redrob_boost)
            final_score = min(1.0, max(0.0, final_score))

            # Role-specific heuristic: metadata + light boost, never replaces multi-factor score
            heuristic_score, heuristic_reasoning = self._calculate_heuristic_score(candidate)
            candidate.ranking_explanations = candidate.ranking_explanations or {}
            candidate.ranking_explanations["heuristic_reasoning"] = heuristic_reasoning
            candidate.ranking_explanations["heuristic_score"] = round(heuristic_score, 3)
            if heuristic_score > 0.45:
                heuristic_boost = min(0.08, (heuristic_score - 0.45) * 0.2)
                final_score = min(1.0, final_score * (1.0 + heuristic_boost))

            factor_breakdown = {
                "skills": round((factors["semantic"] + factors["adjacency"] + factors["skill_transferability"]) / 3 * 100, 1),
                "experience": round((factors["trajectory"] + factors["career_growth_momentum"] + factors["domain_expertise"]) / 3 * 100, 1),
                "github": round((factors["behavioral"] + factors["open_source_influence"]) / 2 * 100, 1),
                "leadership": round((factors["leadership_impact"] + factors["potential"]) / 2 * 100, 1),
                "culture": round((factors["startup_readiness"] + factors["team_complement_score"] + factors["retention_prediction"]) / 3 * 100, 1)
            }

            confidence_score = self._calculate_confidence_score(candidate)
            missing_required_skills = self._get_missing_required_skills(c_skills, j_skills)
            is_disqualified, disqualify_reasons = self._evaluate_disqualification(
                direct_match_ratio=direct_match_ratio,
                semantic_score=sem_score,
                transferable_val=transferable_val,
                adjacent_only_score=adjacent_only_score,
                final_score=final_score,
                semantic_threshold=semantic_threshold,
                overall_threshold=overall_threshold,
            )

            scored_candidates.append({
                "candidate": candidate,
                "raw_score": round(raw_score, 3),
                "final_score": round(final_score, 3),
                "overall_score": int(round(final_score * 100, 0)),
                "factor_breakdown": factor_breakdown,
                "confidence_score": confidence_score,
                "factors": {k: round(v, 2) for k, v in factors.items()},
                "modifiers": {
                    "team_gap_score": round(team_gap_val, 2),
                    "transferable_skills": round(transferable_val, 2),
                    "benchmark_compatibility": round(benchmark_compatibility, 2),
                    "domain_alignment": round(domain_alignment_score, 2),
                    "requirement_compliance": round(requirement_compliance_score, 2),
                    "leadership_match": round(leadership_match_score, 2),
                    "hidden_fit": round(hidden_fit_score, 2),
                    "direct_skill_match": round(direct_match_ratio, 2),
                    "adjacent_skill_match": round(adjacent_only_score, 2),
                    "heuristic_score": round(heuristic_score, 2),
                    "redrob_boost": round(redrob_boost, 2),
                },
                "trajectory_details": trajectory_metrics,
                "behavioral_details": behavioral_metrics,
                "success_details": success_metrics,
                "market_details": {
                    "learning_velocity": learning_velocity,
                    "market_score": market_score
                },
                "missing_required_skills": missing_required_skills,
                "resume_preview": self._build_resume_preview(candidate.resume_text),
                "status": "disqualified" if is_disqualified else "ranked",
                "reason": disqualify_reasons,
                "direct_match_ratio": direct_match_ratio,
                "semantic_score_raw": round(sem_score, 3),
            })

        scored_candidates.sort(key=lambda x: x["final_score"], reverse=True)

        ranked_output = []
        disqualified_output = []
        for rank_idx, item in enumerate(scored_candidates):
            c = item["candidate"]
            is_disqualified = item["status"] == "disqualified"

            # Compute benchmark match and percentiles
            benchmark_res = benchmarking_engine.compute_percentiles(item["factors"])

            # Update latest benchmark data on candidate
            c.benchmark_data = benchmark_res
            db.add(c)
            db_updates_needed = True

            # Compute ranking audit trail
            audit_res = ranking_audit_engine.generate_audit(
                factors=item["factors"],
                weights=active_weights,
                modifiers=item["modifiers"],
                raw_score=item["raw_score"],
                final_score=item["final_score"]
            )

            candidate_brief = {
                "id": c.id,
                "name": c.name,
                "skills": c.skills or [],
                "final_score": item["final_score"],
                "factors": item["factors"],
                "career_summary": (c.career_history[0].get("title", "") + " at " + c.career_history[0].get("company", "")) if c.career_history else "N/A"
            }

            explanation = self._get_cached_explanation(c.id, job_id)
            if not explanation:
                ranked_position = len(ranked_output)
                if not is_disqualified and ranked_position < 10:
                    explanation = self._generate_llm_explanation(candidate_brief, job_context)
                else:
                    explanation = self._generate_rule_based_explanation(candidate_brief, j_skills)
                self._set_cached_explanation(c.id, job_id, explanation)

            candidate_payload = {
                "rank": None if is_disqualified else len(ranked_output) + 1,
                "id": c.id,
                "name": c.name,
                "email": c.email,
                "skills": c.skills or [],
                "github_username": c.github_username,
                "overall_score": item["overall_score"],
                "confidence_score": item["confidence_score"],
                "factor_breakdown": item["factor_breakdown"],
                "explanation": explanation,
                "recommended_action": explanation.get("recommended_action", "Consider"),
                "final_score": item["final_score"],
                "raw_score": item["raw_score"],
                "factors": item["factors"],
                "modifiers": item["modifiers"],
                "trajectory_details": item["trajectory_details"],
                "behavioral_details": item["behavioral_details"],
                "success_details": item["success_details"],
                "market_details": item["market_details"],
                "is_llm_verified": (not is_disqualified) and len(ranked_output) < 10,
                "phone": c.phone,
                "location": c.location,
                "education": c.education or [],
                "career_history": c.career_history or [],
                "github_url": c.github_url,
                "linkedin_url": c.linkedin_url,
                "portfolio_url": c.portfolio_url,
                "personal_website": c.personal_website,
                "twitter_x": c.twitter_x,
                "behavioral_profile": c.behavioral_profile,
                "linkedin_intelligence": c.linkedin_intelligence,
                "benchmark_data": benchmark_res,
                "ranking_audit": audit_res,
                "missing_required_skills": item["missing_required_skills"],
                "resume_preview": item["resume_preview"],
                "direct_match_ratio": round(item["direct_match_ratio"], 3),
                "semantic_score_raw": item["semantic_score_raw"],
            }

            if is_disqualified:
                candidate_payload["status"] = "disqualified"
                candidate_payload["reason"] = item["reason"]
                disqualified_output.append(candidate_payload)
            else:
                candidate_payload["status"] = "ranked"
                candidate_payload["reason"] = []
                ranked_output.append(candidate_payload)

        if db_updates_needed:
            try:
                db.commit()
            except Exception as e:
                logger.error(f"Failed to commit updated candidate intelligence data: {e}")
                db.rollback()

        total_processed = len(ranked_output) + len(disqualified_output)
        return {
            "ranked": ranked_output,
            "disqualified": disqualified_output,
            "analytics": {
                "total_processed": total_processed,
                "ranked_count": len(ranked_output),
                "disqualified_count": len(disqualified_output),
            },
            "thresholds": {
                "semantic_threshold": semantic_threshold,
                "overall_threshold": overall_threshold,
            },
        }

ranking_engine = RankingEngine()
