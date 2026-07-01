"""
generate_submission.py
Generates the hackathon submission CSV in the required format:
    candidate_id, rank, score, reasoning

Usage:
    # Option 1 — Use an existing job from the database
    python generate_submission.py --job_id <JOB_ID>

    # Option 2 — Pass a job description file (.txt, .pdf, .docx)
    python generate_submission.py --job_file path/to/job_description.txt

    # Option 3 — Write the job description inline
    python generate_submission.py --job_desc "We are looking for a Senior AI Backend Architect..."

    # Optional: set a job title (used with --job_file or --job_desc)
    python generate_submission.py --job_file jd.txt --job_title "Senior AI Engineer"

The script connects to the local SQLite database, runs the ranking engine
against the specified (or newly created) job, and writes results to submission.csv.
"""

import csv
import sys
import argparse
import os

# Ensure the backend package is importable
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from sqlalchemy.orm import Session
from app.db.database import SessionLocal
from app.db.models import Job
from app.services.ranking_engine import ranking_engine
from app.services.llm_service import llm_service


OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "submission.csv")


# ---------------------------------------------------------------------------
# Job description file readers
# ---------------------------------------------------------------------------

def _read_txt_file(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _read_pdf_file(path: str) -> str:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("Error: PyMuPDF is required to read PDF files. Install with: pip install PyMuPDF")
        sys.exit(1)
    text_parts = []
    with fitz.open(path) as doc:
        for page in doc:
            text_parts.append(page.get_text())
    return "\n".join(text_parts)


def _read_docx_file(path: str) -> str:
    try:
        import docx
    except ImportError:
        print("Error: python-docx is required to read DOCX files. Install with: pip install python-docx")
        sys.exit(1)
    doc = docx.Document(path)
    return "\n".join(p.text for p in doc.paragraphs)


def read_job_description_file(path: str) -> str:
    """Read a job description from a .txt, .pdf, or .docx file."""
    if not os.path.isfile(path):
        print(f"Error: File not found: {path}")
        sys.exit(1)

    ext = os.path.splitext(path)[1].lower()
    if ext == ".pdf":
        text = _read_pdf_file(path)
    elif ext in (".docx", ".doc"):
        text = _read_docx_file(path)
    else:
        # Default to plain-text for .txt, .md, or any other extension
        text = _read_txt_file(path)

    text = text.strip()
    if not text:
        print(f"Error: Job description file is empty: {path}")
        sys.exit(1)

    return text


# ---------------------------------------------------------------------------
# Create a job from raw description text
# ---------------------------------------------------------------------------

def create_job_from_description(db: Session, title: str, description: str) -> Job:
    """
    Creates a new Job record in the database using the same pipeline as the
    /api/jobs endpoint — parses the description with the LLM to build the
    graph_schema (skills_required, domains, key_requirements, etc.).
    """
    print(f"Parsing job description with AI...")
    graph_schema = llm_service.parse_job_description(description)

    new_job = Job(
        title=title,
        description=description,
        benchmark_profile="GENERAL_ENGINEER",
        graph_schema=graph_schema,
    )
    db.add(new_job)
    db.commit()
    db.refresh(new_job)

    skills = graph_schema.get("skills_required", [])
    print(f"Job created — id={new_job.id}, title='{new_job.title}'")
    if skills:
        print(f"  Extracted skills: {', '.join(skills[:10])}")

    return new_job


# ---------------------------------------------------------------------------
# Reasoning builder
# ---------------------------------------------------------------------------

def _build_reasoning(candidate: dict) -> str:
    """
    Builds a concise, human-readable reasoning string from the ranking
    engine's explanation and factor data.
    """
    parts = []

    # 1. Recommended action
    action = candidate.get("recommended_action", "")
    if action:
        parts.append(f"Action: {action}")

    # 2. Top-level explanation summary
    explanation = candidate.get("explanation", {})
    why = explanation.get("why_ranked", "")
    if why:
        parts.append(why)

    # 3. Strengths
    strengths = explanation.get("strengths", [])
    if strengths:
        parts.append(f"Strengths: {'; '.join(strengths[:3])}")

    # 4. Risks
    risks = explanation.get("risks", [])
    if risks:
        parts.append(f"Risks: {'; '.join(risks[:3])}")

    # 5. Factor breakdown highlights
    fb = candidate.get("factor_breakdown", {})
    if fb:
        top_factors = sorted(fb.items(), key=lambda x: x[1], reverse=True)[:3]
        factor_str = ", ".join(f"{k}: {v}" for k, v in top_factors)
        parts.append(f"Top factors: {factor_str}")

    # 6. Confidence
    conf = candidate.get("confidence_score")
    if conf is not None:
        parts.append(f"Confidence: {conf}/100")

    # 7. Disqualification reasons (if applicable)
    if candidate.get("status") == "disqualified":
        reasons = candidate.get("reason", [])
        if reasons:
            parts.append(f"Disqualified: {'; '.join(reasons)}")

    return " | ".join(parts) if parts else "No detailed reasoning available."


# ---------------------------------------------------------------------------
# Main submission generator
# ---------------------------------------------------------------------------

def generate_submission(job_id: int) -> str:
    """
    Runs the ranking pipeline for the given job and writes submission.csv.
    Returns the output file path.
    """
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            print(f"Error: Job with id {job_id} not found in the database.")
            available_jobs = db.query(Job).all()
            if available_jobs:
                print("Available jobs:")
                for j in available_jobs:
                    print(f"  id={j.id}  title={j.title}")
            else:
                print("No jobs found in the database. Please create a job first.")
            sys.exit(1)

        print(f"Running ranking pipeline for job: '{job.title}' (id={job.id})...")
        result = ranking_engine.rank_candidates(db, job_id)

        ranked = result.get("ranked", [])
        disqualified = result.get("disqualified", [])

        # Combine: ranked first (they already have ranks), then disqualified
        all_candidates = ranked + disqualified

        if not all_candidates:
            print("Warning: No candidates found to rank. The submission CSV will be empty.")

        with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["candidate_id", "rank", "score", "reasoning"])

            for candidate in all_candidates:
                candidate_id = candidate["id"]
                rank = candidate.get("rank")  # None for disqualified
                score = candidate.get("overall_score", 0)
                reasoning = _build_reasoning(candidate)

                writer.writerow([
                    candidate_id,
                    rank if rank is not None else "DQ",
                    score,
                    reasoning,
                ])

        total = len(all_candidates)
        ranked_count = len(ranked)
        dq_count = len(disqualified)
        print(f"\nSubmission CSV generated: {OUTPUT_FILE}")
        print(f"  Total candidates: {total}")
        print(f"  Ranked: {ranked_count}")
        print(f"  Disqualified: {dq_count}")

        return OUTPUT_FILE

    finally:
        db.close()


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Generate hackathon submission CSV (candidate_id, rank, score, reasoning)"
    )

    # --- Job source (mutually exclusive) ---
    job_source = parser.add_mutually_exclusive_group(required=False)
    job_source.add_argument(
        "--job_id",
        type=int,
        default=None,
        help="ID of an existing job in the database to rank against.",
    )
    job_source.add_argument(
        "--job_file",
        type=str,
        default=None,
        help="Path to a job description file (.txt, .pdf, .docx). "
             "A new job will be created from its contents.",
    )
    job_source.add_argument(
        "--job_desc",
        type=str,
        default=None,
        help="Inline job description text. A new job will be created from it.",
    )

    # --- Optional metadata for new jobs ---
    parser.add_argument(
        "--job_title",
        type=str,
        default=None,
        help="Title for the new job (used with --job_file or --job_desc). "
             "If omitted, a title is auto-generated from the description.",
    )

    args = parser.parse_args()

    # Resolve which job to use
    if args.job_file:
        desc_text = read_job_description_file(args.job_file)
        title = args.job_title or os.path.splitext(os.path.basename(args.job_file))[0].replace("_", " ").title()
        db = SessionLocal()
        try:
            job = create_job_from_description(db, title, desc_text)
            target_job_id = job.id
        finally:
            db.close()

    elif args.job_desc:
        desc_text = args.job_desc.strip()
        if len(desc_text) < 10:
            print("Error: --job_desc text is too short (minimum 10 characters).")
            sys.exit(1)
        title = args.job_title or "Submission Job"
        db = SessionLocal()
        try:
            job = create_job_from_description(db, title, desc_text)
            target_job_id = job.id
        finally:
            db.close()

    elif args.job_id is not None:
        target_job_id = args.job_id

    else:
        # Default: use job_id=1
        target_job_id = 1
        print("No job source specified, defaulting to --job_id 1")

    generate_submission(target_job_id)
