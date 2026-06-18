import logging
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels
from app.core.config import settings

logger = logging.getLogger(__name__)

vector_status = {
    "type": "qdrant",
    "status": "connected"
}

class LocalVectorIndex:
    def __init__(self):
        self.id_to_vector = {}
        self.id_to_payload = {}
        self._faiss_index = None
        self._use_faiss = False
        
        try:
            import faiss
            import numpy as np
            self._use_faiss = True
            logger.info("FAISS detected. Vector engine using FAISS in fallback mode.")
            vector_status["type"] = "faiss"
        except ImportError:
            logger.info("FAISS not found. Vector engine using NumPy Cosine Similarity in fallback mode.")
            vector_status["type"] = "numpy"

    def upsert(self, point_id: int, vector: list, payload: dict):
        self.id_to_vector[point_id] = vector
        self.id_to_payload[point_id] = payload
        self._faiss_index = None  # invalidate cache to trigger rebuild on next search

    def _rebuild_faiss_index(self):
        import faiss
        import numpy as np
        if not self.id_to_vector:
            self._faiss_index = None
            return
        
        ids = list(self.id_to_vector.keys())
        vectors = [self.id_to_vector[i] for i in ids]
        
        data = np.array(vectors, dtype=np.float32)
        norms = np.linalg.norm(data, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        data = data / norms
        
        dimension = data.shape[1]
        index = faiss.IndexIDMap2(faiss.IndexFlatIP(dimension))
        index.add_with_ids(data, np.array(ids, dtype=np.int64))
        self._faiss_index = index

    def search(self, query_vector: list, limit: int = 50) -> list:
        if not self.id_to_vector:
            return []
            
        import numpy as np
        q_vec = np.array(query_vector, dtype=np.float32)
        
        if self._use_faiss:
            try:
                import faiss
                if self._faiss_index is None:
                    self._rebuild_faiss_index()
                
                if self._faiss_index is not None:
                    q_norm = np.linalg.norm(q_vec)
                    if q_norm > 0:
                        q_vec = q_vec / q_norm
                    
                    q_vec = q_vec.reshape(1, -1)
                    scores, ids = self._faiss_index.search(q_vec, min(limit, len(self.id_to_vector)))
                    
                    results = []
                    for score, pid in zip(scores[0], ids[0]):
                        if pid == -1:
                            continue
                        results.append({
                            "candidate_id": int(pid),
                            "score": float(score),
                            "payload": self.id_to_payload.get(int(pid), {})
                        })
                    return results
            except Exception as e:
                logger.warning(f"FAISS search failed: {e}. Falling back to NumPy search.")
        
        # NumPy Cosine Similarity fallback
        results = []
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            q_norm = 1.0
        q_norm_vec = q_vec / q_norm

        for pid, vec in self.id_to_vector.items():
            v = np.array(vec, dtype=np.float32)
            v_norm = np.linalg.norm(v)
            if v_norm == 0:
                v_norm = 1.0
            v_norm_vec = v / v_norm
            
            score = float(np.dot(q_norm_vec, v_norm_vec))
            results.append({
                "candidate_id": pid,
                "score": score,
                "payload": self.id_to_payload.get(pid, {})
            })
            
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

class QdrantManager:
    def __init__(self):
        self._client = None
        self.collection_name = "candidates"
        self._use_fallback = False
        self._local_index = LocalVectorIndex()

    @property
    def client(self) -> QdrantClient:
        if self._client is None:
            self._client = QdrantClient(
                host=settings.QDRANT_HOST,
                port=settings.QDRANT_PORT
            )
        return self._client

    def ping(self) -> bool:
        if self._use_fallback:
            return False
        try:
            self.client.get_collections()
            vector_status["type"] = "qdrant"
            vector_status["status"] = "connected"
            return True
        except Exception:
            pass
        
        self._use_fallback = True
        vector_status["status"] = "fallback"
        # Type is updated to faiss or numpy by the LocalVectorIndex constructor
        logger.warning(f"Qdrant unreachable. Using local vector search: {vector_status['type']}")
        return False

    def init_collection(self, vector_size: int = 768):
        if self.ping():
            try:
                collections = self.client.get_collections().collections
                exists = any(c.name == self.collection_name for c in collections)
                if not exists:
                    logger.info(f"Creating Qdrant collection: {self.collection_name} with size {vector_size}")
                    self.client.create_collection(
                        collection_name=self.collection_name,
                        vectors_config=qmodels.VectorParams(
                            size=vector_size,
                            distance=qmodels.Distance.COSINE
                        )
                    )
                else:
                    logger.info(f"Qdrant collection {self.collection_name} already exists.")
                return
            except Exception as e:
                logger.error(f"Error initializing Qdrant collection: {e}. Switching to fallback vector index.")
                self._use_fallback = True
                vector_status["status"] = "fallback"
        
        logger.info("Initializing fallback vector index.")

    def upsert_candidate(self, candidate_id: int, vector: list, payload: dict):
        # Always update local index first as local backup
        self._local_index.upsert(candidate_id, vector, payload)
        
        if not self._use_fallback:
            try:
                self.client.upsert(
                    collection_name=self.collection_name,
                    points=[
                        qmodels.PointStruct(
                            id=candidate_id,
                            vector=vector,
                            payload=payload
                        )
                    ]
                )
                return
            except Exception as e:
                logger.error(f"Failed to upsert candidate {candidate_id} to Qdrant: {e}. Falling back.")
                self._use_fallback = True
                vector_status["status"] = "fallback"

    def search_candidates(self, query_vector: list, limit: int = 50) -> list:
        if not self._use_fallback:
            try:
                results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_vector,
                    limit=limit
                )
                return [
                    {
                        "candidate_id": res.id,
                        "score": res.score,
                        "payload": res.payload
                    }
                    for res in results
                ]
            except Exception as e:
                logger.error(f"Error searching Qdrant: {e}. Switching to fallback index.")
                self._use_fallback = True
                vector_status["status"] = "fallback"
        
        return self._local_index.search(query_vector, limit=limit)

qdrant_manager = QdrantManager()

