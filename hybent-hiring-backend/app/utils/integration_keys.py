"""
Integration keys: how machine clients (n8n) authenticate to /v1/integrations/*.

A key looks like ``hyb_<env>_<key_id>_<secret>``:
  - key_id  — 16 hex chars, stored in plain text and used to look the key up
              (and to bucket its rate limit);
  - secret  — 64 hex chars, stored only as a SHA-256 hash.
The full key is shown once, when it is created, and can't be recovered.
No database imports — pure helpers, mirrors app/utils/crypto.py's style.
"""
import hashlib
import hmac
import re
import secrets
from typing import NamedTuple

KEY_PREFIX = "hyb"

# Everything an integration key can be allowed to do. A key gets only the
# scopes it is created with; endpoints check for the one they need.
SCOPES = frozenset({
    "reports:read",       # aggregated hiring reports
    "ops:read",           # health counters and reconciliation lists
    "ops:write",          # record workflow runs, requeue stuck work
    "candidates:read",    # minimal candidate state
    "candidates:import",  # create candidates (always land in needs_review)
    "messages:send",      # send allowlisted email templates
    "interviews:read",    # upcoming interviews
})

_KEY_RE = re.compile(r"^hyb_(live|test)_([0-9a-f]{16})_([0-9a-f]{64})$")


class GeneratedKey(NamedTuple):
    key_id: str
    secret_hash: str
    full_key: str


class ParsedKey(NamedTuple):
    key_id: str
    secret: str


def hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def generate_key(is_production: bool) -> GeneratedKey:
    env = "live" if is_production else "test"
    key_id = secrets.token_hex(8)
    secret = secrets.token_hex(32)
    return GeneratedKey(key_id, hash_secret(secret), f"{KEY_PREFIX}_{env}_{key_id}_{secret}")


def parse_key(raw: str | None) -> ParsedKey | None:
    """Split a presented key into (key_id, secret); None if it isn't one."""
    match = _KEY_RE.match((raw or "").strip())
    if not match:
        return None
    return ParsedKey(match.group(2), match.group(3))


def key_id_from_header(raw: str | None) -> str | None:
    parsed = parse_key(raw)
    return parsed.key_id if parsed else None


def secret_matches(secret: str, secret_hash: str) -> bool:
    return hmac.compare_digest(hash_secret(secret), secret_hash)
