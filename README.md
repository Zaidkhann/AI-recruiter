# Talent Rank

**AI-powered candidate intelligence, multi-factor ranking, and applicant tracking — built for recruiters who need explainable hiring decisions, not keyword filters.**

![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.111-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=white)
![Gemini](https://img.shields.io/badge/Gemini-AI-8E75B2)

> **Why it matters:** Traditional ATS tools stop at keyword matching. Talent Rank ingests resumes, builds vector embeddings, scores candidates across 18+ factors, and surfaces AI-generated explanations, committee debates, and outreach drafts — all from one dashboard.

---

## 🚀 Quick Start

**Prerequisites:** Docker & Docker Compose, a [Google Gemini API key](https://ai.google.dev/)

```bash
git clone https://github.com/Zaidkhann/AI-recruiter.git

cd AI-recruiter

cp .env.example .env

# Fill in the required environment variables

docker compose up --build
```
---
## A single command that produces the submission CSV from the candidates file 
>>python3 rank_candidates.py

----


| Service    | URL                          |
| ---------- | ---------------------------- |
| Frontend   | http://localhost:3000        |
| Backend    | http://localhost:8000        |
| API Docs   | http://localhost:8000/docs   |
| PostgreSQL | localhost:5432               |
| Qdrant     | localhost:6333               |
| Redis      | localhost:6379               |

```bash
# Run locally without Docker (backend)
cd backend && pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Run locally without Docker (frontend)
cd frontend && npm ci && npm run dev

# Production build (frontend)
cd frontend && npm run build && npm start

# Run backend tests
cd backend && pytest
```

> Upload resumes and create a job description in the UI, then click **Rank Candidates** to see multi-factor scoring in action.

---

## 👨‍⚖️ Judge Information

| Item | Status |
| ---- | ------ |
| ✅ Docker Support | Full `docker-compose.yml` — Postgres, Qdrant, Redis, backend, frontend |
| ✅ Setup Time | ~5 minutes with Docker + Gemini API key |
| ✅ Sample Data | `POST /api/seed-db` seeds team members & skill knowledge graph; `candidates.jsonl` for batch ranking |
| ✅ Resilient Fallbacks | SQLite, in-memory Redis, FAISS/NumPy vector search when infra is unavailable |
| ✅ Security Hardening | Rate limiting, prompt-injection scanning, security headers, audit logging |
| ✅ Hackathon CSV Export | `rank_candidates.py` → `ai_freaks.csv` · `generate_submission.py` → `submission.csv` |

> **Note:** No hosted live demo or demo video is included in this repository. Copy `.env.example` to `.env` locally — real values are gitignored and not committed.

---

## 📌 Project Overview

### Problem

Recruiters reviewing hundreds of resumes face three recurring failures:

- **Keyword traps** — strong candidates with adjacent skills get filtered out
- **Opaque scoring** — ATS percentages with no explanation of *why*
- **Siloed data** — resume text, GitHub activity, and career trajectory live in separate tools

### Solution

Talent Rank is a full-stack **Candidate Intelligence & Ranking Platform** that:

1. Ingests resumes (PDF, DOCX, TXT, JSON, JSONL) with binary validation
2. Parses structured profiles via Gemini AI
3. Stores semantic embeddings in Qdrant for similarity search
4. Ranks every candidate against a job using a weighted multi-factor engine
5. Generates explainable AI outputs — ranking audits, hiring committee debates, outreach emails
6. Tracks candidates through a built-in ATS pipeline board

### Target Users

| User | Use Case |
| ---- | -------- |
| Recruiters | Upload resumes, rank against JDs, compare candidates, export CSV |
| Hiring Managers | Review AI decision cards, committee debates, interview questions |
| Engineering Leads | Configure team skill gaps, benchmark profiles, ranking weights |
| Hackathon Judges | Inspect architecture, API surface, AI pipeline, and submission scripts |

---

## ✨ Features

| Category | Feature | Description |
| -------- | ------- | ----------- |
| **Frontend** | Recruiter Dashboard | Resume upload, job description editor, live ranking, candidate cards/table views |
| | ATS Tracker | Kanban-style pipeline board (applied → hired/rejected) |
| | Job Management | Create, edit, clone, archive jobs with AI skill suggestions |
| | Pipeline Visualizer | Real-time SSE telemetry during resume ingestion |
| | Candidate Drawer | Tabs: Overview, GitHub Intel, Professional Intel, Committee Review, Outreach |
| | Weight Sliders | Adjust 18 ranking factor weights; copilot can suggest adjustments |
| | Candidate Comparison | Side-by-side factor breakdown for two candidates |
| | CSV Export | Download ranked candidate list from the dashboard |
| **Backend** | REST API | FastAPI with OpenAPI docs at `/docs` |
| | Batch Upload | Upload multiple resumes in one request |
| | Flush Resumes | Delete all candidates and vector embeddings |
| | Audit Logs | Admin endpoint for security and action events |
| **AI** | Resume Parsing | Gemini extracts name, skills, career history, education, links |
| | JD Understanding | LLM builds graph schema — skills, domains, hidden requirements |
| | Embeddings | `gemini-embedding-001` (3072-dim) stored in Qdrant |
| | Ranking Explanations | LLM-generated strengths, risks, interview questions |
| | Hiring Committee Debate | Simulated multi-persona debate per candidate |
| | Recruiter Copilot | Natural-language chat that can adjust ranking weights |
| | Talent Rediscovery | Semantic search for overlooked candidates |
| **Database** | PostgreSQL | Jobs, candidates, team, knowledge graph, ATS records, audit logs |
| | Qdrant | Candidate vector embeddings for semantic retrieval |
| | Redis | Rate limiting, GitHub cache, copilot chat history, ranking cache |
| | Skill Graph | NetworkX-powered adjacency scoring via `graph_nodes` / `graph_edges` |
| **Security** | Prompt Injection Guard | Regex scan on resume text and copilot queries |
| | Rate Limiting | 100 req/min global, 5 req/min auth paths (Redis-backed) |
| | Security Headers | CSP, X-Frame-Options, HSTS, nosniff |
| | Input Sanitization | HTML entity escaping on job/team text fields |
| **Deployment** | Docker Compose | 5-service stack with health checks and volumes |
| | Graceful Degradation | Auto-fallback to SQLite, memory cache, local vector index |
| **Developer Experience** | API Explorer | Built-in frontend tool to test endpoints |
| | Seed Endpoint | Reset DB with team + skill graph via `POST /api/seed-db` |
| | Submission Scripts | CLI tools for hackathon CSV generation |
| | Pytest Suite | Engine unit tests for skills, disqualification, ranking |

---

## 🏗 System Architecture

```mermaid
flowchart TB
    subgraph Client
        UI[Next.js Dashboard<br/>localhost:3000]
    end

    subgraph API["FastAPI Backend :8000"]
        MW[Rate Limit + Security Headers]
        R_CAND[Candidates API]
        R_JOB[Jobs API]
        R_RANK[Ranking API]
        R_ATS[ATS API]
        R_INTEL[Intelligence API]
        R_COP[Copilot API]
        RE[Ranking Engine]
        LLM[LLM Service<br/>Gemini]
    end

    subgraph Data
        PG[(PostgreSQL)]
        QD[(Qdrant)]
        RD[(Redis)]
    end

    UI -->|REST / SSE| MW
    MW --> R_CAND & R_JOB & R_RANK & R_ATS & R_INTEL & R_COP
    R_CAND --> LLM
    R_JOB --> LLM
    R_RANK --> RE
    R_COP --> LLM
    RE --> LLM
    R_CAND --> PG & QD
    RE --> PG & QD & RD
    R_INTEL --> RE
```

### Resilient Fallback Chain

```mermaid
flowchart LR
    PG[(PostgreSQL)] -->|unreachable| SQLITE[(SQLite recruiter.db)]
    QD[(Qdrant)] -->|unreachable| FAISS[FAISS / NumPy Index]
    RD[(Redis)] -->|unreachable| MEM[In-Memory Cache]
    GEMINI[Gemini API] -->|no key / error| RULES[Rule-Based Fallbacks]
```

---

## 🧠 AI Pipeline

Every resume upload triggers a tracked 10-stage pipeline (visible via SSE at `/api/intelligence/pipeline-events/{session_id}`):

| Stage | What Happens |
| ----- | ------------ |
| 1. Resume Uploaded | File size check (≤ 600 MB), extension validation, PDF/DOCX magic-number verification |
| 2. AI Resume Parsing | Gemini extracts structured profile (or JSON/JSONL parsed directly) |
| 3. Skill Extraction | Skills cleaned with evidence-based filtering (prevents false positives like "Go" in "Google") |
| 4. Embedding Generation | `gemini-embedding-001` vector upserted to Qdrant |
| 5. GitHub Analysis | Public API fetch with 24h Redis cache; behavioral scoring |
| 6. LinkedIn Intelligence | Rule-based professional score from career history, certs, education |
| 7. Knowledge Graph Mapping | Candidate skills mapped against skill adjacency graph |
| 8. Behavioral Intelligence | Commit frequency, open-source influence, startup readiness |
| 9. Ranking Engine | Multi-factor scoring when user triggers rank |
| 10. Decision Generated | LLM debate + decision card (strengths, risks, interview Qs, outreach email) |

### Ranking Factors (18)

`semantic` · `adjacency` · `trajectory` · `behavioral` · `success` · `learning` · `market` · `potential` · `skill_transferability` · `career_growth_momentum` · `startup_readiness` · `leadership_impact` · `open_source_influence` · `learning_agility` · `domain_expertise` · `team_complement_score` · `retention_prediction` · `interview_success_prediction`

Disqualified candidates are separated when **both** semantic alignment and overall score fall below configurable thresholds.

---

## ⚙ Tech Stack

| Layer | Technology |
| ----- | ---------- |
| **Languages** | Python 3.11, TypeScript 5 |
| **Frontend** | Next.js 16, React 19, Tailwind CSS 4, Framer Motion, Recharts, TanStack Query |
| **Backend** | FastAPI, Uvicorn, Pydantic v2, SQLAlchemy 2 |
| **Database** | PostgreSQL 16 (primary), SQLite (fallback) |
| **Vector DB** | Qdrant (primary), FAISS / NumPy cosine (fallback) |
| **Cache** | Redis 7 (primary), in-memory dict (fallback) |
| **AI / ML** | Google Gemini (`gemini-3.1-flash-lite`, `gemini-embedding-001`) |
| **Graph** | NetworkX, custom skill adjacency engine |
| **File Parsing** | pypdf, docx2txt |
| **Deployment** | Docker, Docker Compose |
| **Testing** | pytest |
| **Tools** | httpx (GitHub API), bcrypt, PyJWT (models present) |

---

## 📂 Folder Structure

```
AI-recruiter/
├── backend/
│   ├── app/
│   │   ├── api/              # FastAPI route handlers
│   │   ├── core/             # Config, auth, rate limit, security, audit
│   │   ├── db/               # SQLAlchemy models, Postgres/Qdrant/Redis clients
│   │   └── services/         # Ranking engine, LLM, GitHub, intelligence engines
│   ├── tests/                # pytest unit tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── components/       # Dashboard, candidates, copilot, shared UI
│   │   ├── hooks/            # React Query data hooks
│   │   └── lib/              # API client, TypeScript types
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml        # Full 5-service stack
├── rank_candidates.py        # Batch rank candidates.jsonl → ai_freaks.csv
├── generate_submission.py    # Rank DB candidates → submission.csv
├── candidates.jsonl          # Hackathon candidate dataset
├── job_description.txt       # Sample job description
└── README.md
```

| Path | Purpose |
| ---- | ------- |
| `backend/app/services/ranking_engine.py` | Core multi-factor ranking logic |
| `backend/app/services/llm_service.py` | All Gemini interactions |
| `backend/app/db/qdrant_client.py` | Vector store with local fallback index |
| `frontend/src/app/page.tsx` | Main dashboard (recruiter / ATS / admin views) |

---

## 🔧 Installation

### Requirements

- Docker 24+ and Docker Compose v2 **or**
- Python 3.11+, Node.js 20+, PostgreSQL 16, Qdrant, Redis
- Gemini API key (required for AI parsing, embeddings, explanations)

### Clone

```bash
git clone https://github.com/Zaidkhann/AI-recruiter.git
cd AI-recruiter
```

### Environment Variables

Copy `.env.example` to `.env` in the project root and fill in values (see table below). Docker Compose reads `GEMINI_API_KEY` from it.

```bash
cp .env.example .env
```

### Docker (Recommended)

```bash
docker compose up --build
```

### Run Locally

```bash
# Terminal 1 — start infrastructure
docker compose up db qdrant redis

# Terminal 2 — backend
cd backend
pip install -r requirements.txt
export GEMINI_API_KEY=your_key
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recruiter_db
uvicorn app.main:app --reload --port 8000

# Terminal 3 — frontend
cd frontend
npm ci
export NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Production Build

```bash
# Frontend
cd frontend && npm ci && npm run build && npm start

# Backend
cd backend && pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 🔑 Environment Variables

> Copy `.env.example` to `.env` at the project root (or use `backend/.env` for local backend-only runs). Both `.env` paths are **gitignored** — never commit secrets.

| Variable | Required | Default | Description |
| -------- | -------- | ------- | ----------- |
| `GEMINI_API_KEY` | **Yes** (for AI) | `""` | Google Gemini API key |
| `DATABASE_URL` | No | `postgresql://postgres:postgres@localhost:5432/recruiter_db` | PostgreSQL connection string |
| `QDRANT_HOST` | No | `localhost` | Qdrant hostname |
| `QDRANT_PORT` | No | `6333` | Qdrant port |
| `QDRANT_API_KEY` | No | `""` | Qdrant Cloud API key |
| `REDIS_HOST` | No | `localhost` | Redis hostname |
| `REDIS_PORT` | No | `6379` | Redis port |
| `GITHUB_TOKEN` | No | `""` | GitHub PAT (raises rate limit from 60/hr) |
| `OPENAI_API_KEY` | No | `""` | Reserved in config (not used by current implementation) |
| `SECRET_KEY` | No | `""` | JWT secret (User model exists; demo mode bypasses auth) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | `1440` | Token expiry |
| `NEXT_PUBLIC_API_URL` | No | `http://localhost:8000` | Frontend → backend URL |
| `DISQUALIFY_SEMANTIC_THRESHOLD` | No | `0.18` | Auto-disqualify semantic floor |
| `DISQUALIFY_OVERALL_THRESHOLD` | No | `0.20` | Auto-disqualify overall score floor |

**Example `.env`:**

```env
GEMINI_API_KEY=your_gemini_api_key_here
GITHUB_TOKEN=ghp_optional_github_token
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 📡 API Documentation

Interactive docs: **http://localhost:8000/docs**

### System

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/health` | Legacy health check |
| `GET` | `/api/health` | Full infra status (DB, cache, vector, LLM) |
| `GET` | `/api/system/status` | Counts: candidates, jobs, embeddings, graph nodes, audit events |
| `POST` | `/api/seed-db` | Reset DB — seeds team members + skill graph |
| `GET` | `/api/submission-csv` | Download or generate `ai_freaks.csv` |

### Candidates `/api/candidates`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/candidates` | List all candidates |
| `GET` | `/api/candidates/{id}` | Get candidate by ID |
| `POST` | `/api/candidates/upload` | Upload single resume (PDF/DOCX/TXT/JSON/JSONL) |
| `POST` | `/api/candidates/upload-batch` | Batch resume upload |
| `DELETE` | `/api/candidates/flush` | Delete all candidates + embeddings |
| `GET` | `/api/candidates/{id}/github-analysis` | GitHub intelligence report |

### Jobs `/api/jobs`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/jobs` | List jobs |
| `GET` | `/api/jobs/{id}` | Get job |
| `POST` | `/api/jobs` | Create job (AI parses JD into graph schema) |
| `PUT` | `/api/jobs/{id}` | Update job |
| `DELETE` | `/api/jobs/{id}` | Delete job |
| `PUT` | `/api/jobs/{id}/status` | Set status: active / archived / closed |
| `POST` | `/api/jobs/{id}/clone` | Clone job |
| `POST` | `/api/jobs/suggest-skills` | AI skill suggestions from title + description |
| `POST` | `/api/jobs/extract-text` | Extract text from JD file |
| `POST` | `/api/jobs/{id}/rediscover-talent` | Find hidden matches for job |

### Ranking `/api/rank`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/rank` | Rank all candidates for a job (optional custom weights) |
| `GET` | `/api/rank/{job_id}/candidate/{candidate_id}/decision` | AI debate + decision card |
| `GET` | `/api/rank/compare` | Compare two candidates for a job |

### Intelligence `/api/intelligence`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/intelligence/{id}/linkedin` | LinkedIn intelligence scores |
| `GET` | `/api/intelligence/{id}/benchmark` | Benchmark percentile data |
| `GET` | `/api/intelligence/{id}/audit` | Ranking audit breakdown |
| `POST` | `/api/intelligence/talent-rediscovery` | Semantic talent search |
| `GET` | `/api/intelligence/pipeline-events/{session_id}` | SSE pipeline telemetry stream |

### ATS `/api/ats`

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `GET` | `/api/ats` | List ATS records (optional `?job_id=`) |
| `GET` | `/api/ats/summary` | Stage count summary |
| `POST` | `/api/ats` | Create ATS record |
| `PATCH` | `/api/ats/{id}` | Update stage / notes |
| `DELETE` | `/api/ats/{id}` | Delete record |
| `GET` | `/api/ats/score/{candidate_id}/{job_id}` | ATS keyword compatibility score |

### Other

| Method | Endpoint | Description |
| ------ | -------- | ----------- |
| `POST` | `/api/copilot` | Recruiter copilot chat |
| `GET` | `/api/team` | List team members |
| `POST` | `/api/team` | Add team member |
| `DELETE` | `/api/team/{id}` | Remove team member |
| `GET` | `/api/admin/audit-logs` | Security audit log (admin) |

---

## 🗄 Database Schema

```mermaid
erDiagram
    Job ||--o{ ATSRecord : tracks
    Candidate ||--o{ ATSRecord : has
    User ||--o{ AuditLog : performs
    GraphNode ||--o{ GraphEdge : connects

    Job {
        int id PK
        string title
        text description
        string status
        string benchmark_profile
        json graph_schema
        datetime created_at
    }

    Candidate {
        int id PK
        string name
        string email
        text resume_text
        json skills
        json career_history
        json github_stats
        json linkedin_intelligence
        json ranking_explanations
        json redrob_signals
        datetime created_at
    }

    TeamMember {
        int id PK
        string name
        string role
        json skills
    }

    GraphNode {
        int id PK
        string type
        string name
        json attributes
    }

    GraphEdge {
        int id PK
        int from_node_id FK
        int to_node_id FK
        string type
        float weight
    }

    ATSRecord {
        int id PK
        int candidate_id FK
        int job_id FK
        string stage
        text notes
    }

    AuditLog {
        int id PK
        int user_id FK
        string action
        string ip_address
        json details
        datetime timestamp
    }
```

---

## 🔒 Security

| Measure | Implementation |
| ------- | -------------- |
| Prompt injection scanning | Regex patterns on resume text and copilot input (`prompt_protection.py`) |
| Rate limiting | Redis sliding window — 100 req/min global, 5 req/min auth paths |
| Security headers | `X-Frame-Options`, `X-Content-Type-Options`, CSP, HSTS |
| File validation | Extension whitelist + PDF/DOCX magic-byte verification |
| Audit logging | All uploads, ranking runs, ATS changes, injection attempts logged |
| Input sanitization | HTML entity escaping on user-provided job/team strings |
| Demo auth mode | `require_role()` returns admin demo user — no login gate for hackathon demo |

> **Production note:** Replace demo auth (`backend/app/core/auth.py`) with real JWT authentication before exposing publicly.

---

## ⚡ Performance Optimizations

| Optimization | Details |
| ------------ | ------- |
| Connection pooling | PostgreSQL pool (20 connections, 10 overflow) with `pool_pre_ping` |
| Redis caching | GitHub analysis (24h TTL, stale-while-revalidate), ranking explanations (24h), copilot history |
| Vector search | Qdrant cosine similarity; FAISS `IndexFlatIP` fallback with ID mapping |
| Batch embedding upsert | Candidates indexed in Qdrant on upload, not at rank time |
| Ranking cache invalidation | Job updates flush Redis explanation keys for that job |
| Exponential backoff | Gemini API calls retry up to 3× with backoff |
| SSE pipeline streaming | Incremental events instead of polling during upload |
| Heap-based batch ranking | `rank_candidates.py` processes JSONL with O(n log 100) top-k heap |

---
## Screenshots 📷
![alt text](talentrank_1.png)
![alt text](talentrank_2.png)
![alt text](talentrank_3.png)
![alt text](talentrank_4.png)



---

## 🎥 Demo

> No demo video is included in this repository.

### link🔗: https://drive.google.com/file/d/1x7rOzjD4lnBdSHuUGOgT2bG2Qe5rd7LT/view?usp=drive_link

---

---

## 🐳 Docker

### Services

| Service | Image | Port | Purpose |
| ------- | ----- | ---- | ------- |
| `db` | postgres:16 | 5432 | Primary relational store |
| `qdrant` | qdrant/qdrant:latest | 6333 | Vector embeddings |
| `redis` | redis:7 | 6379 | Cache + rate limiting |
| `backend` | `./backend/Dockerfile` | 8000 | FastAPI API |
| `frontend` | `./frontend/Dockerfile` | 3000 | Next.js UI |

### Volumes

Persistent data: `postgres_data`, `qdrant_data`, `redis_data`

### Development

Backend mounts `./backend:/workspace` for live code reload. Frontend mounts `./frontend:/app` with anonymous `node_modules` volume.

### Production Notes

- Set strong Postgres credentials
- Provide `GEMINI_API_KEY` and optional `GITHUB_TOKEN`
- Configure `NEXT_PUBLIC_API_URL` to your public backend URL
- Run frontend with `npm start` (production build baked into Docker image)

---

## 🚀 Deployment

```bash
# 1. Provision server with Docker
# 2. Clone repo and copy .env.example → .env
# 3. Build and run
docker compose up -d --build

# 4. Verify health
curl http://localhost:8000/api/health
```

For split deployment: run Postgres, Qdrant, and Redis as managed services; point `DATABASE_URL`, `QDRANT_HOST`, and `REDIS_HOST` accordingly.

---

## 📈 Scalability

| Component | Scale Strategy |
| --------- | -------------- |
| API | Horizontal — stateless FastAPI workers behind a load balancer |
| Ranking | CPU-bound per request; cache explanations in Redis; offload to background tasks for large batches |
| Embeddings | Qdrant supports sharding and cloud hosting |
| Database | PostgreSQL read replicas; connection pool already configured |
| File uploads | Move to object storage (S3/GCS) for multi-GB resume archives |
| Vector fallback | FAISS suitable for dev/single-node; Qdrant for production scale |

---

## 🎯 Hackathon Highlights

| Dimension | Highlight |
| --------- | --------- |
| **Innovation** | 18-factor explainable ranking with skill adjacency graph — not just keyword overlap |
| **AI Usage** | End-to-end Gemini pipeline: parse → embed → rank → explain → debate → outreach |
| **Real-World Value** | Solves recruiter pain: opaque ATS scores, missed adjacent-skill candidates, no interview prep |
| **Technical Depth** | Triple-store architecture (SQL + vector + cache) with graceful degradation at every layer |
| **User Experience** | Single dashboard for ingestion, ranking, intelligence, ATS, and copilot — no context switching |
| **Submission Ready** | `rank_candidates.py` ranks 100K+ JSONL candidates in seconds; CSV export built-in |

---

## 🔮 Future Roadmap

- [ ] Enable real JWT authentication (User model and bcrypt already scaffolded)
- [x] Add `.env.example` template to repository
- [ ] Background job queue for batch ranking (Celery / ARQ)
- [ ] LinkedIn API integration (currently rule-based from parsed resume data)
- [ ] Hosted demo deployment with sample job + anonymized resumes
- [ ] Webhook notifications for ATS stage changes
- [ ] Multi-tenant organization support

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and add tests in `backend/tests/`
4. Run `pytest` and `npm run lint`
5. Open a pull request with a clear description

---

## 📄 License

No license file is included in this repository. Add one before public distribution.

---

## 👨‍💻 Author

Built as an AI Recruiter / Talent Intelligence hackathon project.

For questions or demo requests, open a GitHub issue in this repository.
