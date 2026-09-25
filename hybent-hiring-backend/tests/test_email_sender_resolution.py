"""Email a user triggers goes out from their own primary mailbox; with none
connected, from the platform sender."""
from unittest.mock import patch

from app.models.candidate import Candidate
from app.models.email_account import EmailAccount, EmailAccountProvider, EmailAccountScope


async def _candidate(db_session, organization):
    c = Candidate(organization_id=organization.id, email="cand@x.com", full_name="Cand", pipeline_stage="screening")
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


async def test_rejection_is_sent_from_the_recruiters_own_mailbox(
    client, db_session, organization, recruiter_user, recruiter_headers, admin_user
):
    mine = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="rec@gmail.com",
        scope=EmailAccountScope.PERSONAL, connected_by_user_id=recruiter_user.id, is_default=True,
    )
    # An admin's primary in the same org must not be used for the recruiter's mail.
    admins = EmailAccount(
        organization_id=organization.id, provider=EmailAccountProvider.SMTP, email_address="admin@acme.com",
        connected_by_user_id=admin_user.id, is_default=True,
    )
    db_session.add_all([mine, admins])
    await db_session.commit()
    candidate = await _candidate(db_session, organization)

    with patch("app.services.email_service.send_email") as send:
        response = await client.put(
            f"/v1/candidates/{candidate.id}", json={"pipeline_stage": "rejected"}, headers=recruiter_headers
        )
    assert response.status_code == 200
    assert send.call_count == 1
    assert send.call_args.kwargs["email_account"].email_address == "rec@gmail.com"


async def test_rejection_uses_the_platform_sender_without_a_mailbox(
    client, db_session, organization, recruiter_headers
):
    candidate = await _candidate(db_session, organization)
    with patch("app.services.email_service.send_email") as send:
        response = await client.put(
            f"/v1/candidates/{candidate.id}", json={"pipeline_stage": "rejected"}, headers=recruiter_headers
        )
    assert response.status_code == 200
    assert send.call_count == 1
    assert send.call_args.kwargs["email_account"] is None
