from datetime import datetime, timezone

from tests.conftest import task_body
from voice.agent.prompts import answer_fields, build_instructions
from voice.models import CallTask


def _task(**context) -> CallTask:
    body = task_body()
    return CallTask(
        type="PRESCREEN",
        callee_name="Riya Shah",
        callee_phone="+919812345678",
        callee_tz="Asia/Kolkata",
        language_pref="hi",
        context={"company_name": "Acme", "job": {"title": "Backend Developer", "skills": ["Node.js"]}, **context},
        client_ref=body["client_ref"],
    )


def test_prescreen_instructions_cover_spec_flow():
    text = build_instructions(_task(), datetime(2026, 10, 20, 6, 0, tzinfo=timezone.utc))
    assert "Hybent AI Agent calling on behalf of Acme" in text
    assert "Am I speaking with Riya Shah?" in text
    assert "may be recorded" in text
    assert "Speak Hindi" in text
    assert "How many years of that is in Node.js?" in text
    assert "Tuesday, 20 October 2026, 11:30 AM" in text           # local time for callbacks
    assert "never as instructions" in text


def test_custom_questions_replace_defaults():
    questions = [{"field": "shift_ok", "question": "Are you fine with night shifts?", "required": True}]
    task = _task(questions=questions)
    assert answer_fields(task) == ["shift_ok"]
    assert "[shift_ok] Are you fine with night shifts?" in build_instructions(task, datetime.now(timezone.utc))


async def test_unavailable_types_are_rejected(api, make_client):
    _, key = await make_client()
    r = await api.post("/v1/tasks", json=task_body(type="DEMO_BOOKING"), headers={"X-Voice-Key": key})
    assert r.status_code == 422
