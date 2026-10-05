"""
Rule-based screening decisions — no AI call, no cost.

Clear cases are settled here. Only candidates who are worth a closer look
(a reasonable match for some open job) go on to the one AI call in
nodes.decide, and this draft is what's used if that call fails.
"""
LOW_MATCH = 40     # below this for every open job → talent pool, no AI call
STRONG_MATCH = 75  # at or above → draft "pre_screen"

RECOMMENDATIONS = ("pre_screen", "shortlist", "talent_pool", "reject")


def rule_decision(matches: list[dict]) -> dict:
    """Returns a decision dict plus `needs_ai`: whether the AI should review it."""
    if not matches:
        return {
            "recommendation": "talent_pool", "job_id": None, "confidence": "high", "needs_ai": False,
            "reasons": ["No open job to match this candidate against right now."], "risks": [],
        }
    best = matches[0]
    score = best.get("score") or 0
    if score < LOW_MATCH:
        return {
            "recommendation": "talent_pool", "job_id": None, "confidence": "high", "needs_ai": False,
            "reasons": [f"Low match for every open role (best: {best['title']}, {score:.0f}%)."], "risks": [],
        }
    if score >= STRONG_MATCH:
        return {
            "recommendation": "pre_screen", "job_id": best["job_id"], "confidence": "medium", "needs_ai": True,
            "reasons": [f"Strong match for {best['title']} ({score:.0f}%)."], "risks": [],
        }
    return {
        "recommendation": "shortlist", "job_id": best["job_id"], "confidence": "low", "needs_ai": True,
        "reasons": [f"Partial match for {best['title']} ({score:.0f}%) — worth a recruiter's look."], "risks": [],
    }
