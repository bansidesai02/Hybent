"""Phone push for admins: who can turn it on, what triggers it, demo request list."""
import pytest
from sqlalchemy import select

from app.models.push import DemoRequestRecord, PushSubscription
from app.services import push_service
from tests.conftest import auth_headers

SUB = {"endpoint": "https://push.example.com/send/abc123", "keys": {"p256dh": "B" * 87, "auth": "a" * 22}}
DEMO = {
    "first_name": "Ananya", "last_name": "Shah", "work_email": "ananya@example.com",
    "company_name": "Acme", "team_size": "11-50", "monthly_hires": "5-10",
    "hiring_challenge": "Screening takes too long",
}


@pytest.fixture
def push_on(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "vapid_public_key", "BPublicKeyForTests")
    monkeypatch.setattr(settings, "vapid_private_key", "private-key-for-tests")


@pytest.fixture
def queued(monkeypatch):
    calls = []
    import app.routers.public as public
    monkeypatch.setattr(public.push_service, "queue_push", lambda kind, payload, organization_id=None: calls.append((kind, payload, organization_id)))
    monkeypatch.setattr("app.services.email_service.send_email", lambda *a, **k: True)
    return calls


async def test_only_admins_can_turn_push_on(client, push_on, admin_user, recruiter_user, super_admin_user):
    assert (await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(recruiter_user))).status_code == 403
    assert (await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))).status_code == 200
    cfg = (await client.get("/v1/push/config", headers=auth_headers(admin_user))).json()["data"]
    assert cfg["enabled"] and cfg["devices"] == 1 and cfg["public_key"] == "BPublicKeyForTests"
    # One phone, two accounts: both get their own notifications on it.
    assert (await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(super_admin_user))).status_code == 200
    assert (await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))).status_code == 200
    for user in (admin_user, super_admin_user):
        assert (await client.get("/v1/push/config", headers=auth_headers(user))).json()["data"]["devices"] == 1
        r = await client.post("/v1/push/check", json={"endpoint": SUB["endpoint"]}, headers=auth_headers(user))
        assert r.json()["data"]["mine"] is True


async def test_push_off_without_server_keys(client, monkeypatch, admin_user):
    from app.core.config import settings
    monkeypatch.setattr(settings, "vapid_public_key", "")
    monkeypatch.setattr(settings, "vapid_private_key", "")
    r = await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))
    assert r.status_code == 503
    assert (await client.get("/v1/push/config", headers=auth_headers(admin_user))).json()["data"]["enabled"] is False


async def test_unsubscribe_removes_only_own_device(client, db_session, push_on, admin_user, super_admin_user):
    await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))
    await client.post("/v1/push/unsubscribe", json={"endpoint": SUB["endpoint"]}, headers=auth_headers(super_admin_user))
    assert (await db_session.execute(select(PushSubscription))).scalar_one_or_none() is not None
    r = await client.post("/v1/push/check", json={"endpoint": SUB["endpoint"]}, headers=auth_headers(super_admin_user))
    assert r.json()["data"]["mine"] is False
    await client.post("/v1/push/unsubscribe", json={"endpoint": SUB["endpoint"]}, headers=auth_headers(admin_user))
    assert (await db_session.execute(select(PushSubscription))).scalar_one_or_none() is None


async def test_test_push_and_gone_devices_are_removed(client, db_session, monkeypatch, push_on, admin_user):
    await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))
    sent = []
    monkeypatch.setattr(push_service, "_send_one", lambda sub, payload: sent.append(payload) or ("ok", None))
    r = await client.post("/v1/push/test", headers=auth_headers(admin_user))
    assert r.status_code == 200 and sent[0]["title"].startswith("Hybent")

    # The push service refuses (e.g. wrong key): reported, not "sent".
    monkeypatch.setattr(push_service, "_send_one", lambda sub, payload: ("failed", "push service answered 403: bad key"))
    r = await client.post("/v1/push/test", headers=auth_headers(admin_user))
    assert r.status_code == 502 and "403" in r.json()["message"]

    monkeypatch.setattr(push_service, "_send_one", lambda sub, payload: ("gone", "410"))  # device uninstalled
    assert (await client.post("/v1/push/test", headers=auth_headers(admin_user))).status_code == 502
    assert (await db_session.execute(select(PushSubscription))).scalar_one_or_none() is None


async def test_demo_request_is_saved_listed_and_pushed(client, db_session, queued, super_admin_user, admin_user):
    r = await client.post("/api/public/demo-request", json=DEMO)
    assert r.status_code == 200
    assert queued[0][0] == "demo_request" and "Acme" in queued[0][1]["body"]

    h = auth_headers(super_admin_user)
    data = (await client.get("/v1/super-admin/demo-requests", headers=h)).json()["data"]
    assert data["total"] == 1 and data["counts"]["new"] == 1
    req = data["requests"][0]
    assert req["company_name"] == "Acme" and req["email_sent"] is True

    r = await client.patch(f"/v1/super-admin/demo-requests/{req['id']}", json={"status": "contacted", "notes": "Called"}, headers=h)
    assert r.status_code == 200 and r.json()["data"]["status"] == "contacted"
    assert (await client.get("/v1/super-admin/demo-requests", params={"status": "contacted"}, headers=h)).json()["data"]["total"] == 1
    # Admins of client organizations can't see Hybent's leads.
    assert (await client.get("/v1/super-admin/demo-requests", headers=auth_headers(admin_user))).status_code == 403


async def test_every_notification_goes_to_the_users_own_phone(client, db_session, monkeypatch, push_on, admin_user, super_admin_user):
    await client.post("/v1/push/subscribe", json=SUB, headers=auth_headers(admin_user))
    sent = []
    monkeypatch.setattr(push_service, "_send_one", lambda sub, payload: sent.append(payload) or ("ok", None))
    await push_service.push_notification(db_session, admin_user.id, "New Job Application", "Asha applied", {"candidate_id": "c1"})
    assert sent[0]["title"] == "New Job Application" and sent[0]["url"] == "/hiring/admin/candidates?openId=c1"
    await push_service.push_notification(db_session, super_admin_user.id, "Other", "No device")
    assert len(sent) == 1


async def test_recipients(db_session, super_admin_user):
    assert await push_service.recipients_for(db_session, "demo_request", None) == [super_admin_user.id]


async def test_queue_push_never_raises(monkeypatch, push_on):
    from app.tasks import push as push_task
    def broken(*a, **k):
        raise ConnectionError("redis down")
    monkeypatch.setattr(push_task.send_event_push, "delay", broken)
    push_service.queue_push("demo_request", {"title": "x"})  # must not raise
