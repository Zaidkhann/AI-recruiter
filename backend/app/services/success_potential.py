import logging

logger = logging.getLogger(__name__)

class SuccessPotentialEngine:
    def __init__(self):
        pass

    def calculate_score(self, career_history: list, trajectory_metrics: dict) -> dict:
        """
        Calculates predicted hiring success parameters:
        - retention_prediction: Probability of staying 18+ months (0.0 to 1.0)
        - promotion_prediction: Probability of rapid internal growth (0.0 to 1.0)
        - success_probability: Aggregate alignment index (0.0 to 1.0)
        - leadership_potential: Detected leader traits (0.0 to 1.0)
        - growth_trajectory: Combined speed of impact (0.0 to 1.0)
        """
        if not career_history:
            return {
                "retention_prediction": 0.5,
                "promotion_prediction": 0.5,
                "success_probability": 0.5,
                "leadership_potential": 0.5,
                "growth_trajectory": 0.5
            }

        # 1. Retention Prediction
        # Hopper indicators: If they have multiple jobs under 12 months, retention probability decreases.
        short_tenure_jobs = 0
        total_jobs = len(career_history)
        for job in career_history:
            if job.get("duration_months", 12) < 12:
                short_tenure_jobs += 1

        stability = trajectory_metrics.get("stability_score", 0.5)
        
        # Calculate retention based on stability and frequency of short hops
        if total_jobs > 0:
            hop_ratio = short_tenure_jobs / total_jobs
            retention_prediction = max(0.1, stability * (1.0 - 0.5 * hop_ratio))
        else:
            retention_prediction = stability

        # 2. Promotion Prediction
        # Direct pass from promotion velocity in trajectory metrics
        promotion_prediction = trajectory_metrics.get("promo_velocity", 0.5)

        # 3. Success Probability
        success_probability = 0.5 * retention_prediction + 0.5 * promotion_prediction

        # 4. Leadership Potential
        # Scans job titles for keywords: "lead", "manager", "head", "director", "architect", "principal", "chief", "cto", "vp"
        leadership_score = 0.2
        for job in career_history:
            title = job.get("title", "").lower()
            if any(kw in title for kw in ["lead", "architect", "head", "manager"]):
                leadership_score = max(leadership_score, 0.7)
            if any(kw in title for kw in ["director", "cto", "vp", "principal", "chief"]):
                leadership_score = max(leadership_score, 0.95)

        # 5. Growth Trajectory
        # Evaluates how fast they climb levels and learn
        growth_trajectory = 0.4 * promotion_prediction + 0.6 * leadership_score

        return {
            "retention_prediction": round(retention_prediction, 2),
            "promotion_prediction": round(promotion_prediction, 2),
            "success_probability": round(success_probability, 2),
            "leadership_potential": round(leadership_score, 2),
            "growth_trajectory": round(growth_trajectory, 2)
        }

success_potential_engine = SuccessPotentialEngine()
