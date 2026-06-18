import pytest
from unittest.mock import MagicMock
from app.services.ranking_engine import RankingEngine
from app.services.skill_adjacency import skill_adjacency_engine


def _mock_db():
    mock_db = MagicMock()
    mock_db.query.return_value.filter.return_value.all.return_value = []
    return mock_db


def test_direct_match_ratio():
    ratio = skill_adjacency_engine.calculate_direct_match_ratio(
        ["Python", "Docker"],
        ["Python", "FastAPI", "Kubernetes"],
    )
    assert ratio == pytest.approx(1 / 3)


def test_adjacent_only_match_excludes_direct():
    adjacent = skill_adjacency_engine.calculate_adjacent_only_match(
        _mock_db(),
        ["Flask"],
        ["FastAPI"],
    )
    assert adjacent == pytest.approx(0.75)


def test_evaluate_disqualification_all_failures():
    engine = RankingEngine()
    is_disqualified, reasons = engine._evaluate_disqualification(
        direct_match_ratio=0.0,
        semantic_score=0.1,
        transferable_val=0.0,
        adjacent_only_score=0.0,
        final_score=0.18,
        semantic_threshold=0.20,
        overall_threshold=0.25,
    )
    assert is_disqualified is True
    assert "No matching required skills" in reasons
    assert "Semantic fit below threshold" in reasons
    assert "No transferable skills detected" in reasons
    assert "No adjacent skills from knowledge graph" in reasons
    assert "Overall ranking score below threshold" in reasons


def test_evaluate_disqualification_hidden_talent_not_disqualified():
    engine = RankingEngine()
    is_disqualified, reasons = engine._evaluate_disqualification(
        direct_match_ratio=0.0,
        semantic_score=0.15,
        transferable_val=0.35,
        adjacent_only_score=0.4,
        final_score=0.22,
        semantic_threshold=0.20,
        overall_threshold=0.25,
    )
    assert is_disqualified is False
    assert reasons == []


def test_get_missing_required_skills():
    engine = RankingEngine()
    missing = engine._get_missing_required_skills(
        ["Python"],
        ["Python", "Kubernetes", "Go"],
    )
    assert missing == ["Kubernetes", "Go"]
