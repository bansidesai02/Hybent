"""Forgot password works for every staff role, end to end."""
import pytest

import app.routers.auth as auth_router
import app.routers.super_admin as sa_router
from conftest import _make_user, auth_headers

NEW = "BrandNewPass#2026"


@pytest.fixture
def inbox(monkeypatch):
    links = []

    def capture(to_email, to_name, reset_url, **kw):
        links.append((to_email, reset_url))
    monkeypatch.setattr("app.services.email_service.send_password_reset_email", capture)
    return links


def _token(url):
    return url.split("token=")[1]


@pytest.mark.parametrize("role", ["admin", "recruiter", "interviewer", "super_admin"])
async def test_forgot_password_for_each_role(client, db_session, organization, inbox, role):
    user = await _make_user(db_session, organization, role)
    # Any letter case finds the account.
    r = await client.post("/v1/auth/forgot-password", json={"email": user.email.upper()})
    assert r.status_code == 200
    assert inbox and inbox[-1][0] == user.email and "/reset-password?token=" in inbox[-1][1]

    token = _token(inbox[-1][1])
    weak = await client.post("/v1/auth/reset-password", json={"token": token, "new_password": "short1A!"})
    assert weak.status_code == 422
    r = await client.post("/v1/auth/reset-password", json={"token": token, "new_password": NEW})
    assert r.status_code == 200, r.text
    # One use only.
    again = await client.post("/v1/auth/reset-password", json={"token": token, "new_password": NEW + "x"})
    assert again.status_code == 400

    login = await client.post("/v1/auth/login", json={"email": user.email, "password": NEW})
    assert login.status_code == 200, login.text
    old = await client.post("/v1/auth/login", json={"email": user.email, "password": "password123"})
    assert old.status_code in (400, 401)


async def test_unknown_email_gets_the_same_reply_and_no_mail(client, inbox):
    r = await client.post("/v1/auth/forgot-password", json={"email": "nobody@example.com"})
    assert r.status_code == 200 and inbox == []


async def test_a_new_link_cancels_the_old_one(client, db_session, organization, inbox):
    user = await _make_user(db_session, organization, "recruiter")
    await client.post("/v1/auth/forgot-password", json={"email": user.email})
    await client.post("/v1/auth/forgot-password", json={"email": user.email})
    first, second = _token(inbox[0][1]), _token(inbox[1][1])
    assert (await client.post("/v1/auth/reset-password", json={"token": first, "new_password": NEW})).status_code == 400
    assert (await client.post("/v1/auth/reset-password", json={"token": second, "new_password": NEW})).status_code == 200


async def test_super_admin_reset_button_emails_a_working_link(client, db_session, organization, super_admin_user, inbox):
    user = await _make_user(db_session, organization, "admin")
    r = await client.post(f"/v1/super-admin/users/{user.id}/reset-password", headers=auth_headers(super_admin_user))
    assert r.status_code == 200, r.text
    token = _token(inbox[-1][1])
    assert (await client.post("/v1/auth/reset-password", json={"token": token, "new_password": NEW})).status_code == 200
    assert (await client.post("/v1/auth/login", json={"email": user.email, "password": NEW})).status_code == 200
