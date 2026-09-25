"""API tests: mailboxes are private to their owner, org isolation, CRUD happy path."""
from unittest.mock import patch

SMTP_PAYLOAD = {
    "email_address": "recruiting@acme.com",
    "display_name": "Acme Recruiting",
    "smtp_host": "smtp.acme.com",
    "smtp_port": 587,
    "smtp_username": "recruiting@acme.com",
    "smtp_password": "app-password",
    "use_tls": True,
}


async def test_list_requires_auth(client):
    response = await client.get("/v1/email-accounts")
    assert response.status_code == 401


async def test_recruiter_can_connect_own_personal_smtp_account(client, recruiter_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=recruiter_headers)
    assert response.status_code == 200
    body = response.json()["data"]
    assert body["scope"] == "personal"
    assert body["is_default"] is True  # a recruiter's one mailbox is their sender


async def test_recruiter_never_has_more_than_one_mailbox(client, recruiter_headers):
    """Connecting another address replaces their one mailbox."""
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        first = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=recruiter_headers)
        second_payload = {**SMTP_PAYLOAD, "email_address": "second@acme.com"}
        second = await client.post("/v1/email-accounts/smtp", json=second_payload, headers=recruiter_headers)
    assert second.status_code == 200
    assert second.json()["data"]["id"] == first.json()["data"]["id"]
    listed = (await client.get("/v1/email-accounts", headers=recruiter_headers)).json()["data"]
    assert [a["email_address"] for a in listed] == ["second@acme.com"]


async def test_nobody_can_manage_someone_elses_mailbox(client, admin_headers, recruiter_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        admins = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
        recruiters = await client.post(
            "/v1/email-accounts/smtp", json={**SMTP_PAYLOAD, "email_address": "rec@gmail.com"}, headers=recruiter_headers
        )

    # 404, not 403: another member's mailbox isn't theirs to know about.
    r1 = await client.delete(f"/v1/email-accounts/{admins.json()['data']['id']}", headers=recruiter_headers)
    r2 = await client.delete(f"/v1/email-accounts/{recruiters.json()['data']['id']}", headers=admin_headers)
    assert (r1.status_code, r2.status_code) == (404, 404)


async def test_admin_can_connect_smtp_account(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["data"]["email_address"] == "recruiting@acme.com"
    assert body["data"]["is_default"] is True
    # Secrets must never be serialized back to the client.
    assert "smtp_password" not in body["data"]
    assert "smtp_password_encrypted" not in body["data"]


async def test_connect_smtp_with_bad_credentials_returns_400(client, admin_headers):
    with patch(
        "app.services.email_providers.smtp_provider.SMTPProvider.send",
        side_effect=Exception("bad credentials"),
    ):
        response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    assert response.status_code == 400


async def test_list_never_shows_another_members_mailbox(client, admin_headers, recruiter_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)

    response = await client.get("/v1/email-accounts", headers=recruiter_headers)
    assert response.status_code == 200
    assert response.json()["data"] == []


async def test_org_isolation_on_list(client, admin_headers, other_org_admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)

    response = await client.get("/v1/email-accounts", headers=other_org_admin_headers)
    assert response.status_code == 200
    assert response.json()["data"] == []


async def test_org_isolation_on_mutation(client, admin_headers, other_org_admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        create_response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    account_id = create_response.json()["data"]["id"]

    response = await client.delete(f"/v1/email-accounts/{account_id}", headers=other_org_admin_headers)
    assert response.status_code == 404


async def test_cannot_make_another_members_mailbox_primary(client, admin_headers, recruiter_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        create_response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    account_id = create_response.json()["data"]["id"]

    response = await client.post(f"/v1/email-accounts/{account_id}/set-default", headers=recruiter_headers)
    assert response.status_code == 404


async def test_full_crud_happy_path(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        create_response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    account_id = create_response.json()["data"]["id"]

    update_response = await client.patch(
        f"/v1/email-accounts/{account_id}", json={"display_name": "New Name"}, headers=admin_headers
    )
    assert update_response.status_code == 200
    assert update_response.json()["data"]["display_name"] == "New Name"

    disconnect_response = await client.delete(f"/v1/email-accounts/{account_id}", headers=admin_headers)
    assert disconnect_response.status_code == 200

    list_response = await client.get("/v1/email-accounts", headers=admin_headers)
    assert list_response.json()["data"][0]["status"] == "disconnected"


async def test_test_send_endpoint_reports_failure_without_raising(client, admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        create_response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=admin_headers)
    account_id = create_response.json()["data"]["id"]

    with patch(
        "app.services.email_providers.smtp_provider.SMTPProvider.send",
        side_effect=Exception("network unreachable"),
    ):
        response = await client.post(f"/v1/email-accounts/{account_id}/test", headers=admin_headers)

    assert response.status_code == 200
    assert response.json()["data"]["success"] is False


async def test_outlook_authorize_returns_not_implemented(client, admin_headers):
    response = await client.post("/v1/email-accounts/outlook/authorize", headers=admin_headers)
    assert response.status_code == 501


async def test_super_admin_can_connect_smtp_account(client, super_admin_headers):
    """Super admins get the same email-account access as org admins (support/
    debugging), scoped to their own organization — not cross-org access."""
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=super_admin_headers)
    assert response.status_code == 200


async def test_super_admin_can_set_default_and_disconnect(client, super_admin_headers):
    with patch("app.services.email_providers.smtp_provider.SMTPProvider.send", return_value=None):
        create_response = await client.post("/v1/email-accounts/smtp", json=SMTP_PAYLOAD, headers=super_admin_headers)
    account_id = create_response.json()["data"]["id"]

    set_default_response = await client.post(
        f"/v1/email-accounts/{account_id}/set-default", headers=super_admin_headers
    )
    assert set_default_response.status_code == 200

    disconnect_response = await client.delete(f"/v1/email-accounts/{account_id}", headers=super_admin_headers)
    assert disconnect_response.status_code == 200


async def test_gmail_authorize_allows_admin_super_admin_and_recruiter(
    client, recruiter_headers, admin_headers, super_admin_headers
):
    # None of the three should ever 403 here — Gmail is one of the ways a
    # recruiter connects their own single personal mailbox too. Google OAuth
    # isn't configured in tests, so a well-formed request lands on 400
    # ("not configured"), not 403 — that's what proves the role check passes.
    for headers in (recruiter_headers, admin_headers, super_admin_headers):
        response = await client.get("/v1/email-accounts/gmail/authorize", headers=headers)
        assert response.status_code in (200, 400)
