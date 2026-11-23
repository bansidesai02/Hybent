import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest

from app.core.config import settings
from app.services import whatsapp_bot, whatsapp_service


@pytest.fixture(autouse=True)
def _wa(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_token", "t")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "PNID")
    monkeypatch.setattr(settings, "whatsapp_verify_token", "verify-me")
    monkeypatch.setattr(settings, "whatsapp_app_secret", "s3cret")


def _sig(body: bytes) -> str:
    return "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()


@pytest.mark.asyncio
async def test_webhook_handshake(client):
    ok = await client.get("/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "verify-me", "hub.challenge": "42"})
    assert ok.status_code == 200 and ok.text == "42"
    bad = await client.get("/v1/whatsapp/webhook", params={"hub.mode": "subscribe", "hub.verify_token": "nope", "hub.challenge": "42"})
    assert bad.status_code == 403


@pytest.mark.asyncio
async def test_webhook_needs_meta_signature_and_queues_messages(client):
    msg = {"from": "919876543210", "id": "wamid.1", "type": "text", "text": {"body": "price?"}}
    body = json.dumps({"entry": [{"changes": [{"value": {"metadata": {"phone_number_id": "PNID"}, "messages": [msg]}}]}]}).encode()
    with patch("app.tasks.whatsapp.whatsapp_answer.delay") as delay:
        r = await client.post("/v1/whatsapp/webhook", content=body, headers={"x-hub-signature-256": "sha256=bad"})
        assert r.status_code == 403
        r = await client.post("/v1/whatsapp/webhook", content=body, headers={"x-hub-signature-256": _sig(body)})
        assert r.status_code == 200
        delay.assert_called_once_with(msg)


def test_markdown_becomes_whatsapp_formatting():
    out = whatsapp_bot.to_whatsapp("## Plans\n**Pro** is $39. See [Pricing](/pricing)\n- one")
    assert out == "Plans\n*Pro* is $39. See Pricing: https://hybent.com/pricing\n• one"


@pytest.mark.asyncio
async def test_bot_answers_once_with_buttons():
    import uuid
    sender = f"91{uuid.uuid4().int % 10**10:010d}"
    msg = {"from": sender, "id": f"wamid.{uuid.uuid4().hex}", "type": "text", "text": {"body": "What does Pro cost?"}}
    with patch.object(whatsapp_bot.site_assistant, "answer", AsyncMock(return_value=("**$39** a month", ["Free trial", "A very long follow-up question"]))) as ans, \
         patch.object(whatsapp_service, "send_message") as send, patch.object(whatsapp_service, "mark_read"):
        await whatsapp_bot.handle(msg)
        await whatsapp_bot.handle(msg)                      # Meta retry: ignored
    assert ans.await_count == 1 and ans.await_args.kwargs["channel"] == "whatsapp"
    payload = send.call_args.args[0]
    assert payload["to"] == sender and payload["type"] == "interactive"
    assert payload["interactive"]["body"]["text"] == "*$39* a month"
    assert [b["reply"]["title"] for b in payload["interactive"]["action"]["buttons"]] == ["Free trial"]
