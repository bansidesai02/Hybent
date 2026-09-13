"""
Symmetric encryption helpers for at-rest secrets (OAuth tokens, SMTP passwords).
No database imports — pure crypto helpers, mirrors app/utils/security.py's style.
"""
import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _derive_fernet_key(raw_key: str) -> bytes:
    """
    Fernet requires a 32-byte urlsafe-base64 key. Accept any human-chosen
    string from env and derive a valid key from it via SHA-256, so a plain
    password-like value in EMAIL_ACCOUNTS_ENCRYPTION_KEY still works.
    """
    digest = hashlib.sha256(raw_key.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    return Fernet(_derive_fernet_key(settings.email_accounts_encryption_key))


def encrypt(value: str) -> str:
    """Encrypt a plaintext string for storage. Returns a urlsafe-base64 token."""
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt(value: str) -> str:
    """Decrypt a token produced by encrypt(). Raises ValueError if tampered/invalid."""
    try:
        return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken as e:
        raise ValueError("Invalid or tampered encrypted value") from e
