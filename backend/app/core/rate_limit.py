import time
import logging
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.db.redis_client import redis_manager
from app.db.database import SessionLocal
from app.core.audit import log_audit_event

logger = logging.getLogger("rate_limiter")

class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, requests_limit: int = 100, auth_limit: int = 5, window_seconds: int = 60):
        super().__init__(app)
        self.requests_limit = requests_limit
        self.auth_limit = auth_limit
        self.window_seconds = window_seconds
        
    async def dispatch(self, request: Request, call_next):
        # Allow preflight requests without rate limiting
        if request.method == "OPTIONS":
            return await call_next(request)
            
        client_ip = request.client.host if request.client else "unknown"
        path = request.url.path
        
        # Decide limit based on path
        is_auth = path.startswith("/api/auth/login") or path.startswith("/api/auth/register")
        limit = self.auth_limit if is_auth else self.requests_limit
        
        key = f"rate_limit:{client_ip}:{ 'auth' if is_auth else 'global' }"
        current_time = time.time()
        
        # Fetch timestamps using Redis or memory fallback
        if not redis_manager._use_fallback:
            try:
                pipe = redis_manager.client.pipeline()
                pipe.rpush(key, current_time)
                pipe.expire(key, self.window_seconds)
                pipe.lrange(key, 0, -1)
                res = pipe.execute()
                timestamps = [float(t) for t in res[2]]
            except Exception:
                # Fallback to local memory dictionary if Redis call fails
                timestamps = self._memory_rate_limit(key, current_time)
        else:
            timestamps = self._memory_rate_limit(key, current_time)
            
        # Filter timestamps outside the time window
        valid_timestamps = [t for t in timestamps if current_time - t < self.window_seconds]
        
        # Update cache with valid timestamps
        if not redis_manager._use_fallback:
            try:
                pipe = redis_manager.client.pipeline()
                pipe.delete(key)
                if valid_timestamps:
                    pipe.rpush(key, *valid_timestamps)
                    pipe.expire(key, self.window_seconds)
                pipe.execute()
            except Exception:
                pass
        else:
            redis_manager._fallback_db[key] = valid_timestamps
            
        # Check if rate limit exceeded
        if len(valid_timestamps) > limit:
            logger.warning(f"Rate limit exceeded for IP: {client_ip} on path: {path}")
            
            # Log security audit event for auth rate limit block
            if is_auth:
                db = SessionLocal()
                try:
                    log_audit_event(
                        db=db,
                        action="RATE_LIMIT_EXCEEDED",
                        username=None,
                        user_id=None,
                        ip_address=client_ip,
                        details={"path": path, "limit": limit}
                    )
                finally:
                    db.close()
                    
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )
            
        return await call_next(request)
        
    def _memory_rate_limit(self, key: str, current_time: float) -> list:
        if key not in redis_manager._fallback_db:
            redis_manager._fallback_db[key] = []
        redis_manager._fallback_db[key].append(current_time)
        return redis_manager._fallback_db[key]
