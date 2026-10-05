"""
Copilot job descriptions:
  - a JD on a new chat sends the real conversation id first, so the next
    message lands in the same chat (no duplicate chats in Recent Chats)
  - a follow-up change edits the JD already in the chat instead of writing
    a brand-new one
"""
import json
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.models.copilot_conversation import CopilotConversation, CopilotMessage
from app.services.ai import copilot_service as cs
from app.services.ai.copilot_intelligence import is_jd_edit_request

BDE_JD = (
    "## Business Development Executive\n\n"
    "**Position:** Business Development Executive  \n"
    "### 💡 What We Offer\n- Competitive compensation\n\n"
    f"{cs.JD_CTA}"
)


# ── Edit detection ────────────────────────────────────────────────────────────

@pytest.mark.parametrize("text", [
    "include in jd that this jd would be performance driven meaning pay will be on performance basis",
    "make it 5+ years",
    "add AWS",
    "remote kar do",
    "jd me experience badlo",
    "change the location to Pune",
    "make the JD shorter",
])
def test_jd_edit_requests(text):
    assert is_jd_edit_request(text, jd_is_last_reply=True)


@pytest.mark.parametrize("text", [
    "create jd for data analyst",
    "write a new jd",
    "show pipeline",
    "what is Ankit's experience",
    "move Ankit to technical round",
    "add Priya to the shortlist",
])
def test_not_jd_edit_requests(text):
    assert not is_jd_edit_request(text, jd_is_last_reply=True)


def test_bare_edit_needs_the_jd_to_be_the_last_reply():
    assert not is_jd_edit_request("make it remote", jd_is_last_reply=False)
    assert is_jd_edit_request("make the jd remote", jd_is_last_reply=False)


# ── Streaming against the real DB ─────────────────────────────────────────────

def _fake_groq(reply: str, captured: list):
    def create(**kwargs):
        captured.append(kwargs["messages"])
        return [SimpleNamespace(choices=[SimpleNamespace(delta=SimpleNamespace(content=reply))])]

    client = SimpleNamespace(chat=SimpleNamespace(completions=SimpleNamespace(create=create)))
    return lambda **_: client


async def _turn(db_session, organization, user, conversation_id, message, reply, captured, decision=None):
    async def classify(msg, turns, jds):
        captured.append({"classified": msg, "turns": turns, "jds": jds})
        return decision

    with patch.object(cs, "classify_jd_followup", classify):
        kind, prev_jd, change = await cs.jd_turn(db_session, organization.id, user.id, conversation_id, message)
    events = []
    with patch.object(cs, "Groq", _fake_groq(reply, captured)), \
         patch.object(cs, "get_best_groq_model", lambda _c: "test-model"):
        async for raw in cs.stream_jd_reply(
            db_session, organization.id, user.id, conversation_id, message, [], kind, prev_jd, instruction=change,
        ):
            events.append(json.loads(raw))
    return kind, events


@pytest.mark.asyncio
async def test_jd_then_edit_stays_in_one_chat_and_edits_the_jd(db_session, organization, admin_user):
    captured: list = []

    kind, events = await _turn(
        db_session, organization, admin_user, None, "create a jd for business development executive",
        BDE_JD.replace(cs.JD_CTA, ""), captured,
    )
    assert kind == "create"
    assert events[0]["type"] == "meta" and events[0]["conversation_id"]
    conv_id = events[0]["conversation_id"]

    edit = "include in jd that this jd would be performance driven meaning pay will be on performance basis"
    revised = BDE_JD.replace(cs.JD_CTA, "").replace(
        "- Competitive compensation", "- Performance-driven pay: compensation is based on performance",
    )
    kind, events = await _turn(db_session, organization, admin_user, conv_id, edit, revised, captured)  # LLM down: keyword fallback

    assert kind == "revise"
    assert events[0] == {"type": "meta", "conversation_id": conv_id}
    reply = "".join(e["content"] for e in events if e["type"] == "chunk")
    assert "Performance-driven pay" in reply and reply.endswith(cs.JD_CTA)

    # The model was asked to edit the saved JD, not to write a new one.
    prompt = captured[-1]
    assert "EDITING" in prompt[0]["content"]
    assert prompt[1] == {"role": "assistant", "content": BDE_JD.replace(cs.JD_CTA, "").strip()}
    assert prompt[2] == {"role": "user", "content": edit}

    chats = (await db_session.execute(
        select(func.count()).select_from(CopilotConversation).where(CopilotConversation.user_id == admin_user.id)
    )).scalar_one()
    msgs = (await db_session.execute(
        select(func.count()).select_from(CopilotMessage).where(CopilotMessage.conversation_id == conv_id)
    )).scalar_one()
    assert chats == 1
    assert msgs == 4


@pytest.mark.asyncio
async def test_correction_edits_the_jd_the_recruiter_meant(db_session, organization, admin_user):
    """The pasted chat: BDE JD, a misread follow-up produced a second JD, then
    "i meant ..." must edit the original BDE JD with the resolved change."""
    captured: list = []
    bde = BDE_JD.replace(cs.JD_CTA, "")
    _, events = await _turn(db_session, organization, admin_user, None, "create jd for bde, exp 2-3, outbound sales", bde, captured)
    conv_id = events[0]["conversation_id"]

    wrong = "## Performance-Only Incentive Sales Specialist\n\n**Position:** Performance-Only Incentive Sales Specialist"
    kind, _ = await _turn(
        db_session, organization, admin_user, conv_id, "want jd for only performance-driven incentives", wrong, captured,
        decision={"action": "new", "target": None, "instruction": ""},
    )
    assert kind == "create"

    change = "Make the BDE role's pay performance-driven: compensation based on performance."
    kind, events = await _turn(
        db_session, organization, admin_user, conv_id, "i meant our business development jd to be performance driven",
        bde, captured, decision={"action": "edit", "target": 1, "instruction": change},
    )
    assert kind == "revise"
    classified = next(c for c in reversed(captured) if isinstance(c, dict) and "classified" in c)
    assert [cs._jd_title(j) for j in classified["jds"]] == [
        "Business Development Executive", "Performance-Only Incentive Sales Specialist",
    ]
    prompt = captured[-1]
    assert prompt[1]["content"].startswith("## Business Development Executive")  # JD 1, not the misread JD 2
    assert change in prompt[2]["content"]


@pytest.mark.asyncio
async def test_other_message_in_a_jd_chat_goes_to_normal_flow(db_session, organization, admin_user):
    captured: list = []
    _, events = await _turn(db_session, organization, admin_user, None, "create a jd for bde", BDE_JD.replace(cs.JD_CTA, ""), captured)
    async def classify(*_a):
        return {"action": "other", "target": None, "instruction": ""}
    with patch.object(cs, "classify_jd_followup", classify):
        assert await cs.jd_turn(db_session, organization.id, admin_user.id, events[0]["conversation_id"], "show pipeline") == (None, None, None)


# ── "Generate job" from a JD: one job per JD, remembered on the message ─────

@pytest.mark.asyncio
async def test_generate_job_is_saved_on_the_message_and_never_duplicated(client, db_session, organization, admin_user, recruiter_user):
    from tests.conftest import auth_headers
    from app.models.job import Job

    captured: list = []
    org_id = organization.id
    other_headers = auth_headers(recruiter_user)
    jd = BDE_JD.replace(cs.JD_CTA, "")
    _, events = await _turn(db_session, organization, admin_user, None, "create a jd for bde", jd, captured)
    conv_id = events[0]["conversation_id"]
    payload = {"jd_text": jd.strip(), "job": {"title": "Business Development Executive", "description": "Sell."}}

    first = await client.post(f"/v1/copilot/conversations/{conv_id}/jd-job", json=payload, headers=auth_headers(admin_user))
    assert first.status_code == 201, first.text
    job_id = first.json()["data"]["job"]["id"]
    assert first.json()["data"]["created"] is True

    # Leaving and coming back reloads the chat: the message carries the job.
    conv = await client.get(f"/v1/copilot/conversations/{conv_id}", headers=auth_headers(admin_user))
    assert f"[JOB_CREATED:{job_id}]" in conv.json()["messages"][-1]["content"]

    again = await client.post(f"/v1/copilot/conversations/{conv_id}/jd-job", json=payload, headers=auth_headers(admin_user))
    assert again.status_code == 200
    assert again.json()["data"]["created"] is False
    assert again.json()["data"]["job"]["id"] == job_id

    db_session.expire_all()
    titles = (await db_session.execute(
        select(Job.title).where(Job.organization_id == org_id, Job.status == "active")
    )).scalars().all()
    assert titles == ["Business Development Executive"]

    # Someone else's chat: not found, nothing created.
    other = await client.post(f"/v1/copilot/conversations/{conv_id}/jd-job", json=payload, headers=other_headers)
    assert other.status_code == 404
