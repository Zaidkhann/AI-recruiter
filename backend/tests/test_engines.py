import pytest
from app.services.career_trajectory import career_trajectory_engine
from app.services.behavioral_intel import behavioral_intelligence_engine
from app.services.success_potential import success_potential_engine

def test_career_trajectory_stagnant():
    # Simple candidate with single entry
    career = [{"company": "Tech", "title": "Developer", "duration_months": 12, "seniority": "MID"}]
    scores = career_trajectory_engine.calculate_score(career, "SENIOR")
    assert scores["stability_score"] == 0.5
    assert scores["promo_velocity"] == 0.5
    assert scores["level_alignment"] == 0.7  # 1 level below SENIOR

def test_career_trajectory_fast_growth():
    # Climbing from Mid to Lead in 24 months
    career = [
        {"company": "FastTech", "title": "Lead Engineer", "duration_months": 12, "seniority": "LEAD"},
        {"company": "MidTech", "title": "Mid Developer", "duration_months": 12, "seniority": "MID"}
    ]
    scores = career_trajectory_engine.calculate_score(career, "LEAD")
    assert scores["stability_score"] == 0.5
    assert scores["level_alignment"] == 1.0  # matches LEAD
    assert scores["promo_velocity"] > 0.5   # velocity is positive

def test_behavioral_score():
    # Highly active builder
    stats = {
        "commits_count": 1200,
        "pull_requests_count": 90,
        "issues_count": 20,
        "stars_count": 100,
        "forks_count": 20,
        "repos_count": 10
    }
    scores = behavioral_intelligence_engine.calculate_score(stats)
    assert scores["commit_cadence"] == 1.0
    assert scores["collaboration_score"] > 0.8
    assert scores["overall"] > 0.8

def test_success_potential_risk():
    # Hop risk candidate
    career = [
        {"company": "A", "title": "Dev", "duration_months": 6, "seniority": "MID"},
        {"company": "B", "title": "Dev", "duration_months": 6, "seniority": "MID"},
        {"company": "C", "title": "Dev", "duration_months": 8, "seniority": "MID"}
    ]
    trajectory_metrics = {"stability_score": 0.2, "promo_velocity": 0.4}
    scores = success_potential_engine.calculate_score(career, trajectory_metrics)
    assert scores["retention_prediction"] < 0.2  # high risk

def test_llm_fallbacks():
    from app.services.llm_service import llm_service
    candidate_profile = {
        "name": "Fallback Test Candidate",
        "skills": ["Python", "Docker"],
        "career_history": [{"company": "TestCorp", "title": "Software Engineer", "duration_months": 24, "seniority": "MID"}],
        "github_username": "test_gh",
        "github_stats": {}
    }
    job_details = {
        "title": "Senior PyTorch Developer",
        "description": "Needs PyTorch and Kubernetes",
        "skills_required": ["Python", "PyTorch", "Kubernetes"]
    }
    
    # 1. Test debate fallback
    debate = llm_service._generate_debate_fallback(candidate_profile, job_details)
    assert isinstance(debate, list)
    assert len(debate) > 0
    assert any(turn["speaker"] == "Tech Lead" for turn in debate)
    assert any("fallback test candidate" in turn["message"].lower() for turn in debate)
    
    # 2. Test decision card fallback
    card = llm_service._generate_decision_card_fallback(candidate_profile, job_details)
    assert isinstance(card, dict)
    assert card["status"] == "fallback"
    assert len(card["strengths"]) > 0
    assert len(card["risks_and_gaps"]) > 0
    assert len(card["suggested_interview_questions"]) > 0
    assert card["personalized_outreach_email"].startswith("Subject:")

def test_linkedin_intelligence():
    from app.services.linkedin_intelligence import linkedin_intelligence_engine
    career = [
        {"company": "Google", "title": "Staff Software Engineer", "duration_months": 36, "seniority": "STAFF"},
        {"company": "Meta", "title": "Senior Engineer", "duration_months": 24, "seniority": "SENIOR"},
    ]
    skills = ["Python", "Go", "Distributed Systems", "Kubernetes", "AWS", "FastAPI"]
    certs = ["AWS Certified Solutions Architect", "CKA"]
    edu = [{"school": "Stanford", "degree": "M.S.", "field_of_study": "Computer Science"}]
    
    result = linkedin_intelligence_engine.analyze(
        career_history=career,
        skills=skills,
        certifications=certs,
        education=edu
    )
    
    assert "professional_score" in result
    assert "leadership_score" in result
    assert "industry_authority" in result
    assert "career_progression" in result
    assert "certification_strength" in result
    assert "activity_score" in result
    assert "overall_linkedin_score" in result
    assert result["data_quality"] == "high"
    
    assert 0.0 <= result["professional_score"] <= 1.0
    assert 0.0 <= result["leadership_score"] <= 1.0

def test_benchmarking():
    from app.services.benchmarking_engine import benchmarking_engine
    factors = {
        "semantic": 0.85,
        "adjacency": 0.80,
        "trajectory": 0.75,
        "behavioral": 0.70,
        "success": 0.65,
        "learning": 0.88,
        "market": 0.90,
        "potential": 0.80,
    }
    
    result = benchmarking_engine.compute_percentiles(factors)
    
    assert "global_percentile" in result
    assert "category_percentiles" in result
    assert "benchmark_match" in result
    assert "narrative" in result
    
    assert 1 <= result["global_percentile"] <= 99
    assert result["category_percentiles"]["backend"] > 50

def test_ranking_audit():
    from app.services.ranking_audit import ranking_audit_engine
    factors = {
        "semantic": 0.85,
        "adjacency": 0.80,
        "trajectory": 0.75,
        "behavioral": 0.70,
        "success": 0.65,
        "learning": 0.88,
        "market": 0.90,
        "potential": 0.80,
    }
    weights = {f: 0.5 for f in factors}
    modifiers = {
        "team_gap_score": 0.80,
        "transferable_skills": 0.60,
        "benchmark_compatibility": 0.85,
    }
    
    result = ranking_audit_engine.generate_audit(
        factors=factors,
        weights=weights,
        modifiers=modifiers,
        raw_score=0.75,
        final_score=0.88
    )
    
    assert "ranking_audit" in result
    assert "group_summaries" in result
    assert "modifier_breakdown" in result
    assert result["modifier_impact"] == "+17.3%"
    assert len(result["top_contributing_factors"]) == 5

def test_ranking_engine_deep_job_understanding():
    from app.services.ranking_engine import ranking_engine
    from app.db.models import Candidate
    
    candidate = Candidate(
        name="Test Candidate",
        skills=["Python", "PyTorch", "Kubernetes"],
        career_history=[
            {"company": "AI Labs", "title": "Lead ML Engineer", "duration_months": 24, "description": "Led machine learning pipelines, ran tests, fast-paced team."}
        ],
        resume_text="Experienced in AI Engineering and Cloud Infrastructure. Mentored junior engineers. Active in open source.",
        linkedin_intelligence={"leadership_score": 0.8}
    )
    
    domains = ["AI Engineering", "Cloud Infrastructure"]
    responsibilities = ["Design machine learning pipelines", "Deploy to Kubernetes"]
    domain_score = ranking_engine._calculate_domain_alignment(candidate, domains, responsibilities)
    assert domain_score > 0.7
    
    reqs = ["2+ years experience"]
    prereqs = ["Python", "Kubernetes"]
    compliance_score = ranking_engine._calculate_requirement_compliance(candidate, reqs, prereqs)
    assert compliance_score > 0.8
    
    leadership_reqs = ["Lead complex projects"]
    leadership_score = ranking_engine._calculate_leadership_match(candidate, leadership_reqs)
    assert leadership_score > 0.7
    
    hidden_reqs = ["Fast-paced execution", "Testing standards"]
    hidden_score = ranking_engine._calculate_hidden_fit(candidate, hidden_reqs)
    assert hidden_score > 0.5


