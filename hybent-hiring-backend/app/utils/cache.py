from functools import wraps
import time

def timed_lru_cache(seconds: int, maxsize: int = 128):
    """
    Extension of alru_cache that expires after `seconds`.
    Note: alru_cache doesn't natively support TTL, so we embed the time window in the cache key
    or just use a simple wrapper that invalidates.
    Actually, a much simpler approach for FastAPI dependencies is to use a manual dictionary with TTL
    since we need to cache based on organization_id and the current user.
    """
    def wrapper_cache(func):
        cache = {}
        
        @wraps(func)
        async def wrapped(*args, **kwargs):
            # Try to build a cache key from kwargs (like organization_id)
            # If complex, just stringify
            key = str(args) + str(kwargs)
            now = time.monotonic()
            
            if key in cache:
                result, timestamp = cache[key]
                if now - timestamp < seconds:
                    return result
            
            # Cache miss or expired
            result = await func(*args, **kwargs)
            cache[key] = (result, now)
            
            # Clean up old entries if cache gets too big
            if len(cache) > maxsize:
                # Remove oldest
                oldest_key = min(cache.keys(), key=lambda k: cache[k][1])
                del cache[oldest_key]
                
            return result
            
        return wrapped
    return wrapper_cache
