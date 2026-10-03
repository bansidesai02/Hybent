"""An invalid Groq key is dropped instead of being retried against every model
on every call; a missing model is remembered and skipped."""
from unittest.mock import MagicMock, patch

import httpx
import pytest
from groq import APIStatusError

from app.services import groq_client as gc


def _status_error(code: int) -> APIStatusError:
    response = httpx.Response(code, request=httpx.Request("POST", "https://api.groq.com/x"))
    return APIStatusError(f"error {code}", response=response, body=None)


@pytest.fixture(autouse=True)
def fresh_state(monkeypatch):
    monkeypatch.setattr(gc, "ALL_KEYS", ["gsk_bad", "gsk_good"])
    monkeypatch.setattr(gc, "_failed_keys", set())
    monkeypatch.setattr(gc, "_invalid_keys", set())
    monkeypatch.setattr(gc, "_missing_models", set())
    monkeypatch.setattr(gc, "cached_best_model", None)
    monkeypatch.setattr(gc, "_models_lookup_failed_at", None)


def _fake_groq(behaviour):
    """Groq(api_key=...) stand-in; behaviour(key, model) returns or raises."""
    calls = []

    def factory(api_key=None, **kwargs):
        client = MagicMock()
        client.api_key = api_key

        def create(*args, **kw):
            calls.append((api_key, kw.get("model")))
            return behaviour(api_key, kw.get("model"))
        client.chat.completions.create.side_effect = create
        return client
    return factory, calls


def test_invalid_key_is_skipped_after_one_try_and_then_never_used():
    def behaviour(key, model):
        if key == "gsk_bad":
            raise _status_error(401)
        if model == "llama-3.3-70b-versatile":
            raise _status_error(404)
        return "ok"

    factory, calls = _fake_groq(behaviour)
    with patch.object(gc, "Groq", side_effect=factory):
        completions = gc.SafeCompletions(lambda: None)
        assert completions.create(model="llama-3.3-70b-versatile", messages=[]) == "ok"
        # Bad key tried once (not once per model), then the good key: 404 model, then success.
        assert calls == [
            ("gsk_bad", "llama-3.3-70b-versatile"),
            ("gsk_good", "llama-3.3-70b-versatile"),
            ("gsk_good", "openai/gpt-oss-120b"),
        ]

        calls.clear()
        assert completions.create(model="llama-3.3-70b-versatile", messages=[]) == "ok"
        # Second call: the invalid key and the missing model are both skipped.
        assert calls == [("gsk_good", "openai/gpt-oss-120b")]


def test_reasoning_settings_only_go_to_gpt_oss_with_token_headroom():
    oss = gc._kwargs_for_model({"model": "x", "max_tokens": 20}, "openai/gpt-oss-120b")
    assert oss["model"] == "openai/gpt-oss-120b"
    assert oss["reasoning_effort"] == gc.REASONING_DEFAULT_EFFORT
    assert oss["max_tokens"] == 20 + gc.REASONING_TOKEN_HEADROOM

    llama = gc._kwargs_for_model({"max_tokens": 20, "reasoning_effort": "low"}, "llama-3.3-70b-versatile")
    assert "reasoning_effort" not in llama
    assert llama["max_tokens"] == 20


def test_json_validation_failure_moves_to_the_next_model():
    def behaviour(key, model):
        if model == "openai/gpt-oss-120b":
            response = httpx.Response(400, request=httpx.Request("POST", "https://api.groq.com/x"))
            raise APIStatusError("json_validate_failed", response=response, body=None)
        return "ok"

    factory, calls = _fake_groq(behaviour)
    with patch.object(gc, "Groq", side_effect=factory):
        completions = gc.SafeCompletions(lambda: None)
        assert completions.create(model="openai/gpt-oss-120b", messages=[],
                                  response_format={"type": "json_object"}) == "ok"
        assert calls == [("gsk_bad", "openai/gpt-oss-120b"), ("gsk_bad", "openai/gpt-oss-20b")]


def test_models_lookup_tries_the_next_key_and_retires_an_invalid_one():
    good = MagicMock(api_key="gsk_good")
    good.models.list.return_value = MagicMock(data=[MagicMock(id="openai/gpt-oss-120b")])
    bad = MagicMock(api_key="gsk_bad")
    bad.models.list.side_effect = _status_error(401)

    with patch.object(gc, "Groq", side_effect=lambda api_key=None, **kw: bad if api_key == "gsk_bad" else good):
        assert gc.get_best_groq_model() == "openai/gpt-oss-120b"
    assert "gsk_bad" in gc._invalid_keys
