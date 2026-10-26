"""Integration key helpers and request schema — pure unit tests, no DB."""
import pytest
from pydantic import ValidationError

from app.schemas.integration import IntegrationKeyCreate
from app.utils.integration_keys import (
    generate_key, hash_secret, key_id_from_header, parse_key, secret_matches,
)


def test_generated_key_round_trips():
    generated = generate_key(is_production=True)
    assert generated.full_key.startswith(f"hyb_live_{generated.key_id}_")
    parsed = parse_key(generated.full_key)
    assert parsed is not None
    assert parsed.key_id == generated.key_id
    assert secret_matches(parsed.secret, generated.secret_hash)


def test_test_env_prefix_and_unique_keys():
    a, b = generate_key(is_production=False), generate_key(is_production=False)
    assert a.full_key.startswith("hyb_test_")
    assert a.key_id != b.key_id and a.full_key != b.full_key


def test_only_the_hash_is_derivable_from_storage():
    generated = generate_key(is_production=True)
    secret = parse_key(generated.full_key).secret
    assert generated.secret_hash == hash_secret(secret)
    assert secret not in generated.secret_hash


def test_wrong_secret_does_not_match():
    generated = generate_key(is_production=True)
    other = parse_key(generate_key(is_production=True).full_key)
    assert not secret_matches(other.secret, generated.secret_hash)


@pytest.mark.parametrize("raw", [
    None, "", "hyb_live_abc", "Bearer something",
    "hyb_prod_0123456789abcdef_" + "a" * 64,          # unknown env
    "hyb_live_0123456789ABCDEF_" + "a" * 64,          # uppercase id
    "hyb_live_0123456789abcdef_" + "a" * 63,          # short secret
    "hyb_live_0123456789abcdef_" + "a" * 64 + "_x",   # trailing junk
])
def test_malformed_keys_are_rejected(raw):
    assert parse_key(raw) is None
    assert key_id_from_header(raw) is None


def test_surrounding_whitespace_is_tolerated():
    generated = generate_key(is_production=True)
    assert key_id_from_header(f"  {generated.full_key}\n") == generated.key_id


def test_create_schema_dedupes_and_sorts_scopes():
    body = IntegrationKeyCreate(name="  n8n reports ", scopes=["ops:read", "reports:read", "ops:read"])
    assert body.name == "n8n reports"
    assert body.scopes == ["ops:read", "reports:read"]


@pytest.mark.parametrize("payload", [
    {"name": "n8n", "scopes": ["admin:all"]},
    {"name": "n8n", "scopes": []},
    {"name": "   ", "scopes": ["reports:read"]},
    {"name": "n8n", "scopes": ["reports:read"], "expires_in_days": 0},
    {"name": "n8n", "scopes": ["reports:read"], "expires_in_days": 731},
])
def test_create_schema_rejects_bad_input(payload):
    with pytest.raises(ValidationError):
        IntegrationKeyCreate(**payload)
