"""
Unit tests for AI credit rules and prompt processing.
"""
import pytest
from app.schemas.ai import AICreditRuleCreate, AICreditTopupRequest, GenerateJDRequest, EvaluateNotesRequest
from pydantic import ValidationError

def test_ai_credit_rule_validation():
    rule = AICreditRuleCreate(
        feature_name="interview_evaluation",
        credits_per_use=10,
        description="Standard evaluation"
    )
    assert rule.credits_per_use == 10

    with pytest.raises(ValidationError):
        AICreditRuleCreate(feature_name="test", credits_per_use=-5)

def test_generate_jd_request_validation():
    req = GenerateJDRequest(prompt="BDE")
    assert len(req.prompt) >= 2

    with pytest.raises(ValidationError):
        GenerateJDRequest(prompt="a")

def test_evaluate_notes_request_validation():
    notes = "Candidate demonstrated strong communication skills and solved the algorithmic question efficiently."
    req = EvaluateNotesRequest(raw_notes=notes)
    assert len(req.raw_notes) >= 10

    with pytest.raises(ValidationError):
        EvaluateNotesRequest(raw_notes="too short")

def test_calculate_years_from_experience():
    from app.services.ai.resume_parser import calculate_years_from_experience
    
    exp1 = [{"duration": "2.5 Years"}, {"duration": "Not specified"}]
    years, text = calculate_years_from_experience(exp1)
    assert years == 2.5
    assert text == "2.5 Years"

    exp2 = [{"duration": "1 Year 6 Months"}]
    years2, text2 = calculate_years_from_experience(exp2)
    assert years2 == 1.5
    assert text2 == "1.5 Years"

    exp3 = [{"duration": "6 Months"}]
    years3, text3 = calculate_years_from_experience(exp3)
    assert years3 == 0.5
    assert text3 == "6 Months"

    # A proper date range with no explicit "X years/months" wording still
    # computes correctly via the date-math branch.
    exp4 = [{"duration": "Jan 2020 - Dec 2022"}]
    years4, text4 = calculate_years_from_experience(exp4)
    assert years4 == 3.0
    assert text4 == "3 Years"

    # A bare year with no range and no explicit duration ("2024") isn't a
    # resolvable duration — it used to be guessed as "~1 month", producing a
    # misleading years_experience of 0.1. An entry we can't confidently
    # resolve should contribute nothing rather than a fabricated number.
    exp5 = [{"duration": "2024"}]
    years5, text5 = calculate_years_from_experience(exp5)
    assert years5 is None
    assert text5 is None

