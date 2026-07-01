import logging

logger = logging.getLogger(__name__)

class CareerTrajectoryEngine:
    def __init__(self):
        self.level_hierarchy = {
            "JUNIOR": 1,
            "MID": 2,
            "SENIOR": 3,
            "LEAD": 4,
            "STAFF": 5,
            "PRINCIPAL": 6
        }

    def calculate_score(self, career_history: list, target_level: str) -> dict:
        """
        Calculates career trajectory signals:
        - promo_velocity: Speed of seniority growth (0.0 to 1.0)
        - stability_score: Average job tenure (0.0 to 1.0)
        - level_alignment: Matching of current seniority to target_level (0.0 to 1.0)
        - overall_score: Weighted average of the three
        """
        if not career_history:
            return {"promo_velocity": 0.5, "stability_score": 0.5, "level_alignment": 0.5, "overall": 0.5}

        # 1. Stability Score (Average Tenure in months)
        # Ideal tenure for startup/tech is ~24-36 months. Less than 12 is low stability.
        tenures = []
        levels = []
        for job in career_history:
            duration = job.get("duration_months", 12) or 12
            tenures.append(duration)
            
            seniority = job.get("seniority", "MID").upper()
            levels.append(self.level_hierarchy.get(seniority, 2))

        avg_tenure = sum(tenures) / len(tenures) if tenures else 12
        if avg_tenure >= 24:
            stability_score = 1.0
        elif avg_tenure >= 12:
            stability_score = 0.5 + 0.5 * ((avg_tenure - 12) / 12)
        else:
            stability_score = 0.1 + 0.4 * (avg_tenure / 12)

        # 2. Promotion Velocity
        # Measured by the slope of level changes over time.
        # If they climbed 3 levels in 36 months, velocity is high.
        if len(levels) > 1:
            level_diff = levels[0] - levels[-1]  # levels list should represent [recent_job, ..., oldest_job]
            total_duration = sum(tenures)
            if total_duration > 0 and level_diff > 0:
                # Levels climbed per year
                velocity = (level_diff / (total_duration / 12.0))
                # Normalize: 0.5 levels climbed per year is very good (e.g. junior to senior in 4 years)
                promo_velocity = min(1.0, 0.2 + (velocity * 0.8))
            else:
                # Stagnant or flat level
                promo_velocity = 0.4
        else:
            # Single job history
            promo_velocity = 0.5

        # 3. Level Alignment
        # Compare current (most recent) job level to job requirement level
        current_level = levels[0] if levels else 2
        target_val = self.level_hierarchy.get((target_level or "SENIOR").upper(), 3)

        diff = current_level - target_val
        if diff == 0:
            level_alignment = 1.0
        elif diff > 0:
            # Overqualified (e.g., Staff candidate applying for Mid level) - still matches
            level_alignment = 0.95
        else:
            # Underqualified
            # 1 level below = 0.7, 2 levels below = 0.4
            level_alignment = max(0.2, 1.0 - 0.3 * abs(diff))

        overall = 0.3 * stability_score + 0.3 * promo_velocity + 0.4 * level_alignment

        return {
            "promo_velocity": round(promo_velocity, 2),
            "stability_score": round(stability_score, 2),
            "level_alignment": round(level_alignment, 2),
            "overall": round(overall, 2)
        }

career_trajectory_engine = CareerTrajectoryEngine()
