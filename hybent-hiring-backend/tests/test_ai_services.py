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
    req = GenerateJDRequest(prompt="Senior Python Backend Engineer with FastAPI and PostgreSQL experience")
    assert len(req.prompt) > 5

    with pytest.raises(ValidationError):
        GenerateJDRequest(prompt="abc")

def test_evaluate_notes_request_validation():
    notes = "Candidate demonstrated strong communication skills and solved the algorithmic question efficiently."
    req = EvaluateNotesRequest(raw_notes=notes)
    assert len(req.raw_notes) >= 10

    with pytest.raises(ValidationError):
        EvaluateNotesRequest(raw_notes="too short")
