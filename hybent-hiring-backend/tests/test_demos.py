"""Demo booking: open slots, book, double-booking, work email, move, cancel,
reminders and the super admin list. Google Calendar, email and DNS are faked."""
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.models.demo_booking import DemoBooking
from app.services import calendar_service, demo_service, email_service, lead_checks

BASE = {
    "name": "Ananya Shah", "email": "ananya@initech-example.com", "company": "Initech",
    "team_size": "51–200", "notes": "AI screening", "timezone": "Asia/Dubai", "elapsed_ms": 6000,
}


@pytest.fixture(autouse=True)
def fakes(monkeypatch):
    sent = {"emails": [], "events": [], "cancelled": []}
    monkeypatch.setattr(email_service, "send_email",
                        lambda to, subject, body, **k: sent["emails"].append((to, subject, body)) or True)

    async def accepts(domain):
        return True

    async def create_event(**kw):
        sent["events"].append(kw)
        return {"event_id": f"evt{len(sent['events'])}", "meeting_link": "https://meet.google.com/abc-defg-hij"}

    async def cancel_event(event_id, token=None):
        sent["cancelled"].append(event_id)
        return True

    monkeypatch.setattr(lead_checks, "domain_accepts_mail", accepts)
    monkeypatch.setattr(lead_checks, "rate_limited", lambda ip: False)
    monkeypatch.setattr(calendar_service, "create_calendar_event", create_event)
    monkeypatch.setattr(calendar_service, "cancel_calendar_event", cancel_event)
    monkeypatch.setattr(demo_service, "_google_busy", lambda *a: [])
    return sent


async def _slots(client, **params):
    r = await client.get("/api/public/demo/slots", params=params)
    assert r.status_code == 200, r.text
    return r.json()["data"]["slots"]


@pytest.mark.asyncio
async def test_slots_are_weekdays_in_india_hours(client):
    slots = await _slots(client)
    assert slots, "there should be open slots in the next three weeks"
    now = datetime.now(timezone.utc)
    for s in slots:
        t = datetime.fromisoformat(s)
        ist = t.astimezone(demo_service.HOST_TZ)
        assert ist.weekday() < 5
        assert (10, 0) <= (ist.hour, ist.minute) <= (18, 30)
        assert t >= now + demo_service.MIN_NOTICE


@pytest.mark.asyncio
async def test_book_then_slot_and_neighbour_disappear(client, db_session, fakes):
    slots = await _slots(client)
    first = slots[0]
    r = await client.post("/api/public/demo/book", json={**BASE, "start_at": first})
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["meet_link"].startswith("https://meet.google.com/")
    assert data["manage_token"]

    # The visitor and the host both got mail; the event invited both.
    tos = [to for to, *_ in fakes["emails"]]
    assert "ananya@initech-example.com" in tos and "info@hybent.com" in tos
    assert set(fakes["events"][0]["attendee_emails"]) == {"ananya@initech-example.com", "info@hybent.com"}
    # The confirmation shows the visitor's own time zone.
    body = next(b for to, s, b in fakes["emails"] if to == "ananya@initech-example.com")
    assert "Asia/Dubai" in body

    after = await _slots(client)
    assert first not in after
    nxt = (datetime.fromisoformat(first) + timedelta(minutes=30)).isoformat()
    assert nxt not in after, "the 15-minute buffer blocks the next half hour"

    # Same slot again: 409.
    r = await client.post("/api/public/demo/book", json={**BASE, "email": "b@initech-example.com", "start_at": first})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_personal_email_ok_throwaway_and_bots_not(client, db_session):
    slots = await _slots(client)
    # Personal email is fine for a demo.
    r = await client.post("/api/public/demo/book", json={**BASE, "email": "someone@gmail.com", "start_at": slots[0]})
    assert r.status_code == 200, r.text
    await db_session.execute(DemoBooking.__table__.delete())
    await db_session.commit()
    slot = slots[3]
    r = await client.post("/api/public/demo/book", json={**BASE, "email": "x@mailinator.com", "start_at": slot})
    assert r.status_code == 422
    # Honeypot: looks like success, books nothing.
    r = await client.post("/api/public/demo/book", json={**BASE, "website": "x", "start_at": slot})
    assert r.status_code == 200
    assert (await db_session.execute(select(DemoBooking))).scalars().all() == []


@pytest.mark.asyncio
async def test_closed_time_is_refused(client):
    sunday = datetime.now(demo_service.HOST_TZ) + timedelta(days=7)
    sunday = sunday - timedelta(days=(sunday.weekday() - 6) % 7)
    at = sunday.replace(hour=11, minute=0, second=0, microsecond=0)
    r = await client.post("/api/public/demo/book", json={**BASE, "start_at": at.isoformat()})
    assert r.status_code == 409


@pytest.mark.asyncio
async def test_reschedule_and_cancel(client, db_session, fakes):
    slots = await _slots(client)
    token = (await client.post("/api/public/demo/book", json={**BASE, "start_at": slots[0]})).json()["data"]["manage_token"]

    r = await client.get(f"/api/public/demo/manage/{token}")
    assert r.status_code == 200 and r.json()["data"]["status"] == "booked"

    # Moving it: its own slot stays offered while moving, the new one is taken.
    moving = await _slots(client, exclude=token)
    assert slots[0] in moving
    target = slots[5]
    r = await client.post(f"/api/public/demo/manage/{token}/reschedule", json={"start_at": target})
    assert r.status_code == 200, r.text
    assert datetime.fromisoformat(r.json()["data"]["start_at"]) == datetime.fromisoformat(target)
    assert fakes["cancelled"] == ["evt1"]
    assert slots[0] in await _slots(client)

    r = await client.post(f"/api/public/demo/manage/{token}/cancel")
    assert r.json()["data"]["status"] == "cancelled"
    assert target in await _slots(client)
    assert (await client.get("/api/public/demo/manage/not-a-token")).status_code == 404


@pytest.mark.asyncio
async def test_reminders_sent_once(client, db_session, fakes):
    now = datetime.now(timezone.utc)
    b = DemoBooking(name="Sam Lee", email="sam@initech-example.com", company="Initech",
                    start_at=now + timedelta(hours=20), timezone="UTC", manage_token="tok-24",
                    created_at=now - timedelta(days=2))
    c = DemoBooking(name="Kim Roe", email="kim@initech-example.com", company="Initech",
                    start_at=now + timedelta(minutes=50), timezone="UTC", manage_token="tok-1",
                    created_at=now - timedelta(days=2))
    db_session.add_all([b, c])
    await db_session.commit()

    done = await demo_service.send_reminders(db_session, now)
    assert done == {"24h": 1, "1h": 1}
    assert await demo_service.send_reminders(db_session, now) == {"24h": 0, "1h": 0}
    subjects = [s for _, s, _ in fakes["emails"]]
    assert any("tomorrow" in s for s in subjects) and any("in one hour" in s for s in subjects)


@pytest.mark.asyncio
async def test_super_admin_list_and_status(client, db_session, super_admin_headers, admin_headers):
    slot = (await _slots(client))[0]
    await client.post("/api/public/demo/book", json={**BASE, "start_at": slot})

    assert (await client.get("/v1/super-admin/demos", headers=admin_headers)).status_code == 403
    r = await client.get("/v1/super-admin/demos", headers=super_admin_headers)
    assert r.status_code == 200
    item = r.json()["data"]["items"][0]
    assert item["company"] == "Initech"

    r = await client.patch(f"/v1/super-admin/demos/{item['id']}", headers=super_admin_headers,
                           json={"status": "completed", "admin_notes": "Wants Pro"})
    assert r.json()["data"]["status"] == "completed"
    assert r.json()["data"]["admin_notes"] == "Wants Pro"


@pytest.mark.asyncio
async def test_super_admin_sends_meeting_link(client, db_session, super_admin_headers, admin_headers, fakes):
    slot = (await _slots(client))[0]
    await client.post("/api/public/demo/book", json={**BASE, "start_at": slot})
    demo_id = (await client.get("/v1/super-admin/demos", headers=super_admin_headers)).json()["data"]["items"][0]["id"]
    fakes["emails"].clear()

    url = f"/v1/super-admin/demos/{demo_id}/send-link"
    assert (await client.post(url, headers=admin_headers, json={"meet_link": "https://zoom.us/j/1"})).status_code == 403
    assert (await client.post(url, headers=super_admin_headers, json={"meet_link": "zoom.us/j/1"})).status_code == 422

    r = await client.post(url, headers=super_admin_headers, json={"meet_link": "https://zoom.us/j/123"})
    assert r.status_code == 200, r.text
    assert r.json()["data"]["meet_link"] == "https://zoom.us/j/123"
    to, subject, body = fakes["emails"][-1]
    assert to == "ananya@initech-example.com" and "link" in subject.lower() and "https://zoom.us/j/123" in body
