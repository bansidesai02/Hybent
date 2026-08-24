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

