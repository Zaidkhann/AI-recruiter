import json
from sqlalchemy.orm import Session
from app.db.database import SessionLocal, Base, engine
from app.db.models import Job, Candidate, TeamMember, GraphNode, GraphEdge
from app.db.qdrant_client import qdrant_manager
from app.services.llm_service import llm_service

def seed_data():
    db = SessionLocal()
    # Recreate tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Initialize Qdrant collection
    qdrant_manager.init_collection()

    print("Seeding default users...")
    from app.core.auth import get_password_hash
    from app.db.models import User
    
    users = [
        User(username="admin", hashed_password=get_password_hash("admin123"), role="admin"),
        User(username="recruiter", hashed_password=get_password_hash("recruiter123"), role="recruiter"),
        User(username="viewer", hashed_password=get_password_hash("viewer123"), role="viewer")
    ]
    for u in users:
        db.add(u)
    db.commit()

    print("Seeding database content...")


    # 1. Seed existing team members
    team = [
        TeamMember(name="Sarah Jenkins", role="Engineering Manager", skills=["Python", "SQL", "Agile"]),
        TeamMember(name="Alex Rivera", role="Senior Frontend Engineer", skills=["React", "TypeScript", "Next.js", "Tailwind"]),
        TeamMember(name="Vikram Patel", role="Staff Backend Engineer", skills=["Python", "PostgreSQL", "FastAPI", "Redis"])
    ]
    for member in team:
        db.add(member)
    db.commit()

    # 2. Seed skill graph nodes
    skills = [
        "Python", "PyTorch", "TensorFlow", "Jax", "FastAPI", "Flask", "Django",
        "React", "Vue", "Next.js", "Typescript", "Docker", "Kubernetes",
        "AWS", "GCP", "PostgreSQL", "Redis", "Rust", "Go", "C++"
    ]
    node_mapping = {}
    for skill in skills:
        node = GraphNode(type="SKILL", name=skill, attributes={"level": "language_or_framework"})
        db.add(node)
        db.flush()
        node_mapping[skill.lower()] = node.id

    # 3. Seed skill graph edges (Related / Is-A links)
    edges = [
        # AI/ML cluster
        ("python", "pytorch", "RELATED_TO", 0.9),
        ("python", "tensorflow", "RELATED_TO", 0.8),
        ("pytorch", "tensorflow", "RELATED_TO", 0.7),
        ("pytorch", "jax", "RELATED_TO", 0.8),
        
        # Web Frameworks cluster
        ("python", "fastapi", "RELATED_TO", 0.85),
        ("python", "flask", "RELATED_TO", 0.8),
        ("python", "django", "RELATED_TO", 0.75),
        ("fastapi", "flask", "RELATED_TO", 0.7),
        
        # Frontend cluster
        ("typescript", "react", "RELATED_TO", 0.8),
        ("react", "next.js", "RELATED_TO", 0.95),
        ("react", "vue", "RELATED_TO", 0.6),
        
        # Devops/Cloud
        ("docker", "kubernetes", "RELATED_TO", 0.9),
        ("kubernetes", "aws", "RELATED_TO", 0.8),
        ("kubernetes", "gcp", "RELATED_TO", 0.8),
        ("aws", "gcp", "RELATED_TO", 0.7),
        
        # Systems Cluster
        ("rust", "cpp", "RELATED_TO", 0.75),
        ("go", "rust", "RELATED_TO", 0.7)
    ]
    for from_skill, to_skill, type_val, weight in edges:
        from_id = node_mapping.get(from_skill.lower())
        to_id = node_mapping.get(to_skill.lower())
        if from_id and to_id:
            edge = GraphEdge(from_node_id=from_id, to_node_id=to_id, type=type_val, weight=weight)
            db.add(edge)
    db.commit()

    # 4. Seed Job description
    jobs = [
        Job(
            title="Senior AI Backend Architect",
            description="We are looking for a backend engineer to design our core machine learning pipelines and vector search infrastructure. You will construct REST endpoints, scale model inferences, and set up Kubernetes deployments. Ideal candidate has deep experience in Python, PyTorch, FastAPI, and Cloud deployments (AWS/GCP). Experience with Rust is a plus.",
            benchmark_profile="YC_FOUNDING_ENGINEER",
            graph_schema={
                "skills_required": ["Python", "PyTorch", "FastAPI", "Kubernetes", "AWS"],
                "experience_level": "SENIOR",
                "domains": ["AI Engineering", "Cloud Infrastructure"],
                "key_requirements": ["5+ years backend systems experience", "Deep learning model scaling knowledge"],
                "inferred_prerequisites": ["Docker", "PostgreSQL", "Vector Databases"]
            }
        ),
        Job(
            title="Staff Systems Infrastructure Engineer",
            description="Seeking a systems engineer to rewrite our core performance bottlenecks in Rust and C++. Responsibilities include building custom memory managers, optimizing network latency, and maintaining Kubernetes infrastructure. Strong systems background is a must.",
            benchmark_profile="FAANG_STAFF",
            graph_schema={
                "skills_required": ["Rust", "C++", "Kubernetes", "Docker"],
                "experience_level": "STAFF",
                "domains": ["Systems Engineering", "Infrastructure Operations"],
                "key_requirements": ["8+ years low-level development experience", "Distributed database internals"],
                "inferred_prerequisites": ["Linux Kernel", "gRPC"]
            }
        )
    ]
    for job in jobs:
        db.add(job)
    db.commit()

    # 5. Seed detailed candidate profiles (varies skills, tenures, github metrics)
    candidates_data = [
        {
            "name": "Devin AI Carter",
            "email": "devin@carter.dev",
            "resume_text": "Experienced Machine Learning Developer with 4 years building deep learning architectures. Highly active in open-source AI projects. Core expertise: Python, PyTorch, FastAPI, Docker, GCP.",
            "skills": ["Python", "PyTorch", "FastAPI", "Docker", "GCP", "Redis"],
            "github_username": "devincarter_ai",
            "github_stats": {
                "commits_count": 1250,
                "pull_requests_count": 82,
                "issues_count": 34,
                "stars_count": 140,
                "forks_count": 28,
                "repos_count": 18
            },
            "career_history": [
                {"company": "HyperAI", "title": "Senior ML Engineer", "duration_months": 18, "description": "Scaled PyTorch inference pipelines using FastAPI", "seniority": "SENIOR"},
                {"company": "NeuraCorp", "title": "Software Engineer (AI)", "duration_months": 24, "description": "Constructed ETL workflows for model training sets", "seniority": "MID"}
            ],
            "certifications": ["Google Cloud Certified MLE"],
            "phone": "+1-555-0199",
            "location": "San Francisco, CA",
            "education": [{"school": "Stanford University", "degree": "M.S.", "field_of_study": "Computer Science", "graduation_year": "2021"}],
            "github_url": "https://github.com/devincarter_ai",
            "linkedin_url": "https://linkedin.com/in/devin-carter-ai",
            "portfolio_url": "https://carter.dev",
            "personal_website": "https://carter.dev",
            "twitter_x": "https://twitter.com/devin_ai"
        },
        {
            "name": "Elena Rostova",
            "email": "elena@rostova.io",
            "resume_text": "Staff Systems Engineer specializing in low-latency Rust application architecture. Former Linux kernel team contributor. Built highly concurrent systems and Docker engines. Core skills: Rust, C++, Kubernetes, Docker, WebAssembly.",
            "skills": ["Rust", "C++", "Kubernetes", "Docker", "Go", "AWS"],
            "github_username": "elena_rust",
            "github_stats": {
                "commits_count": 1980,
                "pull_requests_count": 124,
                "issues_count": 55,
                "stars_count": 320,
                "forks_count": 68,
                "repos_count": 12
            },
            "career_history": [
                {"company": "CloudScale Inc", "title": "Lead Infrastructure Architect", "duration_months": 36, "description": "Migrated legacy microservices from C++ to Rust; automated cluster configurations", "seniority": "LEAD"},
                {"company": "Kernel Labs", "title": "Staff Engineer", "duration_months": 48, "description": "Maintained network device driver modules and hypervisors", "seniority": "STAFF"}
            ],
            "certifications": ["Certified Kubernetes Administrator (CKA)"],
            "phone": "+1-555-0144",
            "location": "Seattle, WA",
            "education": [{"school": "University of Washington", "degree": "B.S.", "field_of_study": "Computer Engineering", "graduation_year": "2018"}],
            "github_url": "https://github.com/elena_rust",
            "linkedin_url": "https://linkedin.com/in/elena-rostova",
            "portfolio_url": "https://rostova.io",
            "personal_website": "https://rostova.io",
            "twitter_x": None
        },
        {
            "name": "Marcus Hopson",
            "email": "marcus@hopson.tech",
            "resume_text": "Full stack generalist who thrives in dynamic early-stage startups. Constantly experimenting with new web frameworks. Fast learner with strong React, Node.js, and Python expertise. High frequency GitHub builder.",
            "skills": ["Python", "React", "Next.js", "Typescript", "Flask", "PostgreSQL"],
            "github_username": "mhopson_builds",
            "github_stats": {
                "commits_count": 890,
                "pull_requests_count": 45,
                "issues_count": 12,
                "stars_count": 45,
                "forks_count": 8,
                "repos_count": 32
            },
            "career_history": [
                {"company": "StartupX", "title": "Software Engineer", "duration_months": 8, "description": "Shipped next.js admin dash; database architecture on Postgres", "seniority": "MID"},
                {"company": "AppForge", "title": "Junior Developer", "duration_months": 11, "description": "Integrated third-party APIs using Flask", "seniority": "JUNIOR"},
                {"company": "LaunchPad", "title": "Developer Intern", "duration_months": 6, "description": "Built mock prototypes in React", "seniority": "JUNIOR"}
            ],
            "certifications": [],
            "phone": "+1-555-0182",
            "location": "Austin, TX",
            "education": [{"school": "University of Texas at Austin", "degree": "B.A.", "field_of_study": "Management Information Systems", "graduation_year": "2020"}],
            "github_url": "https://github.com/mhopson_builds",
            "linkedin_url": "https://linkedin.com/in/marcus-hopson",
            "portfolio_url": "https://hopson.tech",
            "personal_website": "https://hopson.tech",
            "twitter_x": "https://twitter.com/mhopson"
        },
        {
            "name": "Amina Al-Farsi",
            "email": "amina@alfarsi.net",
            "resume_text": "Backend Engineer with 6 years experience. Expert in database optimizations, SQLAlchemy, FastAPI and Kubernetes clusters. Focused on career stability and clean test-driven code.",
            "skills": ["Python", "FastAPI", "PostgreSQL", "Kubernetes", "Docker", "AWS"],
            "github_username": "amina_backend",
            "github_stats": {
                "commits_count": 320,
                "pull_requests_count": 18,
                "issues_count": 8,
                "stars_count": 12,
                "forks_count": 3,
                "repos_count": 7
            },
            "career_history": [
                {"company": "SecureBank", "title": "Senior Database Engineer", "duration_months": 42, "description": "Optimized transaction storage queries; maintained strict schema migrations", "seniority": "SENIOR"},
                {"company": "Fintech Solutions", "title": "Software Engineer", "duration_months": 30, "description": "Built APIs using Django and deployed to Kubernetes", "seniority": "MID"}
            ],
            "certifications": ["AWS Solutions Architect Associate"],
            "phone": "+1-555-0163",
            "location": "Boston, MA",
            "education": [{"school": "MIT", "degree": "B.S.", "field_of_study": "Electrical Engineering and Computer Science", "graduation_year": "2017"}],
            "github_url": "https://github.com/amina_backend",
            "linkedin_url": "https://linkedin.com/in/amina-alfarsi",
            "portfolio_url": "https://alfarsi.net",
            "personal_website": "https://alfarsi.net",
            "twitter_x": None
        }
    ]

    for c_data in candidates_data:
        cand = Candidate(
            name=c_data["name"],
            email=c_data["email"],
            resume_text=c_data["resume_text"],
            skills=c_data["skills"],
            github_username=c_data["github_username"],
            github_stats=c_data["github_stats"],
            career_history=c_data["career_history"],
            certifications=c_data["certifications"],
            phone=c_data["phone"],
            location=c_data["location"],
            education=c_data["education"],
            github_url=c_data["github_url"],
            linkedin_url=c_data["linkedin_url"],
            portfolio_url=c_data["portfolio_url"],
            personal_website=c_data["personal_website"],
            twitter_x=c_data["twitter_x"]
        )
        db.add(cand)
        db.flush()

        # Generate and cache embeddings in Qdrant
        embedding_text = f"{cand.name} {cand.resume_text} {' '.join(cand.skills)}"
        vector = llm_service.get_embedding(embedding_text)
        
        payload = {
            "name": cand.name,
            "skills": cand.skills,
            "github_username": cand.github_username
        }
        qdrant_manager.upsert_candidate(candidate_id=cand.id, vector=vector, payload=payload)

    db.commit()
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_data()
