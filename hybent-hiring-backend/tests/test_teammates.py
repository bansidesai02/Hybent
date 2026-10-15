"""GET /v1/users/teammates — who the message inbox offers to chat with."""
from app.models.user import User
from app.utils.security import hash_password
from tests.conftest import _make_user, auth_headers


async def test_teammates_are_active_staff_of_own_org_excluding_self(
    client, db_session, organization, admin_user, recruiter_user, other_org_admin
):
    interviewer = await _make_user(db_session, organization, "interviewer")
    inactive = await _make_user(db_session, organization, "recruiter")
    inactive.is_active = False
    db_session.add(User(organization_id=organization.id, email="cand@example.com", full_name="Cand",
                        hashed_password=hash_password("x12345678"), role="candidate", is_active=True))
    await db_session.commit()

    r = await client.get("/v1/users/teammates", headers=auth_headers(admin_user))
    assert r.status_code == 200
    assert {u["id"] for u in r.json()["data"]} == {str(recruiter_user.id), str(interviewer.id)}

    # Interviewers have team chat too, so they get the list as well.
    r = await client.get("/v1/users/teammates", headers=auth_headers(interviewer))
    assert {u["id"] for u in r.json()["data"]} == {str(admin_user.id), str(recruiter_user.id)}


async def test_candidates_cannot_list_the_team(client, db_session, organization):
    cand = await _make_user(db_session, organization, "candidate")
    assert (await client.get("/v1/users/teammates", headers=auth_headers(cand))).status_code == 403
