import networkx as nx
from sqlalchemy.orm import Session
from app.db.models import GraphNode, GraphEdge

class SkillAdjacencyEngine:
    def __init__(self):
        # Default fallback relationships for common tech stacks in case the DB graph is sparse
        self.fallbacks = {
            ("pytorch", "tensorflow"): 0.85,
            ("pytorch", "jax"): 0.80,
            ("fastapi", "flask"): 0.75,
            ("fastapi", "django"): 0.70,
            ("react", "vue"): 0.80,
            ("react", "angular"): 0.70,
            ("next.js", "react"): 0.90,
            ("docker", "kubernetes"): 0.85,
            ("aws", "gcp"): 0.80,
            ("aws", "azure"): 0.75,
            ("postgresql", "mysql"): 0.85,
            ("postgresql", "mongodb"): 0.65,
            ("typescript", "javascript"): 0.95,
            ("rust", "cpp"): 0.75,
            ("go", "rust"): 0.70,
            ("python", "r"): 0.60
        }

    def build_graph(self, db: Session) -> nx.Graph:
        """Builds a networkx Graph from GraphNode and GraphEdge in PostgreSQL"""
        G = nx.Graph()
        
        # Load skill nodes
        nodes = db.query(GraphNode).filter(GraphNode.type == "SKILL").all()
        for node in nodes:
            G.add_node(node.id, name=node.name.lower())
            
        # Load edges
        edges = db.query(GraphEdge).filter(GraphEdge.type.in_(["RELATED_TO", "IS_A"])).all()
        for edge in edges:
            G.add_edge(edge.from_node_id, edge.to_node_id, weight=edge.weight)
            
        return G

    def calculate_match(self, db: Session, candidate_skills: list, required_skills: list) -> float:
        """
        Calculates the adjacency score between candidate skills and required job skills.
        Returns a float between 0.0 and 1.0.
        """
        if not required_skills:
            return 1.0
        if not candidate_skills:
            return 0.0

        # Build skill graph
        G = self.build_graph(db)
        
        # Helper to find node ID by name
        name_to_id = {}
        for nid, data in G.nodes(data=True):
            name_to_id[data['name']] = nid

        total_score = 0.0
        for req_skill in required_skills:
            req_skill_lower = req_skill.lower()
            best_individual_score = 0.0
            
            for cand_skill in candidate_skills:
                cand_skill_lower = cand_skill.lower()
                
                # Direct match
                if req_skill_lower == cand_skill_lower:
                    best_individual_score = max(best_individual_score, 1.0)
                    continue
                
                # Check fallback static mapping
                fallback_pair = (req_skill_lower, cand_skill_lower)
                fallback_pair_rev = (cand_skill_lower, req_skill_lower)
                if fallback_pair in self.fallbacks:
                    best_individual_score = max(best_individual_score, self.fallbacks[fallback_pair])
                    continue
                if fallback_pair_rev in self.fallbacks:
                    best_individual_score = max(best_individual_score, self.fallbacks[fallback_pair_rev])
                    continue

                # Check graph path distance
                req_id = name_to_id.get(req_skill_lower)
                cand_id = name_to_id.get(cand_skill_lower)
                
                if req_id and cand_id:
                    try:
                        # Find shortest path
                        path_len = nx.shortest_path_length(G, source=req_id, target=cand_id, weight='weight')
                        # Convert path length to score. Closer means higher score
                        score = 1.0 / (1.0 + 0.5 * path_len)
                        best_individual_score = max(best_individual_score, score)
                    except nx.NetworkXNoPath:
                        pass
            
            total_score += best_individual_score

        # Average match score
        return total_score / len(required_skills)

    def calculate_direct_match_ratio(self, candidate_skills: list, required_skills: list) -> float:
        """Fraction of required skills with an exact match in the candidate profile."""
        if not required_skills:
            return 1.0
        if not candidate_skills:
            return 0.0
        c_set = {s.lower() for s in candidate_skills}
        j_set = {s.lower() for s in required_skills}
        return len(c_set.intersection(j_set)) / len(j_set)

    def calculate_adjacent_only_match(self, db: Session, candidate_skills: list, required_skills: list) -> float:
        """
        Adjacency score counting only graph/fallback relationships — excludes exact skill matches.
        Used to detect transferable/adjacent talent without direct overlap.
        """
        if not required_skills or not candidate_skills:
            return 0.0

        G = self.build_graph(db)
        name_to_id = {data["name"]: nid for nid, data in G.nodes(data=True)}

        total_score = 0.0
        for req_skill in required_skills:
            req_skill_lower = req_skill.lower()
            best_individual_score = 0.0

            for cand_skill in candidate_skills:
                cand_skill_lower = cand_skill.lower()
                if req_skill_lower == cand_skill_lower:
                    continue

                fallback_pair = (req_skill_lower, cand_skill_lower)
                fallback_pair_rev = (cand_skill_lower, req_skill_lower)
                if fallback_pair in self.fallbacks:
                    best_individual_score = max(best_individual_score, self.fallbacks[fallback_pair])
                    continue
                if fallback_pair_rev in self.fallbacks:
                    best_individual_score = max(best_individual_score, self.fallbacks[fallback_pair_rev])
                    continue

                req_id = name_to_id.get(req_skill_lower)
                cand_id = name_to_id.get(cand_skill_lower)
                if req_id and cand_id:
                    try:
                        path_len = nx.shortest_path_length(G, source=req_id, target=cand_id, weight="weight")
                        score = 1.0 / (1.0 + 0.5 * path_len)
                        best_individual_score = max(best_individual_score, score)
                    except nx.NetworkXNoPath:
                        pass

            total_score += best_individual_score

        return total_score / len(required_skills)

skill_adjacency_engine = SkillAdjacencyEngine()
