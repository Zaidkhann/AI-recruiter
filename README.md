# Talent Rank — AI Recruiter & ATS Platform

An AI-powered candidate intelligence, ranking, and applicant tracking system that doesn't just filter resumes — it intelligently ranks candidates using multi-factor analysis.

## Features

- **AI-Powered Candidate Ranking** — Multi-factor scoring with semantic fit, skill adjacency, career velocity, GitHub activity, and more
- **ATS Pipeline Tracker** — Kanban-style board to track candidates through Applied → Screening → Interview → Offer → Hired stages
- **ATS Resume Score** — Automated resume-to-job match scoring with keyword analysis and compatibility percentages
- **AI Copilot** — Natural language interface to adjust ranking weights, compare candidates, and search profiles
- **Hiring Committee Debate** — AI-simulated multi-perspective debate to evaluate candidate fit
- **Team Skill Gap Analysis** — Visualize how a candidate fills existing team skill gaps
- **Resume Ingestion** — Upload PDF, DOCX, or TXT resumes with batch processing
- **Role-Based Access** — Admin, Recruiter, and Viewer roles with JWT authentication
- **Executive Outreach** — Auto-generated personalized interview prep and email drafts

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, TailwindCSS, Recharts, Framer Motion
- **Backend:** FastAPI, SQLAlchemy, Python
- **AI/ML:** Google Gemini, Sentence Transformers, ChromaDB

## Getting Started

```bash
# Start backend
cd backend
uvicorn app.main:app --reload --port 8000

# Start frontend
cd frontend
npm run dev
```
