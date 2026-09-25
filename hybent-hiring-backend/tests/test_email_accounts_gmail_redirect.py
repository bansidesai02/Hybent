"""
The Gmail OAuth callback trusts only a signed state, reads the user's role
from the database, and sends each role back to its own settings route — `/hiring/admin/*` and `/hiring/super-admin/*` are separate,
role-gated route trees on the frontend (RequireAuth roles=[...]), so sending
a super admin to the admin path would 403 them out at the router guard.
"""
from unittest.mock import AsyncMock, patch

from app.core.config import settings
from app.utils.security import create_oauth_state


def _state(user):
    return create_oauth_state(str(user.id), str(user.organization_id))


async def test_callback_redirects_admin_to_admin_settings(client, organization, admin_user):
    with patch(
        "app.services.email_providers.gmail_provider.exchange_code",
        new=AsyncMock(return_value={"email_address": "a@acme.com", "refresh_token": "rt", "access_token": "at"}),
    ):
        response = await client.get(
            "/v1/email-accounts/gmail/callback",
            params={"state": _state(admin_user), "code": "abc"},
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
            params={"state": _state(super_admin_user), "code": "abc"},
            follow_redirects=False,
        )
    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/hiring/super-admin/settings")
    assert "success=email_account_connected" in location


async def test_callback_error_returns_to_the_users_own_settings(client, super_admin_user):
    response = await client.get(
        "/v1/email-accounts/gmail/callback",
        params={"state": _state(super_admin_user), "error": "access_denied"},
        follow_redirects=False,
    )
    assert response.status_code in (302, 307)
    location = response.headers["location"]
    assert location.startswith(f"{settings.frontend_url}/hiring/super-admin/settings")
    assert "error=email_account_auth_failed" in location


async def test_forged_plain_state_is_rejected(client, organization, recruiter_user):
    """The old unsigned "org:user:role" format claiming admin must not connect anything."""
    with patch(
        "app.services.email_providers.gmail_provider.exchange_code",
        new=AsyncMock(return_value={"email_address": "x@acme.com", "refresh_token": "rt", "access_token": "at"}),
    ) as exchange:
        response = await client.get(
            "/v1/email-accounts/gmail/callback",
            params={"state": f"{organization.id}:{recruiter_user.id}:admin", "code": "abc"},
            follow_redirects=False,
        )
    assert "error=email_account_auth_failed" in response.headers["location"]
    exchange.assert_not_called()


async def test_scope_comes_from_the_database_role(client, db_session, organization, recruiter_user):
    from sqlalchemy import select
    from app.models.email_account import EmailAccount

    with patch(
        "app.services.email_providers.gmail_provider.exchange_code",
        new=AsyncMock(return_value={"email_address": "rec@gmail.com", "refresh_token": "rt", "access_token": "at"}),
    ):
        response = await client.get(
            "/v1/email-accounts/gmail/callback",
            params={"state": _state(recruiter_user), "code": "abc"},
            follow_redirects=False,
        )
    assert response.headers["location"].startswith(f"{settings.frontend_url}/hiring/recruiter/settings")
    account = (await db_session.execute(select(EmailAccount))).scalar_one()
    assert account.scope == "personal"
    assert account.connected_by_user_id == recruiter_user.id
    assert account.is_default is True


async def test_callback_falls_back_to_admin_path_on_malformed_state(client):
    response = await client.get(
        "/v1/email-accounts/gmail/callback",
        params={"state": "not-a-valid-state", "error": "access_denied"},
        follow_redirects=False,
    )
    assert response.status_code in (302, 307)
    assert response.headers["location"].startswith(f"{settings.frontend_url}/hiring/admin/settings")
