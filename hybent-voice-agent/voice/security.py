"""
Client API keys and callback signatures.

Keys are stored as SHA-256 hashes (they are random 32-byte tokens, so a
slow hash adds nothing). Callbacks carry
    X-Voice-Timestamp: <unix seconds>
    X-Voice-Signature: sha256=<hex HMAC of "<timestamp>.<raw body>">
so a receiver can reject forged or replayed deliveries.
"""
import hashlib
import hmac
import secrets

KEY_PREFIX = "hvk_"


def generate_key() -> str:
    return KEY_PREFIX + secrets.token_urlsafe(32)


def generate_secret() -> str:
    return secrets.token_urlsafe(32)


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def sign(secret: str, timestamp: str, body: bytes) -> str:
    mac = hmac.new(secret.encode(), timestamp.encode() + b"." + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def verify(secret: str, timestamp: str, body: bytes, signature: str) -> bool:
    return hmac.compare_digest(sign(secret, timestamp, body), signature)
