"""
The Gmail OAuth callback must send admins and super admins back to their own
settings route — `/hiring/admin/*` and `/hiring/super-admin/*` are separate,
role-gated route trees on the frontend (RequireAuth roles=[...]), so sending
a super admin to the admin path would 403 them out at the router guard.
"""
from unittest.mock import AsyncMock, patch

from app.core.config import settings


async def test_callback_redirects_admin_to_admin_settings(client, organization, admin_user):
    with patch(
        "app.services.email_providers.gmail_provider.exchange_code",
        new=AsyncMock(return_value={"email_address": "a@acme.com", "refresh_token": "rt", "access_token": "at"}),
    ):
        response = await client.get(
            "/v1/email-accounts/gmail/callback",
            params={"state": f"{organization.id}:{admin_user.id}:admin", "code": "abc"},
            follow_redirects=False,
        )
    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/hiring/admin/settings")
    assert "success=email_account_connected" in location


async def test_callback_redirects_super_admin_to_super_admin_settings(client, organization, super_admin_user):
    with patch(
        "app.services.email_providers.gmail_provider.exchange_code",
        new=AsyncMock(return_value={"email_address": "a@acme.com", "refresh_token": "rt", "access_token": "at"}),
    ):
        response = await client.get(
            "/v1/email-accounts/gmail/callback",
            params={
                "state": f"{organization.id}:{super_admin_user.id}:super_admin",
                "code": "abc",
            },
            follow_redirects=False,
        )
    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/hiring/super-admin/settings")
    assert "success=email_account_connected" in location


async def test_callback_error_still_respects_role_in_state(client):
    response = await client.get(
        "/v1/email-accounts/gmail/callback",
        params={"state": "00000000-0000-0000-0000-000000000001:00000000-0000-0000-0000-000000000002:super_admin", "error": "access_denied"},
        follow_redirects=False,
    )
    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/hiring/super-admin/settings")
    assert "error=email_account_auth_failed" in location


async def test_callback_falls_back_to_admin_path_on_malformed_state(client):
    response = await client.get(
        "/v1/email-accounts/gmail/callback",
        params={"state": "not-a-valid-state", "error": "access_denied"},
        follow_redirects=False,
    )
    assert response.status_code in (302, 307)
    assert response.headers["location"].startswith(f"{settings.frontend_url}/hiring/admin/settings")
