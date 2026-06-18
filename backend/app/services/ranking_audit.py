"""
Ranking Audit Engine
Generates transparent, factor-by-factor audit trails for every ranking decision.
Allows judges/stakeholders to inspect exactly why a candidate ranked where they did.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)


class RankingAuditEngine:
    """Produces ranking audit trails with full factor decomposition."""

    # Human-readable labels for each ranking factor
    FACTOR_LABELS = {
        "semantic": "Semantic Fit",
        "adjacency": "Skill Adjacency",
        "trajectory": "Career Growth",
        "behavioral": "GitHub Activity",
        "success": "Success Potential",
        "learning": "Learning Velocity",
        "market": "Market Alignment",
        "potential": "Future Potential",
        "skill_transferability": "Skill Transferability",
        "career_growth_momentum": "Career Momentum",
        "startup_readiness": "Startup Readiness",
        "leadership_impact": "Leadership Impact",
        "open_source_influence": "Open Source Impact",
        "learning_agility": "Learning Agility",
        "domain_expertise": "Domain Expertise",
        "team_complement_score": "Team Complement",
        "retention_prediction": "Retention Prediction",
        "interview_success_prediction": "Interview Success",
    }

    # Groups factors into logical categories for summary
    FACTOR_GROUPS = {
        "Skills & Fit": ["semantic", "adjacency", "skill_transferability", "domain_expertise"],
        "Career & Growth": ["trajectory", "career_growth_momentum", "potential", "learning", "learning_agility"],
        "Engineering Quality": ["behavioral", "open_source_influence", "startup_readiness"],
        "Team & Culture": ["team_complement_score", "retention_prediction", "interview_success_prediction"],
        "Leadership & Market": ["leadership_impact", "success", "market"],
    }

    def generate_audit(
        self,
        factors: dict,
        weights: dict,
        modifiers: dict,
        raw_score: float,
        final_score: float,
    ) -> dict:
        """
        Generate a complete ranking audit trail.

        Args:
            factors: dict of factor_name → raw_score (0.0 to 1.0)
            weights: dict of factor_name → weight used (0.0 to 1.0)
            modifiers: dict of modifier_name → value
            raw_score: pre-modifier score
            final_score: post-modifier score

        Returns:
            Complete audit dict with factor breakdown, group summaries, and modifier impact.
        """
        # 1. Factor-level breakdown
        total_weight = sum(weights.values()) if weights else 1.0
        factor_audit = {}
        for factor_name, raw_val in factors.items():
            weight = weights.get(factor_name, 0.5)
            contribution = (weight * raw_val) / total_weight if total_weight > 0 else 0
            factor_audit[factor_name] = {
                "label": self.FACTOR_LABELS.get(factor_name, factor_name),
                "raw_score": round(raw_val, 3),
                "weight": round(weight, 2),
                "contribution": round(contribution, 4),
                "contribution_pct": round(contribution / raw_score * 100, 1) if raw_score > 0 else 0,
            }

        # 2. Group-level summaries
        group_summaries = {}
        for group_name, group_factors in self.FACTOR_GROUPS.items():
            group_scores = []
            group_contributions = []
            for f in group_factors:
                if f in factor_audit:
                    group_scores.append(factor_audit[f]["raw_score"])
                    group_contributions.append(factor_audit[f]["contribution"])

            avg_score = sum(group_scores) / len(group_scores) if group_scores else 0
            total_contribution = sum(group_contributions)

            group_summaries[group_name] = {
                "avg_score": round(avg_score, 3),
                "total_contribution": round(total_contribution, 4),
                "factor_count": len(group_scores),
                "contribution_pct": round(total_contribution / raw_score * 100, 1) if raw_score > 0 else 0,
            }

        # 3. Modifier breakdown
        modifier_breakdown = {}
        team_gap = modifiers.get("team_gap_score", 0)
        transferable = modifiers.get("transferable_skills", 0)
        benchmark = modifiers.get("benchmark_compatibility", 0)

        modifier_breakdown["team_gap_boost"] = {
            "label": "Team Gap Fill Bonus",
            "value": round(team_gap, 3),
            "multiplier": round(1.0 + 0.15 * team_gap, 4),
            "impact_pct": round((0.15 * team_gap) * 100, 1),
        }
        modifier_breakdown["transferable_skills_boost"] = {
            "label": "Transferable Skills Bonus",
            "value": round(transferable, 3),
            "multiplier": round(1.0 + 0.15 * transferable, 4),
            "impact_pct": round((0.15 * transferable) * 100, 1),
        }
        modifier_breakdown["benchmark_boost"] = {
            "label": "Benchmark Compatibility Bonus",
            "value": round(benchmark, 3),
            "multiplier": round(1.0 + 0.10 * benchmark, 4),
            "impact_pct": round((0.10 * benchmark) * 100, 1),
        }

        # 4. Total modifier impact
        total_modifier_impact = final_score - raw_score
        modifier_impact_pct = round((total_modifier_impact / raw_score) * 100, 1) if raw_score > 0 else 0

        # 5. Top contributing factors
        sorted_factors = sorted(factor_audit.items(), key=lambda x: x[1]["contribution"], reverse=True)
        top_factors = [
            {"name": self.FACTOR_LABELS.get(f, f), "contribution_pct": audit["contribution_pct"]}
            for f, audit in sorted_factors[:5]
        ]

        # 6. Weakest factors
        weakest_factors = [
            {"name": self.FACTOR_LABELS.get(f, f), "raw_score": round(audit["raw_score"] * 100, 1)}
            for f, audit in sorted_factors[-3:]
            if audit["raw_score"] < 0.5
        ]

        return {
            "ranking_audit": factor_audit,
            "group_summaries": group_summaries,
            "modifier_breakdown": modifier_breakdown,
            "total_raw_score": round(raw_score, 4),
            "total_final_score": round(final_score, 4),
            "modifier_impact": f"{'+' if modifier_impact_pct >= 0 else ''}{modifier_impact_pct}%",
            "modifier_impact_raw": round(total_modifier_impact, 4),
            "top_contributing_factors": top_factors,
            "weakest_factors": weakest_factors,
        }


ranking_audit_engine = RankingAuditEngine()
