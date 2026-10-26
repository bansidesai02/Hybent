from datetime import date

import pytest

from voice.extract import parse_compensation, parse_notice_period, parse_years

TODAY = date(2026, 10, 20)


@pytest.mark.parametrize(
    "raw, value, currency, period",
    [
        ("12 LPA", 1_200_000, "INR", "annual"),
        ("twelve lakhs", 1_200_000, "INR", "annual"),
        ("around 12.5 lakh per annum", 1_250_000, "INR", "annual"),
        ("12 and a half lakhs", 1_250_000, "INR", "annual"),
        ("1.2 million", 1_200_000, "INR", "annual"),
        ("Rs 12,00,000", 1_200_000, "INR", "annual"),
        ("fifty thousand a month", 600_000, "INR", "monthly"),
        ("50k per month in hand", 600_000, "INR", "monthly"),
        ("a lakh per month", 1_200_000, "INR", "monthly"),
        ("$120k", 120_000, "USD", "annual"),
        ("AED 20,000 per month", 240_000, "AED", "monthly"),
        ("1.5 crore", 15_000_000, "INR", "annual"),
        ("twenty five lakhs", 2_500_000, "INR", "annual"),
    ],
)
def test_compensation(raw, value, currency, period):
    parsed = parse_compensation(raw)
    assert parsed["value"] == value
    assert parsed["currency"] == currency
    assert parsed["period"] == period
    assert parsed["raw"] == raw


@pytest.mark.parametrize("raw", ["", "I'd rather not say", "depends on the role"])
def test_compensation_unclear(raw):
    assert parse_compensation(raw) is None


@pytest.mark.parametrize(
    "raw, days, negotiable",
    [
        ("two months", 60, None),
        ("60 days, negotiable", 60, True),
        ("immediate joiner", 0, None),
        ("one month, not negotiable", 30, False),
        ("3 weeks", 21, None),
        ("serving notice, last day 30th", 10, None),
        ("my last working day is 15th November", 26, None),
        ("90 days but can be bought out", 90, True),
    ],
)
def test_notice(raw, days, negotiable):
    parsed = parse_notice_period(raw, TODAY)
    assert parsed["days"] == days
    assert parsed["negotiable"] is negotiable


def test_notice_unclear():
    assert parse_notice_period("let me check with my manager", TODAY) is None


@pytest.mark.parametrize(
    "raw, years",
    [
        ("five and a half years", 5.5),
        ("5.5 yrs", 5.5),
        ("around 6 years", 6.0),
        ("8 months", 0.7),
        ("2 years 6 months", 2.5),
        ("I'm a fresher", 0.0),
        ("four", 4.0),
    ],
)
def test_years(raw, years):
    assert parse_years(raw) == years
