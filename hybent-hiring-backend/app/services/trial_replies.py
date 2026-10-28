"""Emails the Hybent team sends about a trial request, from Super Admin.

The team picks a kind (approve, reject, ask for more information), asks the
AI for a draft (or regenerates it with an instruction), edits it, and sends.
Nothing is sent without a person pressing Send. Approving also starts the
trial, and the email gets the organization setup button.
"""
import asyncio
import json
import logging

from app.core.config import settings
from app.models.trial_request import TrialRequest

logger = logging.getLogger(__name__)

KINDS = ("approve", "reject", "info")
CTA_LABEL = "Set up your organization"

PLAN_TEXT = {
    "standard": "the Standard plan (all Standard features and 1 admin seat)",
    "pro": "the Pro plan (all Pro features including the Recruiter Copilot, 1 admin and 1 recruiter seat)",
}

GUIDE = {
    "approve": (
        "Tell them we received their free trial request and it is approved. Their 7-day trial of {plan} starts "
        "today (do NOT mention a date; it is added below the email). Ask them to complete their organization setup with the button below the email "
        "(do NOT write a link or URL yourself): set a password, add their company logo and details. Mention that their "
        "team's emails to candidates will carry their company name and logo. Offer help at info@hybent.com."
    ),
    "reject": (
        "Politely tell them we can't offer a free trial at this time. Give the reason if one is provided, without "
        "blaming them. Invite them to book a demo or reply to talk about a plan."
    ),
    "info": (
        "Thank them for the request and ask for the information we still need to verify the company before approving "
        "the trial. Keep it short and specific."
    ),
}

SYSTEM = (
    "You write short, warm, professional emails for Hybent Hiring, an AI recruitment platform, sent from "
    "info@hybent.com by the Hybent team. Plain text only: no markdown, no links, no placeholders like [Name]. "
    "Greet the person by first name and sign off as 'The Hybent Team'. Return JSON: "
    '{"subject": "...", "body": "..."} where body uses blank lines between paragraphs.'
)


def _facts(req: TrialRequest) -> dict:
    return {
        "first_name": (req.contact_name or "").split()[0] if req.contact_name else "",
        "company": req.company_name,
        "plan": PLAN_TEXT.get(req.plan_interest, PLAN_TEXT["pro"]),
        "industry": req.industry,
        "size": req.company_size,
        "hiring_needs": req.hiring_needs or "",
    }


def fallback(req: TrialRequest, kind: str, reason: str = "") -> dict:
    """A fixed draft when the AI isn't available."""
    f = _facts(req)
    hello = f"Hi {f['first_name']}," if f["first_name"] else "Hello,"
    if kind == "approve":
        return {
            "subject": f"Your Hybent Hiring free trial for {f['company']} is approved",
            "body": (
                f"{hello}\n\nThank you for requesting a free trial of Hybent Hiring. We've reviewed your request and "
                f"we're happy to confirm that your 7-day trial of {f['plan']} starts today.\n\n"
                "To get started, complete your organization setup using the button below. "
                "You'll set your password and add your company logo and details, so every email your team sends to "
                "candidates carries your company's name and brand.\n\nIf you have any questions, just reply to this "
                "email or write to info@hybent.com.\n\nThe Hybent Team"
            ),
        }
    if kind == "reject":
        why = f"\n\n{reason.strip()}" if reason.strip() else ""
        return {
            "subject": "About your Hybent Hiring free trial request",
            "body": (
                f"{hello}\n\nThank you for your interest in Hybent Hiring. After reviewing your request for "
                f"{f['company']}, we're unable to offer a free trial at this time.{why}\n\nWe'd still be glad to show "
                "you the product. Reply to this email and we'll set up a short demo.\n\nThe Hybent Team"
            ),
        }
    return {
        "subject": "A quick question about your Hybent Hiring trial request",
        "body": (
            f"{hello}\n\nThank you for requesting a free trial of Hybent Hiring for {f['company']}. Before we set up "
            "your workspace, we need a little more information to verify your company. Could you reply with the "
            "details below?\n\n- \n\nOnce we have them, we'll get your trial ready within one business day.\n\n"
            "The Hybent Team"
        ),
    }


def _ai_draft(req: TrialRequest, kind: str, instructions: str) -> dict:
    from app.services.groq_client import SafeGroq, get_best_groq_model

    client = SafeGroq(api_key=settings.groq_api_key)
    f = _facts(req)
    prompt = (
        f"Email type: {kind}\nWhat to say: {GUIDE[kind].format(plan=f['plan'])}\n\n"
        f"Recipient first name: {f['first_name']}\nCompany: {f['company']}\nIndustry: {f['industry'] or 'not given'}, "
        f"size: {f['size'] or 'not given'}\nWhat they want to use Hybent Hiring for: {f['hiring_needs'] or 'not given'}\n"
    )
    if instructions:
        prompt += f"\nExtra instructions from the Hybent team (follow them): {instructions}\n"
    response = client.chat.completions.create(
        messages=[{"role": "system", "content": SYSTEM}, {"role": "user", "content": prompt}],
        model=get_best_groq_model(client),
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=900,
    )
    data = json.loads(response.choices[0].message.content)
    subject, body = str(data.get("subject", "")).strip(), str(data.get("body", "")).strip()
    if not subject or not body:
        raise ValueError("empty draft")
    return {"subject": subject[:300], "body": body[:8000]}


async def draft(req: TrialRequest, kind: str, instructions: str = "") -> dict:
    """{subject, body, ai_generated}. Falls back to a fixed draft on any AI error."""
    if settings.groq_api_key:
        try:
            result = await asyncio.to_thread(_ai_draft, req, kind, instructions.strip()[:500])
            return {**result, "ai_generated": True}
        except Exception as e:
            logger.warning(f"AI draft for trial request {req.id} failed ({e}); using the template.")
    return {**fallback(req, kind, instructions), "ai_generated": False}
