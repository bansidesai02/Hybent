from datetime import datetime, timedelta, timezone

from voice.enums import Outcome
from voice.policy import default_config, next_allowed_time, retry_time
from voice.recommend import HOLD, NOT_RECOMMENDED, RECOMMEND, recommend

UTC = timezone.utc
NOW = datetime(2026, 10, 20, 6, 0, tzinfo=UTC)  # 11:30 IST


class TestCallingWindow:
    def test_inside_window_unchanged(self):
        assert next_allowed_time(NOW, "Asia/Kolkata", "09:00", "20:00") == NOW

    def test_before_window_moves_to_start_same_day(self):
        early = datetime(2026, 10, 20, 1, 0, tzinfo=UTC)  # 06:30 IST
        assert next_allowed_time(early, "Asia/Kolkata", "09:00", "20:00") == datetime(2026, 10, 20, 3, 30, tzinfo=UTC)

    def test_after_window_moves_to_next_morning(self):
        late = datetime(2026, 10, 20, 15, 0, tzinfo=UTC)  # 20:30 IST
        assert next_allowed_time(late, "Asia/Kolkata", "09:00", "20:00") == datetime(2026, 10, 21, 3, 30, tzinfo=UTC)

    def test_uses_callee_time_zone(self):
        # 06:00 UTC is 02:00 in New York -> 09:00 New York = 13:00 UTC
        assert next_allowed_time(NOW, "America/New_York", "09:00", "20:00") == datetime(2026, 10, 20, 13, 0, tzinfo=UTC)


class TestRetries:
    cfg = default_config("PRESCREEN")

    def _retry(self, outcome, attempts, **kw):
        return retry_time(outcome=outcome, attempt_count=attempts, callbacks_so_far=kw.get("callbacks", 0),
                          callback_at=kw.get("callback_at"), config=kw.get("config", self.cfg), now=NOW)

    def test_no_answer_retries_after_gap(self):
        assert self._retry(Outcome.NO_ANSWER, 1) == NOW + timedelta(hours=2)

    def test_stops_after_max_attempts(self):
        assert self._retry(Outcome.BUSY, 3) is None

    def test_reminder_retries_once_after_15_minutes(self):
        cfg = default_config("REMINDER")
        assert self._retry(Outcome.NO_ANSWER, 1, config=cfg) == NOW + timedelta(minutes=15)
        assert self._retry(Outcome.NO_ANSWER, 2, config=cfg) is None

    def test_callback_at_requested_time_even_after_max_attempts(self):
        at = NOW + timedelta(hours=5)
        assert self._retry(Outcome.CALLBACK_REQUESTED, 3, callback_at=at, callbacks=1) == at

    def test_callbacks_are_capped(self):
        assert self._retry(Outcome.CALLBACK_REQUESTED, 1, callback_at=NOW, callbacks=3) is None

    def test_conversations_never_redial(self):
        for outcome in (Outcome.COMPLETED, Outcome.DECLINED, Outcome.WRONG_PERSON, Outcome.HUMAN_REQUESTED):
            assert self._retry(outcome, 1) is None


CRITERIA = {
    "min_experience_years": 4,
    "max_experience_years": 8,
    "budget_max": {"value": 1_800_000, "currency": "INR"},
    "max_notice_days": 60,
    "communication_threshold": 3.5,
}
ANSWERS = {
    "total_experience_years": 5.5,
    "relevant_experience_years": 4,
    "current_company": "ABC Technologies",
    "current_role": "Software Engineer",
    "current_ctc": {"value": 1_200_000, "currency": "INR"},
    "expected_ctc": {"value": 1_600_000, "currency": "INR"},
    "notice_period_days": 60,
}
GOOD_COMM = {"overall": 4.2, "confidence": "NORMAL"}


class TestRecommend:
    def test_all_good_recommends(self):
        assert recommend(ANSWERS, GOOD_COMM, CRITERIA, "COMPLETED")["decision"] == RECOMMEND

    def test_ectc_slightly_over_budget_is_hold(self):
        answers = {**ANSWERS, "expected_ctc": {"value": 2_100_000, "currency": "INR"}}  # 17% over
        assert recommend(answers, GOOD_COMM, CRITERIA, "COMPLETED")["decision"] == HOLD

    def test_ectc_far_over_budget_is_not_recommended(self):
        answers = {**ANSWERS, "expected_ctc": {"value": 2_400_000, "currency": "INR"}}  # 33% over
        assert recommend(answers, GOOD_COMM, CRITERIA, "COMPLETED")["decision"] == NOT_RECOMMENDED

    def test_unclear_field_is_hold(self):
        answers = {**ANSWERS, "current_ctc": "DECLINED_TO_SHARE"}
        result = recommend(answers, GOOD_COMM, CRITERIA, "COMPLETED")
        assert result["decision"] == HOLD
        assert "current_ctc" in result["reasons"][0]

    def test_low_confidence_audio_never_penalises_into_rejection(self):
        result = recommend(ANSWERS, {"overall": 1.5, "confidence": "LOW_CONFIDENCE"}, CRITERIA, "COMPLETED")
        assert result["decision"] == HOLD

    def test_not_interested(self):
        assert recommend(ANSWERS, GOOD_COMM, CRITERIA, "DECLINED")["decision"] == NOT_RECOMMENDED

    def test_missing_criteria_are_skipped(self):
        assert recommend(ANSWERS, None, {}, "COMPLETED")["decision"] == RECOMMEND
