"""
HTTP-level tests for the Copilot conversation endpoints:
  - GET /v1/copilot/conversations/{id} returns pending_tool_call
  - Tenant isolation: cannot read another org's conversation
  - Title generation fallback (unit-level, no LLM)
"""
import uuid
import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from app.models.copilot_conversation import CopilotConversation, CopilotMessage

from .conftest import auth_headers


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def conversation_with_pending(db_session, organization, admin_user) -> CopilotConversation:
    """A conversation whose last_context has a pending_action."""
    conv = CopilotConversation(
        organization_id=organization.id,
        user_id=admin_user.id,
        title="Find React Developers",
        last_context={
            "candidate_id": None,
            "pending_action": {
                "id": "abc123",
                "tool": "schedule_meeting",
                "args": {"candidate_name": "Priya Shah", "meeting_title": "Technical Round"},
            },
        },
    )
    db_session.add(conv)
    await db_session.flush()

    for role, content in [("user", "Schedule interview for Priya"), ("assistant", "I've prepared this action.")]:
        db_session.add(CopilotMessage(conversation_id=conv.id, role=role, content=content))

    await db_session.commit()
    await db_session.refresh(conv)
    return conv


@pytest_asyncio.fixture
async def conversation_no_pending(db_session, organization, admin_user) -> CopilotConversation:
    """A conversation with no pending action."""
    conv = CopilotConversation(
        organization_id=organization.id,
        user_id=admin_user.id,
        title="Candidate experience query",
        last_context={"candidate_id": str(uuid.uuid4()), "candidate_name": "Ankit Parmar"},
    )
    db_session.add(conv)
    await db_session.flush()

    db_session.add(CopilotMessage(conversation_id=conv.id, role="user", content="What is Ankit's experience?"))
    db_session.add(CopilotMessage(conversation_id=conv.id, role="assistant", content="Ankit has 4 years of experience."))

    await db_session.commit()
    await db_session.refresh(conv)
    return conv


# ── Tests: GET /v1/copilot/conversations/{id} ─────────────────────────────────

@pytest.mark.asyncio
async def test_get_conversation_returns_pending_tool_call(client, admin_user, conversation_with_pending):
    """pending_action in last_context must appear as pending_tool_call in the response."""
    resp = await client.get(
        f"/v1/copilot/conversations/{conversation_with_pending.id}",
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending_tool_call"] is not None
    ptc = data["pending_tool_call"]
    assert ptc["name"] == "schedule_meeting"
    assert ptc["id"] == "abc123"
    assert ptc["args"]["candidate_name"] == "Priya Shah"


@pytest.mark.asyncio
async def test_get_conversation_pending_tool_call_is_null_when_absent(client, admin_user, conversation_no_pending):
    """No pending_action -> pending_tool_call must be null."""
    resp = await client.get(
        f"/v1/copilot/conversations/{conversation_no_pending.id}",
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["pending_tool_call"] is None


@pytest.mark.asyncio
async def test_get_conversation_includes_messages(client, admin_user, conversation_with_pending):
    """Messages are returned in chronological order."""
    resp = await client.get(
        f"/v1/copilot/conversations/{conversation_with_pending.id}",
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 200
    msgs = resp.json()["messages"]
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"


# ── Tests: Tenant isolation ───────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_get_conversation_blocked_across_tenants(client, other_org_admin, conversation_with_pending):
    """A user from another org must receive 404, not the conversation data."""
    resp = await client.get(
        f"/v1/copilot/conversations/{conversation_with_pending.id}",
        headers=auth_headers(other_org_admin),
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_list_conversations_only_returns_own(client, admin_user, other_org_admin, conversation_with_pending, conversation_no_pending):
    """List endpoint returns only the current user's conversations."""
    resp = await client.get("/v1/copilot/conversations", headers=auth_headers(admin_user))
    assert resp.status_code == 200
    ids = [c["id"] for c in resp.json()]
    assert str(conversation_with_pending.id) in ids
    assert str(conversation_no_pending.id) in ids

    # Other org sees none of these
    resp2 = await client.get("/v1/copilot/conversations", headers=auth_headers(other_org_admin))
    assert resp2.status_code == 200
    other_ids = [c["id"] for c in resp2.json()]
    assert str(conversation_with_pending.id) not in other_ids


@pytest.mark.asyncio
async def test_get_conversation_404_for_invalid_id(client, admin_user):
    """A random UUID returns 404."""
    resp = await client.get(
        f"/v1/copilot/conversations/{uuid.uuid4()}",
        headers=auth_headers(admin_user),
    )
    assert resp.status_code == 404


# ── Tests: _generate_and_save_title unit test ─────────────────────────────────

@pytest.mark.asyncio
async def test_generate_and_save_title_updates_conversation(db_session, organization, admin_user):
    """_generate_and_save_title writes a short AI title to the conversation."""
    from app.services.ai.copilot_service import _generate_and_save_title
    from app.core.database import AsyncSessionLocal

    conv = CopilotConversation(
        organization_id=organization.id,
        user_id=admin_user.id,
        title="Show me all React candidates in pipeline",  # 60-char fallback
    )
    db_session.add(conv)
    await db_session.commit()
    await db_session.refresh(conv)

    # Patch Groq to return a short title without making a real API call
    with patch("app.services.ai.copilot_service.Groq") as MockGroq:
        mock_choice = AsyncMock()
        mock_choice.message.content = "React Candidates Pipeline"
        mock_resp = AsyncMock()
        mock_resp.choices = [mock_choice]
        mock_instance = MockGroq.return_value
        mock_instance.chat.completions.create.return_value = mock_resp

        # _generate_and_save_title opens its own DB session; we patch
        # AsyncSessionLocal so it reuses our test session.
        with patch("app.services.ai.copilot_service.AsyncSessionLocal") as MockSession:
            # Use the real test db_session via a context manager mock
            MockSession.return_value.__aenter__ = AsyncMock(return_value=db_session)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            await _generate_and_save_title(
                str(conv.id),
                str(organization.id),
                str(admin_user.id),
                "Show me all React candidates in pipeline",
                "Here are the React candidates currently in pipeline…",
            )

    # Verify the title was updated
    await db_session.refresh(conv)
    assert conv.title == "React Candidates Pipeline"


@pytest.mark.asyncio
async def test_generate_and_save_title_falls_back_on_llm_error(db_session, organization, admin_user):
    """If the LLM call raises, the title remains unchanged (no crash)."""
    from app.services.ai.copilot_service import _generate_and_save_title

    original_title = "Find me Python developers with 3 years"
    conv = CopilotConversation(
        organization_id=organization.id,
        user_id=admin_user.id,
        title=original_title,
    )
    db_session.add(conv)
    await db_session.commit()
    await db_session.refresh(conv)

    with patch("app.services.ai.copilot_service.Groq") as MockGroq:
        MockGroq.return_value.chat.completions.create.side_effect = Exception("Network error")

        with patch("app.services.ai.copilot_service.AsyncSessionLocal") as MockSession:
            MockSession.return_value.__aenter__ = AsyncMock(return_value=db_session)
            MockSession.return_value.__aexit__ = AsyncMock(return_value=False)

            # Should not raise — just log and return
            await _generate_and_save_title(
                str(conv.id),
                str(organization.id),
                str(admin_user.id),
                "Find me Python developers with 3 years",
                "Here are some Python candidates…",
            )

    # Title should be unchanged
    await db_session.refresh(conv)
    assert conv.title == original_title
