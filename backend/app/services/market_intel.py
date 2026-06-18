import logging

logger = logging.getLogger(__name__)

class MarketIntelligenceEngine:
    def __init__(self):
        # Hot/emerging technologies in current industry
        self.trending_skills = {
            "pytorch": 0.95,
            "rust": 0.90,
            "next.js": 0.85,
            "fastapi": 0.80,
            "qdrant": 0.90,
            "openai": 0.95,
            "gemini": 0.90,
            "langchain": 0.85,
            "kubernetes": 0.80,
            "mojo": 0.70,
            "webgpu": 0.75,
            "typescript": 0.85
        }

    def calculate_learning_velocity(self, skills: list, career_history: list) -> float:
        """
        Calculates skill acquisition rate.
        If a candidate has a wide set of skills but shorter total career experience, 
        their learning velocity is high.
        """
        if not skills:
            return 0.3
            
        total_months = 0
        if career_history:
            total_months = sum(job.get("duration_months", 12) or 12 for job in career_history)
            
        years_exp = max(0.5, total_months / 12.0)
        skills_count = len(skills)
        
        # Rate of skills acquired per year
        rate = skills_count / years_exp
        
        # Normalize: rate of 3 skills/year is high (score = 1.0)
        velocity = min(1.0, 0.2 + 0.8 * (rate / 3.0))
        return round(velocity, 2)

    def calculate_market_score(self, skills: list) -> float:
        """Calculates matching score against trending skills"""
        if not skills:
            return 0.3

        scores = []
        for s in skills:
            s_lower = s.lower()
            if s_lower in self.trending_skills:
                scores.append(self.trending_skills[s_lower])
            else:
                scores.append(0.4) # baseline for older/static skills
                
        return round(sum(scores) / len(scores), 2)

    def evaluate_benchmark(self, profile_data: dict, benchmark_profile: str) -> float:
        """
        Evaluates candidate against standard industry recruiting benchmarks:
        - YC_FOUNDING_ENGINEER: High learning velocity, active github builds, high tech trend alignment
        - FAANG_STAFF: Long tenure, leadership roles, complex backend/system skills
        - GENERAL_ENGINEER: Balanced requirements
        """
        benchmark = benchmark_profile.upper()
        
        # Extract individual signals
        learning_vel = profile_data.get("learning_velocity", 0.5)
        github_beh = profile_data.get("behavioral_score", 0.5)
        trajectory = profile_data.get("trajectory_score", 0.5)
        stability = profile_data.get("stability_score", 0.5)
        market_score = profile_data.get("market_score", 0.5)
        leadership = profile_data.get("leadership_score", 0.5)

        if benchmark == "YC_FOUNDING_ENGINEER":
            score = 0.35 * learning_vel + 0.35 * github_beh + 0.3 * market_score
        elif benchmark == "FAANG_STAFF":
            score = 0.35 * trajectory + 0.35 * leadership + 0.3 * stability
        else:
            score = 0.25 * learning_vel + 0.25 * trajectory + 0.25 * github_beh + 0.25 * market_score

        return round(score, 2)

market_intelligence_engine = MarketIntelligenceEngine()
