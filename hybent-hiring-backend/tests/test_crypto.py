"""Unit tests for app.utils.crypto (encrypt/decrypt at-rest secrets)."""
import pytest

from app.utils import crypto


def test_roundtrip():
    secret = "super-secret-refresh-token"
    encrypted = crypto.encrypt(secret)
    assert encrypted != secret
    assert crypto.decrypt(encrypted) == secret


def test_tampered_ciphertext_fails_safely():
    encrypted = crypto.encrypt("app-password")
    tampered = encrypted[:-4] + ("A" * 4)
    with pytest.raises(ValueError):
        crypto.decrypt(tampered)


def test_different_values_produce_different_ciphertext():
    a = crypto.encrypt("value-a")
    b = crypto.encrypt("value-b")
    assert a != b
