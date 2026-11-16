from unittest.mock import patch

import pytest

from app.core.config import settings
from app.models.sms import SmsLog, SmsSettings, SmsStatus
from app.services import sms_service


def test_indian_mobile_numbers_are_formatted_for_msg91():
    assert sms_service.msisdn("+91 9876543210") == "919876543210"
    assert sms_service.msisdn("98765 43210") == "919876543210"
    assert sms_service.msisdn("09876543210") == "919876543210"
    assert sms_service.msisdn("+1 4155550100") is None      # not India
    assert sms_service.msisdn("12345") is None
    assert sms_service.msisdn(None) is None


def test_message_text_fills_variables_in_order():
    text = sms_service.render(sms_service.EVENTS["interview_reminder"],
                              {"job": "Sales Executive", "when": "18 Nov, 11:00 AM", "link": "meet.google.com/x"})
    assert text == "Reminder: your interview for Sales Executive starts at 18 Nov, 11:00 AM. Join: meet.google.com/x - HYBENT"


@pytest.mark.asyncio
async def test_nothing_is_sent_while_sms_is_off(db_session, organization):
    log = await sms_service.send(db_session, organization.id, "shortlisted", "9876543210", {"name": "Rahul"})
    assert log is None


@pytest.mark.asyncio
async def test_test_mode_logs_without_sending(db_session, organization, monkeypatch):
    monkeypatch.setattr(settings, "sms_provider", "android")
    monkeypatch.setattr(settings, "android_sms_username", "")
    db_session.add(SmsSettings(organization_id=organization.id, enabled=True, events={}))
    await db_session.commit()
    with patch.object(sms_service, "_send_msg91") as provider:
        log = await sms_service.send(db_session, organization.id, "offer_sent", "+91 9876543210",
                                     {"name": "Rahul", "job": "Sales Executive"})
    provider.assert_not_called()
    assert log.status == SmsStatus.TEST
    assert "Rahul" in log.body and "Sales Executive" in log.body


@pytest.mark.asyncio
async def test_live_sends_with_the_company_template(db_session, organization, monkeypatch):
    monkeypatch.setattr(settings, "sms_provider", "msg91")
    monkeypatch.setattr(settings, "msg91_auth_key", "key")
    db_session.add(SmsSettings(organization_id=organization.id, enabled=True,
                               events={"offer_sent": {"on": True, "template_id": "tpl-1"}}))
    await db_session.commit()
    with patch.object(sms_service, "_send_msg91", return_value="req-1") as provider:
        log = await sms_service.send(db_session, organization.id, "offer_sent", "9876543210",
                                     {"name": "Rahul", "job": "Sales"})
    assert provider.call_args.args[:2] == ("tpl-1", "919876543210")
    assert log.status == SmsStatus.SENT and log.provider_ref == "req-1"


@pytest.mark.asyncio
async def test_switched_off_event_and_missing_template(db_session, organization, monkeypatch):
    monkeypatch.setattr(settings, "sms_provider", "msg91")
    monkeypatch.setattr(settings, "msg91_auth_key", "key")
    db_session.add(SmsSettings(organization_id=organization.id, enabled=True,
                               events={"rejected": {"on": False, "template_id": "t"}}))
    await db_session.commit()
    assert await sms_service.send(db_session, organization.id, "rejected", "9876543210", {}) is None
    log = await sms_service.send(db_session, organization.id, "shortlisted", "9876543210", {})
    assert log.status == SmsStatus.SKIPPED and "template" in log.error


@pytest.mark.asyncio
async def test_settings_api(client, admin_headers, recruiter_headers):
    r = await client.get("/v1/sms/settings", headers=recruiter_headers)
    assert r.status_code == 200 and r.json()["data"]["enabled"] is False
    assert {e["key"] for e in r.json()["data"]["events"]} == set(sms_service.EVENTS)

    body = {"enabled": True, "events": {"shortlisted": {"on": True, "template_id": " 123 "}}}
    assert (await client.put("/v1/sms/settings", json=body, headers=recruiter_headers)).status_code == 403
    r = await client.put("/v1/sms/settings", json=body, headers=admin_headers)
    assert r.status_code == 200
    data = r.json()["data"]
    assert data["enabled"] is True
    assert next(e for e in data["events"] if e["key"] == "shortlisted")["template_id"] == "123"

    r = await client.post("/v1/sms/test", json={"event": "shortlisted", "phone": "9876543210"}, headers=admin_headers)
    assert r.status_code == 200
    logs = (await client.get("/v1/sms/logs", headers=admin_headers)).json()["data"]
    assert logs and logs[0]["event"] == "shortlisted"


@pytest.mark.asyncio
async def test_android_phone_sends_plain_text_up_to_the_daily_limit(db_session, organization, monkeypatch):
    monkeypatch.setattr(settings, "sms_provider", "android")
    monkeypatch.setattr(settings, "android_sms_username", "u")
    monkeypatch.setattr(settings, "android_sms_password", "p")
    monkeypatch.setattr(settings, "sms_daily_limit", 2)
    db_session.add(SmsSettings(organization_id=organization.id, enabled=True, events={}))
    await db_session.commit()
    with patch.object(sms_service, "_send_android", return_value="m1") as phone:
        logs = [
            await sms_service.send(db_session, organization.id, "offer_sent", "9876543210",
                                   {"name": "Rahul", "job": "Sales"})
            for _ in range(3)
        ]
    assert phone.call_count == 2                       # no template id needed
    assert phone.call_args.args[0] == "919876543210"
    assert "Rahul" in phone.call_args.args[1]
    assert [l.status for l in logs] == [SmsStatus.SENT, SmsStatus.SENT, SmsStatus.SKIPPED]
    assert "Daily SMS limit" in logs[2].error
