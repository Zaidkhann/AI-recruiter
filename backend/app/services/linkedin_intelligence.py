"""
LinkedIn Intelligence Engine
Synthesizes professional intelligence scores from candidate data
(career history, certifications, education, skills).

This is a simulated approach — real LinkedIn scraping violates their ToS.
Instead, we analyze the rich structured data already present in our system
and produce equivalent intelligence signals.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Seniority level hierarchy for career progression analysis
SENIORITY_LEVELS = {
    "intern": 0,
    "junior": 1,
    "mid": 2,
    "senior": 3,
    "lead": 4,
    "staff": 5,
    "principal": 6,
    "director": 7,
    "vp": 8,
    "cto": 9,
    "ceo": 10,
}

# High-authority certifications that boost industry authority
HIGH_VALUE_CERTIFICATIONS = {
    "aws certified solutions architect",
    "aws certified developer",
    "google cloud professional",
    "certified kubernetes administrator",
    "cka",
    "ckad",
    "terraform associate",
    "azure solutions architect",
    "pmp",
    "cissp",
    "professional scrum master",
    "google professional machine learning engineer",
}


class LinkedInIntelligenceEngine:
    """Synthesizes LinkedIn-equivalent intelligence from candidate data."""

    def analyze(
        self,
        career_history: Optional[list] = None,
        skills: Optional[list] = None,
        certifications: Optional[list] = None,
        education: Optional[list] = None,
        github_stats: Optional[dict] = None,
        behavioral_profile: Optional[dict] = None,
    ) -> dict:
        """
        Produces 6 intelligence dimensions from candidate data.
        Returns scores in [0.0, 1.0] range.
        """
        career_history = career_history or []
        skills = skills or []
        certifications = certifications or []
        education = education or []
        github_stats = github_stats or {}
        behavioral_profile = behavioral_profile or {}

        professional_score = self._calculate_professional_score(career_history, skills, education)
        leadership_score = self._calculate_leadership_score(career_history)
        industry_authority = self._calculate_industry_authority(certifications, skills, career_history)
        career_progression = self._calculate_career_progression(career_history)
        certification_strength = self._calculate_certification_strength(certifications)
        activity_score = self._calculate_activity_score(github_stats, behavioral_profile)

        return {
            "professional_score": round(professional_score, 2),
            "leadership_score": round(leadership_score, 2),
            "industry_authority": round(industry_authority, 2),
            "career_progression": round(career_progression, 2),
            "certification_strength": round(certification_strength, 2),
            "activity_score": round(activity_score, 2),
            "overall_linkedin_score": round(
                (professional_score * 0.25 +
                 leadership_score * 0.20 +
                 industry_authority * 0.15 +
                 career_progression * 0.20 +
                 certification_strength * 0.10 +
                 activity_score * 0.10), 2
            ),
            "data_quality": self._assess_data_quality(career_history, skills, certifications, education),
        }

    def _calculate_professional_score(self, career_history: list, skills: list, education: list) -> float:
        """Derives professional strength from career depth, skill breadth, and education quality."""
        score = 0.3  # baseline

        # Career depth contribution (up to +0.3)
        total_months = sum(self._get_duration(job) for job in career_history)
        years = total_months / 12.0
        if years >= 10:
            score += 0.30
        elif years >= 5:
            score += 0.25
        elif years >= 3:
            score += 0.18
        elif years >= 1:
            score += 0.10

        # Skill breadth contribution (up to +0.2)
        skill_count = len(skills)
        if skill_count >= 12:
            score += 0.20
        elif skill_count >= 8:
            score += 0.15
        elif skill_count >= 5:
            score += 0.10
        elif skill_count >= 3:
            score += 0.05

        # Education contribution (up to +0.2)
        if education:
            has_advanced = any(
                self._is_advanced_degree(edu.get("degree", ""))
                for edu in education if isinstance(edu, dict)
            )
            if has_advanced:
                score += 0.20
            else:
                score += 0.10

        return min(1.0, score)

    def _calculate_leadership_score(self, career_history: list) -> float:
        """Derives leadership potential from seniority levels and role titles."""
        if not career_history:
            return 0.3

        score = 0.2  # baseline

        max_seniority = 0
        leadership_keywords = ["lead", "manager", "director", "head", "vp", "chief", "principal", "staff", "architect"]

        for job in career_history:
            if not isinstance(job, dict):
                continue

            # Check seniority level
            seniority = (job.get("seniority") or "mid").lower()
            level = SENIORITY_LEVELS.get(seniority, 2)
            max_seniority = max(max_seniority, level)

            # Check title for leadership keywords
            title = (job.get("title", "") or "").lower()
            for keyword in leadership_keywords:
                if keyword in title:
                    score += 0.08
                    break

            # Check description for leadership signals
            desc = (job.get("description", "") or "").lower()
            team_signals = ["led a team", "managed a team", "mentored", "supervised", "headed"]
            for signal in team_signals:
                if signal in desc:
                    score += 0.05
                    break

        # Seniority level contribution
        score += min(0.3, max_seniority * 0.05)

        return min(1.0, score)

    def _calculate_industry_authority(self, certifications: list, skills: list, career_history: list) -> float:
        """Derives industry authority from certifications, skill diversity, and career longevity."""
        score = 0.2  # baseline

        # Certification contribution (up to +0.35)
        if certifications:
            high_value_count = sum(
                1 for cert in certifications
                if cert and any(hv in cert.lower() for hv in HIGH_VALUE_CERTIFICATIONS)
            )
            score += min(0.35, high_value_count * 0.12 + len(certifications) * 0.03)

        # Skill diversity — broad skill set signals authority (up to +0.25)
        skill_categories = self._count_skill_categories(skills)
        score += min(0.25, skill_categories * 0.06)

        # Career longevity (up to +0.2)
        total_months = sum(self._get_duration(job) for job in career_history)
        years = total_months / 12.0
        if years >= 8:
            score += 0.20
        elif years >= 5:
            score += 0.15
        elif years >= 3:
            score += 0.10

        return min(1.0, score)

    def _calculate_career_progression(self, career_history: list) -> float:
        """Derives career progression velocity from promotion patterns."""
        if not career_history or len(career_history) < 2:
            return 0.4

        score = 0.3  # baseline

        # Extract seniority levels in chronological order
        levels = []
        for job in career_history:
            if not isinstance(job, dict):
                continue
            seniority = (job.get("seniority") or "mid").lower()
            level = SENIORITY_LEVELS.get(seniority, 2)
            levels.append(level)

        # Check for upward progression
        if len(levels) >= 2:
            promotions = sum(1 for i in range(1, len(levels)) if levels[i] > levels[i-1])
            demotions = sum(1 for i in range(1, len(levels)) if levels[i] < levels[i-1])
            lateral = sum(1 for i in range(1, len(levels)) if levels[i] == levels[i-1])

            total_transitions = len(levels) - 1
            if total_transitions > 0:
                promotion_rate = promotions / total_transitions
                score += promotion_rate * 0.4

            # Penalize demotions slightly
            if demotions > 0:
                score -= demotions * 0.05

            # Bonus for reaching high seniority
            max_level = max(levels) if levels else 0
            score += min(0.2, max_level * 0.03)

        # Total career span as indicator of progression opportunity
        total_months = sum(self._get_duration(job) for job in career_history)
        if total_months > 60:
            score += 0.10

        return min(1.0, max(0.0, score))

    def _calculate_certification_strength(self, certifications: list) -> float:
        """Scores certification portfolio strength."""
        if not certifications:
            return 0.15

        score = 0.2  # baseline for having any certifications

        high_value_count = 0
        for cert in certifications:
            if not cert:
                continue
            cert_lower = cert.lower()
            if any(hv in cert_lower for hv in HIGH_VALUE_CERTIFICATIONS):
                high_value_count += 1

        # High-value certs contribute heavily
        score += min(0.5, high_value_count * 0.15)
        # General certs contribute moderately
        score += min(0.3, len(certifications) * 0.05)

        return min(1.0, score)

    def _calculate_activity_score(self, github_stats: dict, behavioral_profile: dict) -> float:
        """Uses GitHub activity as proxy for professional activity signals."""
        score = 0.2  # baseline

        # GitHub contribution signals
        if github_stats:
            source = github_stats.get("source", "fallback")
            if source != "fallback":
                score += 0.15  # bonus for having real GitHub data

            activity = github_stats.get("activity", {})
            if isinstance(activity, dict):
                commits = activity.get("total_commits_estimated", 0)
                if commits > 500:
                    score += 0.25
                elif commits > 200:
                    score += 0.20
                elif commits > 50:
                    score += 0.12

                contrib_days = activity.get("contribution_days_90d", 0)
                if contrib_days > 60:
                    score += 0.15
                elif contrib_days > 30:
                    score += 0.10

        # Behavioral profile signals
        if behavioral_profile:
            overall = behavioral_profile.get("overall", 0)
            if isinstance(overall, (int, float)):
                score += overall * 0.15

        return min(1.0, score)

    # ── Helper Methods ──

    def _get_duration(self, job: dict) -> int:
        """Safely extract duration_months from a career history entry."""
        if not isinstance(job, dict):
            return 12
        return job.get("duration_months", 12) or 12

    def _is_advanced_degree(self, degree: str) -> bool:
        """Check if a degree is advanced (Masters, PhD, MBA)."""
        if not degree:
            return False
        degree_lower = degree.lower()
        return any(kw in degree_lower for kw in ["m.s.", "ms", "master", "phd", "ph.d", "mba", "doctorate"])

    def _count_skill_categories(self, skills: list) -> int:
        """Estimate the number of distinct skill categories."""
        categories = {
            "languages": {"python", "java", "javascript", "typescript", "go", "rust", "c++", "c#", "ruby", "php", "kotlin", "swift", "scala", "mojo"},
            "frontend": {"react", "vue", "angular", "next.js", "svelte", "html", "css", "tailwind", "webgpu"},
            "backend": {"fastapi", "django", "flask", "express", "spring", "node.js", "gin", "actix"},
            "devops": {"docker", "kubernetes", "terraform", "ansible", "jenkins", "github actions", "ci/cd"},
            "cloud": {"aws", "gcp", "azure", "firebase", "vercel", "cloudflare"},
            "data": {"postgresql", "mysql", "mongodb", "redis", "elasticsearch", "qdrant", "kafka", "rabbitmq"},
            "ml": {"pytorch", "tensorflow", "scikit-learn", "openai", "gemini", "langchain", "huggingface"},
        }
        matched = set()
        skills_lower = {s.lower() for s in skills if s}
        for cat, cat_skills in categories.items():
            if skills_lower & cat_skills:
                matched.add(cat)
        return len(matched)

    def _assess_data_quality(self, career_history: list, skills: list, certifications: list, education: list) -> str:
        """Assess overall data quality for confidence reporting."""
        signals = 0
        if career_history and len(career_history) >= 2:
            signals += 1
        if skills and len(skills) >= 5:
            signals += 1
        if certifications and len(certifications) >= 1:
            signals += 1
        if education and len(education) >= 1:
            signals += 1

        if signals >= 3:
            return "high"
        elif signals >= 2:
            return "medium"
        return "low"


linkedin_intelligence_engine = LinkedInIntelligenceEngine()
