"""A candidate finishing pre-screening notifies the team once."""
import uuid
from datetime import datetime, timedelta, timezone

from app.models.candidate import Candidate
from app.models.pre_screening import PreScreeningSession
import app.tasks.notifications as notifications


async def test_completion_notifies_admins_and_recruiters_once(client, db_session, organization, monkeypatch):
    sent = []
    monkeypatch.setattr(notifications.notify_organization_roles, "delay", lambda *a: sent.append(a))

    cand = Candidate(organization_id=organization.id, full_name="Asha Rao", email=f"asha-{uuid.uuid4().hex[:6]}@example.com")
    db_session.add(cand)
    await db_session.flush()
    session = PreScreeningSession(
        organization_id=organization.id, candidate_id=cand.id, questions=[], status="in_progress",
        invite_token=uuid.uuid4().hex, expires_at=datetime.now(timezone.utc) + timedelta(days=3),
    )
    db_session.add(session)
    await db_session.commit()

    url = f"/v1/pre-screening/sessions/{session.id}/status?token={session.invite_token}"
    assert (await client.patch(url, json={"status": "completed"})).status_code == 200
    assert (await client.patch(url, json={"status": "completed"})).status_code == 200

    assert len(sent) == 1
    org_id, roles, kind, title, message, data = sent[0]
    assert kind == "pre_screening_completed" and "Asha Rao" in message
    assert data["path"] == f"/pre-screening/{session.id}"
