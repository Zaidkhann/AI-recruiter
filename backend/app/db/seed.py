from app.db.database import SessionLocal, Base, engine
from app.db.models import TeamMember, GraphNode, GraphEdge
from app.db.qdrant_client import qdrant_manager

def seed_data():
    db = SessionLocal()
    # Recreate tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    # Initialize Qdrant collection
    qdrant_manager.init_collection()


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
    db.close()
    print("Database seeding completed successfully!")

if __name__ == "__main__":
    seed_data()
