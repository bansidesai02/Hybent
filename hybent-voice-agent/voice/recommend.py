"""
Pre-screen recommendation (Spec §5.8). Rules, not the LLM, decide — so HR
gets the same answer for the same facts and can see why. Advisory only:
the engine never changes a candidate's status.

Criteria come from the task context (all optional; a missing one is skipped):
    min_experience_years, max_experience_years,
    budget_max {"value", "currency"}, max_notice_days, communication_threshold
"""
RECOMMEND = "RECOMMEND_NEXT_ROUND"
HOLD = "HOLD"
NOT_RECOMMENDED = "NOT_RECOMMENDED"

ECTC_RECOMMEND_GAP = 0.10     # up to 10% over budget still recommends (Plan §13)
ECTC_HOLD_GAP = 0.25          # 10–25% over is HOLD, more is a hard fail
EXPERIENCE_HARD_FLOOR = 0.75  # below 75% of the minimum is a hard fail
NOTICE_HARD_FACTOR = 1.5      # more than 1.5x the maximum is a hard fail

REQUIRED_FIELDS = (
    "total_experience_years",
    "relevant_experience_years",
    "current_company",
    "current_role",
    "current_ctc",
    "expected_ctc",
    "notice_period_days",
)


def recommend(answers: dict, communication: dict | None, criteria: dict, outcome: str) -> dict:
    hard: list[str] = []
    borderline: list[str] = []
    good: list[str] = []

    if outcome == "DECLINED":
        return {"decision": NOT_RECOMMENDED, "reasons": ["Candidate is not interested"]}

    missing = [f for f in REQUIRED_FIELDS if answers.get(f) in (None, "UNCLEAR", "DECLINED_TO_SHARE")]
    if missing:
        borderline.append("Unclear or missing: " + ", ".join(missing))

    exp = answers.get("total_experience_years")
    if isinstance(exp, (int, float)):
        lo, hi = criteria.get("min_experience_years"), criteria.get("max_experience_years")
        if lo is not None and exp < lo * EXPERIENCE_HARD_FLOOR:
            hard.append(f"Experience {exp:g} yrs is well below the {lo:g} yr minimum")
        elif lo is not None and exp < lo:
            borderline.append(f"Experience {exp:g} yrs is slightly below the {lo:g} yr minimum")
        elif hi is not None and exp > hi:
            borderline.append(f"Experience {exp:g} yrs is above the {hi:g} yr range")
        elif lo is not None or hi is not None:
            good.append("Experience matches")

    ectc, budget = answers.get("expected_ctc"), criteria.get("budget_max")
    if isinstance(ectc, dict) and budget and budget.get("value"):
        if ectc.get("currency") != budget.get("currency", ectc.get("currency")):
            borderline.append("Expected CTC is in a different currency from the budget")
        else:
            gap = ectc["value"] / budget["value"] - 1
            if gap > ECTC_HOLD_GAP:
                hard.append(f"Expected CTC is {gap:.0%} above budget")
            elif gap > ECTC_RECOMMEND_GAP:
                borderline.append(f"Expected CTC is {gap:.0%} above budget")
            elif gap > 0:
                good.append(f"ECTC within {ECTC_RECOMMEND_GAP:.0%} of budget")
            else:
                good.append("ECTC within budget")

    notice, max_notice = answers.get("notice_period_days"), criteria.get("max_notice_days")
    if isinstance(notice, (int, float)) and max_notice is not None:
        if notice > max_notice * NOTICE_HARD_FACTOR:
            hard.append(f"Notice period {notice} days is far above the {max_notice}-day limit")
        elif notice > max_notice:
            borderline.append(f"Notice period {notice} days is above the {max_notice}-day limit")
        else:
            good.append("Notice period acceptable")

    threshold = criteria.get("communication_threshold")
    if communication and threshold is not None:
        if communication.get("confidence") == "LOW_CONFIDENCE":
            borderline.append("Communication score is low-confidence (poor audio)")
        elif (communication.get("overall") or 0) < threshold:
            borderline.append(f"Communication {communication.get('overall')} is below the {threshold} threshold")
        else:
            good.append("Communication meets the role threshold")

    if hard:
        return {"decision": NOT_RECOMMENDED, "reasons": hard[:3]}
    if borderline:
        return {"decision": HOLD, "reasons": borderline[:3]}
    return {"decision": RECOMMEND, "reasons": good[:3] or ["No concerns found"]}
