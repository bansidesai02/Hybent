"""Super admin operations: email log, errors, imports, devices, contact, accounts."""
import uuid

import pytest
from sqlalchemy import select

from app.models.operations import ContactMessage, EmailLog, PlatformError
from app.models.push import PushSubscription
from app.services import email_service, push_service
from app.tasks import operations
from tests.conftest import auth_headers

OPS_GETS = ("email-logs", "errors", "failed-imports", "push-devices", "contact-messages")


async def test_org_admin_is_refused_everywhere(client, admin_user):
    h = auth_headers(admin_user)
    for path in OPS_GETS:
        assert (await client.get(f"/v1/super-admin/{path}", headers=h)).status_code == 403, path
    r = await client.post("/v1/super-admin/users", json={
        "organization_id": str(admin_user.organization_id), "full_name": "X", "email": "x@example.com", "role": "admin",
    }, headers=h)
    assert r.status_code == 403


async def test_every_page_loads_for_super_admin(client, super_admin_user):
    h = auth_headers(super_admin_user)
    for path in OPS_GETS:
        assert (await client.get(f"/v1/super-admin/{path}", headers=h)).status_code == 200, path


def test_one_time_links_are_never_stored(monkeypatch):
    calls = []
    monkeypatch.setattr(operations.record_email, "delay", lambda *a: calls.append(a))
    operations.queue_email_log("a@b.co", "Reset", "Resend", False, "x", '<a href="https://x/reset-password?token=abc">go</a>')
    operations.queue_email_log("a@b.co", "Offer", "Resend", False, "x", "<p>Your offer</p>")
    operations.queue_email_log("a@b.co", "Offer", "Resend", True, None, "<p>Your offer</p>")
    assert [c[5] for c in calls] == [None, "<p>Your offer</p>", None]


def test_send_email_logs_each_attempt(monkeypatch):
    from app.core.config import settings
    calls = []
    monkeypatch.setattr(settings, "resend_api_key", "k")
    monkeypatch.setattr(settings, "smtp_user", "")
    monkeypatch.setattr(operations.record_email, "delay", lambda *a: calls.append(a))
    monkeypatch.setattr(email_service, "_send_resend", lambda *a, **k: None)
    assert email_service.send_email("a@b.co", "Hi", "<p>x</p>") is True
    assert calls[0][:4] == ("a@b.co", "Hi", "Resend", "sent")


async def test_resend_failed_email(client, db_session, monkeypatch, super_admin_user):
    import app.routers.super_admin_ops as ops
    h = auth_headers(super_admin_user)
    log = EmailLog(to_address="a@b.co", subject="Offer", provider="Resend", status="failed", error="x", html_body="<p>x</p>")
    locked = EmailLog(to_address="a@b.co", subject="Reset", provider="Resend", status="failed", error="x")
    db_session.add_all([log, locked])
    await db_session.commit()
    monkeypatch.setattr(ops, "send_email", lambda *a: True)
    assert (await client.post(f"/v1/super-admin/email-logs/{locked.id}/resend", headers=h)).status_code == 400
    r = await client.post(f"/v1/super-admin/email-logs/{log.id}/resend", headers=h)
    assert r.status_code == 200 and r.json()["data"]["status"] == "resent"
    assert (await client.post(f"/v1/super-admin/email-logs/{log.id}/resend", headers=h)).status_code == 400


async def test_failed_job_can_be_retried_and_resolved(client, db_session, monkeypatch, super_admin_user):
    import app.routers.super_admin_ops as ops
    h = auth_headers(super_admin_user)
    job = PlatformError(kind="task", source="app.tasks.demos.send_demo_reminders", error="boom", task_args={"args": [], "kwargs": {}})
    api = PlatformError(kind="api", source="GET /x", error="boom")
    db_session.add_all([job, api])
    await db_session.commit()
    queued = []
    monkeypatch.setattr(ops.celery_app, "send_task", lambda name, **k: queued.append(name))
    monkeypatch.setitem(ops.celery_app.tasks, "app.tasks.demos.send_demo_reminders", object())
    assert (await client.post(f"/v1/super-admin/errors/{api.id}/retry", headers=h)).status_code == 400
    r = await client.post(f"/v1/super-admin/errors/{job.id}/retry", headers=h)
    assert r.status_code == 200 and queued == ["app.tasks.demos.send_demo_reminders"]
    assert (await client.post(f"/v1/super-admin/errors/{api.id}/resolve", headers=h)).json()["data"]["status"] == "resolved"
    assert (await client.get("/v1/super-admin/errors", headers=h)).json()["data"]["total"] == 0


async def test_retry_ignores_unknown_task_names(client, db_session, super_admin_user):
    err = PlatformError(kind="task", source="os.system", error="x", task_args={"args": ["rm"], "kwargs": {}})
    db_session.add(err)
    await db_session.commit()
    r = await client.post(f"/v1/super-admin/errors/{err.id}/retry", headers=auth_headers(super_admin_user))
    assert r.status_code == 400


async def test_contact_message_is_kept_when_email_fails(client, db_session, monkeypatch, super_admin_user):
    import app.routers.public as public

    async def accepts(domain):
        return True
    monkeypatch.setattr(public, "send_email", lambda *a: False)
    monkeypatch.setattr(public.lead_checks, "domain_accepts_mail", accepts)
    monkeypatch.setattr(public.lead_checks, "rate_limited", lambda ip: False)
    r = await client.post("/api/public/contact", json={
        "topic": "services", "name": "Asha", "email": "asha@acme-example.com", "message": "Please call me back soon",
        "company": "Acme", "phone": "+91 98765 43210", "location": "Pune", "referrer": "LinkedIn",
    })
    assert r.status_code == 200
    row = (await db_session.execute(select(ContactMessage))).scalar_one()
    h = auth_headers(super_admin_user)
    data = (await client.get("/v1/super-admin/contact-messages", headers=h)).json()["data"]
    assert data["total"] == 1 and data["counts"]["new"] == 1
    r = await client.patch(f"/v1/super-admin/contact-messages/{row.id}", json={"status": "replied"}, headers=h)
    assert r.json()["data"]["status"] == "replied"


@pytest.fixture
def invites(monkeypatch):
    import app.routers.super_admin_ops as ops
    sent = []
    monkeypatch.setattr(ops, "send_team_invite", lambda **k: sent.append(k) or True)

    async def noop(*a, **k):
        return None
    monkeypatch.setattr(ops.es_service, "index_user", noop)
    return sent


async def test_create_user_invites_and_blocks_duplicates(client, db_session, invites, super_admin_user, other_organization):
    h = auth_headers(super_admin_user)
    body = {"organization_id": str(other_organization.id), "full_name": "New Admin", "email": "New@Example.com", "role": "admin"}
    r = await client.post("/v1/super-admin/users", json=body, headers=h)
    assert r.status_code in (200, 201) and r.json()["data"]["invite_sent"] is True
    assert "token=" in invites[0]["setup_url"] and invites[0]["to_email"] == "new@example.com"
    assert (await client.post("/v1/super-admin/users", json=body, headers=h)).status_code == 409


async def test_super_admin_role_cannot_be_given(client, super_admin_user, admin_user):
    h = auth_headers(super_admin_user)
    r = await client.post("/v1/super-admin/users", json={
        "organization_id": str(admin_user.organization_id), "full_name": "X", "email": "x@example.com", "role": "super_admin",
    }, headers=h)
    assert r.status_code == 422
    assert (await client.patch(f"/v1/super-admin/users/{admin_user.id}", json={"role": "super_admin"}, headers=h)).status_code == 422


async def test_edit_user(client, db_session, super_admin_user, admin_user, other_org_admin):
    h = auth_headers(super_admin_user)
    r = await client.patch(f"/v1/super-admin/users/{admin_user.id}", json={"email": other_org_admin.email.upper()}, headers=h)
    assert r.status_code == 409
    r = await client.patch(f"/v1/super-admin/users/{admin_user.id}", json={"role": "recruiter", "full_name": " Renamed "}, headers=h)
    assert r.status_code == 200 and r.json()["data"]["role"] == "recruiter" and r.json()["data"]["full_name"] == "Renamed"
    # A super admin account's role isn't editable.
    assert (await client.patch(f"/v1/super-admin/users/{super_admin_user.id}", json={"role": "admin"}, headers=h)).status_code == 400


async def test_resend_invite(client, invites, super_admin_user, admin_user):
    r = await client.post(f"/v1/super-admin/users/{admin_user.id}/resend-invite", headers=auth_headers(super_admin_user))
    assert r.status_code == 200 and invites[0]["to_email"] == admin_user.email


async def test_test_push_to_a_user(client, db_session, monkeypatch, super_admin_user, admin_user):
    from app.core.config import settings
    monkeypatch.setattr(settings, "vapid_public_key", "k")
    monkeypatch.setattr(settings, "vapid_private_key", "k")
    h = auth_headers(super_admin_user)
    assert (await client.post(f"/v1/super-admin/users/{admin_user.id}/test-push", headers=h)).status_code == 404
    db_session.add(PushSubscription(user_id=admin_user.id, endpoint="https://p.example/1", p256dh="x" * 20, auth="y" * 10))
    await db_session.commit()
    monkeypatch.setattr(push_service, "_send_one", lambda s, p: ("ok", None))
    assert (await client.post(f"/v1/super-admin/users/{admin_user.id}/test-push", headers=h)).status_code == 200
    devices = (await client.get("/v1/super-admin/push-devices", headers=h)).json()["data"]["devices"]
    assert devices[0]["email"] == admin_user.email


async def test_unknown_user_is_404(client, super_admin_user):
    h = auth_headers(super_admin_user)
    assert (await client.patch(f"/v1/super-admin/users/{uuid.uuid4()}", json={"full_name": "X"}, headers=h)).status_code == 404


async def test_todo_counts(client, super_admin_user, admin_user):
    r = await client.get("/v1/super-admin/todo", headers=auth_headers(super_admin_user))
    assert r.status_code == 200
    d = r.json()["data"]
    assert {"trials_pending", "contact_new", "emails_failed", "errors_open", "sessions_active", "leads", "system"} <= d.keys()
    assert (await client.get("/v1/super-admin/todo", headers=auth_headers(admin_user))).status_code == 403
