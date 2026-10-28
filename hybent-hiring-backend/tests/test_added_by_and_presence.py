"""'Added by' names the real person (or the channel), and chat presence."""
import types
from datetime import datetime, timezone

from app.utils.candidate_labels import added_by_label
from conftest import auth_headers


def test_added_by_names_the_creator_or_the_channel():
    person = types.SimpleNamespace(full_name="Riya Shah")
    assert added_by_label(types.SimpleNamespace(created_by=person, source=None, user_id=None)) == "Riya Shah"
    assert added_by_label(types.SimpleNamespace(created_by=None, source="linkedin", user_id=None)) == "LinkedIn"
    assert added_by_label(types.SimpleNamespace(created_by=None, source="careers_page", user_id=None)) == "Careers page"
    assert added_by_label(types.SimpleNamespace(created_by=None, source=None, user_id="u1")) == "Self-registered"
    assert "Admin" not in added_by_label(types.SimpleNamespace(created_by=None, source=None, user_id=None))


async def test_presence_shows_last_seen_when_not_connected(client, db_session, admin_user, recruiter_user, other_org_admin):
    recruiter_user.last_seen_at = datetime(2026, 10, 27, 9, 30, tzinfo=timezone.utc)
    await db_session.commit()
    res = await client.get(f"/v1/chat/presence/{recruiter_user.id}", headers=auth_headers(admin_user))
    data = res.json()["data"]
    assert res.status_code == 200 and data["online"] is False and data["last_seen_at"].startswith("2026-10-27")

    from app.websocket.manager import ws_manager
    ws_manager._connections[str(recruiter_user.id)] = [object()]
    try:
        res = await client.get(f"/v1/chat/presence/{recruiter_user.id}", headers=auth_headers(admin_user))
        assert res.json()["data"]["online"] is True
    finally:
        ws_manager._connections.pop(str(recruiter_user.id), None)
    # Another organization's user is not visible.
    assert (await client.get(f"/v1/chat/presence/{other_org_admin.id}", headers=auth_headers(admin_user))).status_code == 404
