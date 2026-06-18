"""
Candidate Benchmarking Engine
Compares candidate multi-factor scores against predefined industry benchmark profiles
to produce percentile rankings and benchmark compatibility scores.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Benchmark profiles define expected score thresholds for each factor.
# Each factor has (mean, std_dev) — candidates above mean score higher percentile.
BENCHMARK_PROFILES = {
    "ALL_ENGINEERS": {
        "label": "All Engineers",
        "thresholds": {
            "semantic": (0.50, 0.15),
            "adjacency": (0.50, 0.15),
            "trajectory": (0.50, 0.18),
            "behavioral": (0.45, 0.20),
            "success": (0.50, 0.15),
            "learning": (0.50, 0.15),
            "market": (0.50, 0.18),
            "potential": (0.50, 0.15),
        },
    },
    "BACKEND_ENGINEERS": {
        "label": "Backend Engineers",
        "thresholds": {
            "semantic": (0.55, 0.14),
            "adjacency": (0.58, 0.13),
            "trajectory": (0.55, 0.16),
            "behavioral": (0.50, 0.18),
            "success": (0.55, 0.14),
            "learning": (0.52, 0.15),
            "market": (0.55, 0.16),
            "potential": (0.53, 0.14),
        },
    },
    "FRONTEND_ENGINEERS": {
        "label": "Frontend Engineers",
        "thresholds": {
            "semantic": (0.52, 0.15),
            "adjacency": (0.55, 0.14),
            "trajectory": (0.48, 0.17),
            "behavioral": (0.48, 0.19),
            "success": (0.50, 0.15),
            "learning": (0.55, 0.14),
            "market": (0.58, 0.15),
            "potential": (0.50, 0.15),
        },
    },
    "AI_ENGINEERS": {
        "label": "AI/ML Engineers",
        "thresholds": {
            "semantic": (0.60, 0.13),
            "adjacency": (0.55, 0.14),
            "trajectory": (0.52, 0.16),
            "behavioral": (0.55, 0.17),
            "success": (0.48, 0.16),
            "learning": (0.65, 0.12),
            "market": (0.68, 0.12),
            "potential": (0.58, 0.14),
        },
    },
    "YC_FOUNDING_ENGINEER": {
        "label": "YC Founding Engineers",
        "thresholds": {
            "semantic": (0.62, 0.12),
            "adjacency": (0.60, 0.12),
            "trajectory": (0.58, 0.15),
            "behavioral": (0.65, 0.14),
            "success": (0.45, 0.18),
            "learning": (0.70, 0.10),
            "market": (0.72, 0.10),
            "potential": (0.68, 0.12),
        },
    },
    "FAANG_STAFF": {
        "label": "FAANG Staff Engineers",
        "thresholds": {
            "semantic": (0.65, 0.10),
            "adjacency": (0.62, 0.11),
            "trajectory": (0.70, 0.10),
            "behavioral": (0.58, 0.15),
            "success": (0.68, 0.12),
            "learning": (0.55, 0.14),
            "market": (0.60, 0.13),
            "potential": (0.65, 0.12),
        },
    },
}


class BenchmarkingEngine:
    """Computes candidate percentile rankings against industry benchmarks."""

    def compute_percentiles(self, candidate_factors: dict) -> dict:
        """
        Given a candidate's factor scores, compute their percentile
        within each benchmark category.

        Args:
            candidate_factors: dict of factor_name → score (0.0 to 1.0)

        Returns:
            {
                "global_percentile": 92,
                "category_percentiles": {"backend": 87, "frontend": 75, ...},
                "benchmark_match": {"YC_FOUNDING_ENGINEER": 81, "FAANG_STAFF": 76},
                "top_category": "backend",
                "narrative": "Top 8% of all engineers"
            }
        """
        if not candidate_factors:
            return self._empty_result()

        # Compute global percentile (ALL_ENGINEERS)
        global_pct = self._compute_against_benchmark(candidate_factors, "ALL_ENGINEERS")

        # Compute category-specific percentiles
        category_percentiles = {}
        category_map = {
            "backend": "BACKEND_ENGINEERS",
            "frontend": "FRONTEND_ENGINEERS",
            "ai": "AI_ENGINEERS",
        }
        for cat_key, benchmark_key in category_map.items():
            category_percentiles[cat_key] = self._compute_against_benchmark(candidate_factors, benchmark_key)

        # Compute benchmark match scores
        benchmark_match = {}
        for bench_key in ["YC_FOUNDING_ENGINEER", "FAANG_STAFF"]:
            benchmark_match[bench_key] = self._compute_against_benchmark(candidate_factors, bench_key)

        # Identify top category
        top_category = max(category_percentiles, key=category_percentiles.get) if category_percentiles else "backend"

        # Generate narrative
        narrative = self._generate_narrative(global_pct, category_percentiles, top_category)

        return {
            "global_percentile": global_pct,
            "category_percentiles": category_percentiles,
            "benchmark_match": benchmark_match,
            "top_category": top_category,
            "narrative": narrative,
        }

    def _compute_against_benchmark(self, candidate_factors: dict, benchmark_key: str) -> int:
        """
        Computes a percentile score for the candidate against a specific benchmark.
        Uses a simplified z-score approach: for each factor, compute how many std_devs
        above/below the benchmark mean the candidate scores, then average.
        """
        benchmark = BENCHMARK_PROFILES.get(benchmark_key)
        if not benchmark:
            return 50

        thresholds = benchmark["thresholds"]
        z_scores = []

        for factor_name, (mean, std_dev) in thresholds.items():
            candidate_score = candidate_factors.get(factor_name, 0.5)
            if std_dev > 0:
                z = (candidate_score - mean) / std_dev
            else:
                z = 0.0
            z_scores.append(z)

        if not z_scores:
            return 50

        avg_z = sum(z_scores) / len(z_scores)

        # Convert z-score to percentile using a sigmoid approximation
        # This maps z ∈ [-3, 3] → percentile ∈ [1, 99]
        import math
        percentile = 100 / (1 + math.exp(-1.7 * avg_z))
        percentile = max(1, min(99, int(round(percentile))))

        return percentile

    def _generate_narrative(self, global_pct: int, category_percentiles: dict, top_category: str) -> str:
        """Generates a human-readable narrative about the candidate's benchmark position."""
        rank_position = 100 - global_pct
        top_cat_pct = category_percentiles.get(top_category, 50)
        top_cat_rank = 100 - top_cat_pct

        cat_labels = {
            "backend": "backend engineers",
            "frontend": "frontend engineers",
            "ai": "AI/ML engineers",
        }
        cat_label = cat_labels.get(top_category, "engineers")

        narrative = f"Top {rank_position}% of all engineers"
        if top_cat_pct > global_pct:
            narrative += f", Top {top_cat_rank}% of {cat_label}"

        return narrative

    def _empty_result(self) -> dict:
        return {
            "global_percentile": 50,
            "category_percentiles": {"backend": 50, "frontend": 50, "ai": 50},
            "benchmark_match": {"YC_FOUNDING_ENGINEER": 50, "FAANG_STAFF": 50},
            "top_category": "backend",
            "narrative": "Insufficient data for benchmarking",
        }


benchmarking_engine = BenchmarkingEngine()
