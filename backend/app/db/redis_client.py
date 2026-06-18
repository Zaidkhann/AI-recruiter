import json
import logging
import redis
from app.core.config import settings

logger = logging.getLogger(__name__)

cache_status = {
    "type": "redis",
    "status": "connected"
}

class RedisManager:
    def __init__(self):
        self._client = None
        self._use_fallback = False
        self._fallback_db = {}

    @property
    def client(self) -> redis.Redis:
        if self._client is None:
            self._client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                decode_responses=True,
                socket_timeout=2.0
            )
        return self._client

    def ping(self) -> bool:
        if self._use_fallback:
            return False
        try:
            is_connected = self.client.ping()
            if is_connected:
                cache_status["type"] = "redis"
                cache_status["status"] = "connected"
                return True
        except Exception:
            pass
        
        self._use_fallback = True
        cache_status["type"] = "memory"
        cache_status["status"] = "fallback"
        logger.warning("Redis is unreachable. Using local memory cache fallback.")
        return False

    def cache_weights(self, job_id: int, weights: dict):
        if not self._use_fallback:
            try:
                key = f"weights:job:{job_id}"
                self.client.set(key, json.dumps(weights), ex=3600)
                return
            except Exception as e:
                logger.warning(f"Redis write error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback
        self._fallback_db[f"weights:job:{job_id}"] = json.dumps(weights)

    def get_weights(self, job_id: int) -> dict:
        if not self._use_fallback:
            try:
                key = f"weights:job:{job_id}"
                data = self.client.get(key)
                if data:
                    return json.loads(data)
                return {}
            except Exception as e:
                logger.warning(f"Redis read error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback
        data = self._fallback_db.get(f"weights:job:{job_id}")
        if data:
            return json.loads(data)
        return {}

    def append_copilot_chat(self, session_id: str, message: dict):
        if not self._use_fallback:
            try:
                key = f"copilot:chat:{session_id}"
                self.client.rpush(key, json.dumps(message))
                self.client.expire(key, 7200)
                return
            except Exception as e:
                logger.warning(f"Redis write error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback
        key = f"copilot:chat:{session_id}"
        if key not in self._fallback_db:
            self._fallback_db[key] = []
        self._fallback_db[key].append(json.dumps(message))

    def get_copilot_chat(self, session_id: str) -> list:
        if not self._use_fallback:
            try:
                key = f"copilot:chat:{session_id}"
                data = self.client.lrange(key, 0, -1)
                return [json.loads(item) for item in data]
            except Exception as e:
                logger.warning(f"Redis read error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback
        key = f"copilot:chat:{session_id}"
        data = self._fallback_db.get(key, [])
        return [json.loads(item) for item in data]

    # --- Generic Cache Methods (used by GitHub service, etc.) ---

    def cache_set(self, key: str, data: dict, ttl: int = 86400):
        """Store JSON-serializable data with TTL (default 24h). Falls back to memory cache."""
        payload = json.dumps(data)
        if not self._use_fallback:
            try:
                self.client.set(key, payload, ex=ttl)
                return
            except Exception as e:
                logger.warning(f"Redis cache_set error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback — store with expiry metadata
        import time
        self._fallback_db[key] = {
            "_payload": payload,
            "_expires_at": time.time() + ttl
        }

    def cache_get(self, key: str) -> dict | None:
        """Retrieve cached JSON data. Returns None if missing or expired."""
        if not self._use_fallback:
            try:
                raw = self.client.get(key)
                if raw:
                    return json.loads(raw)
                return None
            except Exception as e:
                logger.warning(f"Redis cache_get error, switching to memory fallback: {e}")
                self._use_fallback = True
                cache_status["type"] = "memory"
                cache_status["status"] = "fallback"

        # Fallback
        import time
        entry = self._fallback_db.get(key)
        if entry and isinstance(entry, dict) and "_payload" in entry:
            if time.time() < entry.get("_expires_at", 0):
                return json.loads(entry["_payload"])
            else:
                del self._fallback_db[key]
                return None
        return None

redis_manager = RedisManager()

