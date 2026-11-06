"""Team invites email a one-time set-password link, never a password."""
import app.routers.users as users_router
import app.services.email_service as es


async def test_invite_sends_a_link_and_no_password(client, db_session, admin_headers, monkeypatch):
    sent = []
    monkeypatch.setattr(es, "send_email", lambda to, subject, body, **k: sent.append((to, body)) or True)
    monkeypatch.setattr(users_router, "send_team_invite", es.send_team_invite)
    res = await client.post("/v1/users/invite", headers=admin_headers, json={
        "email": "newbie@example.com", "full_name": "New Bie", "role": "interviewer", "password": "Leaked123!",
    })
    assert res.status_code in (200, 201), res.text
    to, body = sent[-1]
    assert to == "newbie@example.com"
    assert "/reset-password?token=" in body and "Set your password" in body
    assert "Leaked123!" not in body and "TempPass" not in body and "Temporary Password" not in body

    # Neither the old default nor what the client sent works as a password.
    for pw in ("TempPass@123", "Leaked123!"):
        r = await client.post("/v1/auth/login", json={"email": "newbie@example.com", "password": pw})
        assert r.status_code in (401, 403)

    # The link sets their own password, once.
    token = body.split("/reset-password?token=")[1].split('"')[0]
    r = await client.post("/v1/auth/reset-password", json={"token": token, "new_password": "MyOwnPass2026!"})
    assert r.status_code == 200, r.text
    r = await client.post("/v1/auth/login", json={"email": "newbie@example.com", "password": "MyOwnPass2026!"})
    assert r.status_code == 200
