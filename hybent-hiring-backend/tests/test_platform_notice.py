"""Announcement banner, maintenance mode and the platform sender name."""
import pytest

from app.services import platform_notice
from tests.conftest import auth_headers


@pytest.fixture(autouse=True)
def _fresh_cache():
    platform_notice.clear_cache()
    yield
    platform_notice.clear_cache()


async def test_announcement_shown_publicly(client, super_admin_user, admin_user):
    h = auth_headers(super_admin_user)
    r = await client.put("/v1/super-admin/platform-notice", json={"announcement": {"active": True, "message": ""}}, headers=h)
    assert r.status_code == 400
    r = await client.put("/v1/super-admin/platform-notice",
                         json={"announcement": {"active": True, "message": "New feature live", "tone": "success"}}, headers=h)
    assert r.status_code == 200
    data = (await client.get("/v1/platform/status")).json()["data"]
    assert data["announcement"] == {"active": True, "message": "New feature live", "tone": "success"}
    assert data["maintenance"]["enabled"] is False
    assert (await client.put("/v1/super-admin/platform-notice", json={}, headers=auth_headers(admin_user))).status_code == 403


async def test_maintenance_blocks_tenants_not_super_admin(client, super_admin_user, admin_user):
    r = await client.put("/v1/super-admin/platform-notice",
                         json={"maintenance": {"enabled": True, "message": "Back at 5 pm"}}, headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    blocked = await client.get("/v1/jobs", headers=auth_headers(admin_user))
    assert blocked.status_code == 503 and "Back at 5 pm" in blocked.json()["message"]
    assert (await client.get("/v1/users/me", headers=auth_headers(admin_user))).status_code == 200
    assert (await client.get("/v1/platform/status")).json()["data"]["maintenance"]["enabled"] is True
    assert (await client.get("/v1/super-admin/platform-notice", headers=auth_headers(super_admin_user))).status_code == 200

    await client.put("/v1/super-admin/platform-notice", json={"maintenance": {"enabled": False}}, headers=auth_headers(super_admin_user))
    assert (await client.get("/v1/jobs", headers=auth_headers(admin_user))).status_code == 200


def test_platform_sender_name_used_in_from(monkeypatch):
    from app.services import email_service
    monkeypatch.setattr(email_service, "platform_sender_name", lambda: "Hybent Team")
    assert email_service._from_header(None).startswith("Hybent Team <")
    assert email_service._from_header("Acme").startswith("Acme <")  # an organization's name still wins
