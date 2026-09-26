from fastapi import APIRouter, HTTPException, Body, Depends, Response, BackgroundTasks
import asyncio
import html
import logging
import uuid
from app.dependencies import DB, require_admin, require_recruiter
from app.services.ai import ai_evaluator
from app.services import jd_pdf_generator
from app.services.ai_credit_service import AICreditsService, TOPUP_PACKS, TOPUP_REQUEST_EMAIL, daily_limit_for
from app.services import ai_pricing
from app.services.ai_metering import clear_blocked
from app.services.email_service import send_email
from app.models.organization import Organization
from app.models.user_ai_credits import UserAICredits
from app.schemas.response import APIResponse
from app.models.user import User
from typing import Annotated

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/ai", tags=["ai"])

@router.post("/evaluate-notes")
async def evaluate_notes(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    raw_notes: str = Body(..., embed=True)
):
    """
    Generate a structured evaluation from raw interview notes.
    """
    if not raw_notes or len(raw_notes.strip()) < 10:
        raise HTTPException(status_code=400, detail="Notes are too short to evaluate.")

    # Pre-check credits
    await AICreditsService.check_credits_available(db, current_user.organization_id, "interview_evaluation")

    result = await ai_evaluator.evaluate_interview_notes(
        raw_notes, 
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="AI evaluation failed. Please try again or check your Gemini API key.")

    return APIResponse.success(message="Interview notes evaluated successfully.", data=result)
@router.post("/generate-jd")
async def generate_jd(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    prompt: str = Body(..., embed=True)
):
    """
    Generate a full Job Description from a short user prompt.
    """
    if not prompt or len(prompt.strip()) < 2:
        raise HTTPException(status_code=400, detail="Prompt is too short to generate a JD. Must be at least 2 characters.")

    # Pre-check credits
    await AICreditsService.check_credits_available(db, current_user.organization_id, "jd_generation")

    logger.debug("Generating JD for prompt: %.50s...", prompt)
    result, error_detail = await ai_evaluator.generate_jd_from_prompt(
        prompt,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    if not result:
        logger.warning("JD generation failed: %s", error_detail)
        raise HTTPException(status_code=500, detail=f"AI JD generation failed: {error_detail or 'Check Gemini API key.'}")

    logger.debug("JD generation successful")
    return APIResponse.success(message="Job description generated successfully.", data=result)
    
@router.get("/test-gemini")
async def test_gemini():
    from app.core.config import settings
    import google.generativeai as genai
    
    status = {
        "key_present": bool(settings.gemini_api_key),
        "key_prefix_ok": settings.gemini_api_key.startswith("AIza") if settings.gemini_api_key else False,
        "error": None
    }
    
    try:
        if not settings.gemini_api_key:
            return {"status": "error", "message": "Key missing in settings"}
            
        genai.configure(api_key=settings.gemini_api_key)
        
        # Get list of models
        models = []
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                models.append(m.name)
        
        # Try a very basic model first
        test_model = 'gemini-1.5-flash' if 'models/gemini-1.5-flash' in models else (models[0] if models else 'gemini-pro')
        
        model = genai.GenerativeModel(test_model)
        response = await model.generate_content_async("Say hello")
        return {
            "status": "success", 
            "message": response.text, 
            "available_models": models,
            "tested_with": test_model,
            "diagnostics": status
        }
    except Exception as e:
        # If it fails, still return the models we found
        return {
            "status": "error", 
            "message": str(e), 
            "available_models": locals().get('models', []),
            "diagnostics": status
        }

@router.post("/generate-jd-pdf")
async def generate_jd_pdf_endpoint(
    current_user: Annotated[User, Depends(require_recruiter)],
    data: dict = Body(...)
):
    """
    Generate a professional JD PDF from the provided data.
    """
    try:
        pdf_bytes = await jd_pdf_generator.generate_jd_pdf(data)
        
        filename = f"JD_{data.get('title', 'Job')}.pdf".replace(" ", "_")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate PDF: {str(e)}")


@router.post("/generate-linkedin-post")
async def generate_linkedin_post(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    data: dict = Body(...)
):
    """
    Generate an engaging LinkedIn post (content + hashtags) for a job opening.
    """
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Job title is required.")

    # Pre-check credits
    await AICreditsService.check_credits_available(db, current_user.organization_id, "linkedin_post_generation")

    result = await ai_evaluator.generate_linkedin_post(
        data,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )

    if not result:
        raise HTTPException(status_code=500, detail="AI LinkedIn post generation failed. Please check your API key.")

    return APIResponse.success(message="LinkedIn post generated successfully.", data=result)
@router.post("/generate-image-prompt")
async def generate_image_prompt(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    data: dict = Body(...)
):
    """
    Generate a high-quality image prompt for LinkedIn based on job details.
    """
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Job title is required.")

    # Pre-check credits
    await AICreditsService.check_credits_available(db, current_user.organization_id, "image_prompt_generation")

    result = await ai_evaluator.generate_image_prompt(
        data,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )

    if not result:
        raise HTTPException(status_code=500, detail="AI image prompt generation failed.")

    return APIResponse.success(message="Image prompt generated successfully.", data={"prompt": result})
@router.post("/generate-image")
async def generate_image(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    prompt: str = Body(..., embed=True)
):
    """
    Generate an image from a prompt using the configured AI service (Hugging Face).
    """
    if not prompt or len(prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt is too short.")

    # Pre-check credits
    await AICreditsService.check_credits_available(db, current_user.organization_id, "image_generation")

    result = await ai_evaluator.generate_image_hf(
        prompt,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )

    if not result or "error" in result:
        status_code = 500
        if result.get("error") == "warming_up":
            status_code = 503
        elif result.get("error") == "no_key":
            status_code = 401
            
        raise HTTPException(
            status_code=status_code, 
            detail=result.get("detail", "AI image generation failed.")
        )

    return APIResponse.success(message="Image generated successfully.", data={"image_base64": result.get("image_base64")})


@router.get("/health-check")
async def ai_health_check(current_user: Annotated[User, Depends(require_recruiter)]):
    """Diagnose AI provider availability from production server."""
    from app.core.config import settings
    result = {}
    
    # Check Gemini key
    result["gemini_key_configured"] = bool(settings.gemini_api_key)
    
    # Check Groq key
    result["groq_key_configured"] = bool(settings.groq_api_key)
    
    # Test Groq connectivity
    if settings.groq_api_key:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get("https://api.groq.com")
            result["groq_reachable"] = True
            result["groq_status"] = r.status_code
        except Exception as e:
            result["groq_reachable"] = False
            result["groq_error"] = str(e)
    
    return APIResponse.success(message="AI diagnostics complete.", data=result)


def _warning_level(org_credits) -> str:
    if org_credits.warning_0_sent:
        return "critical"
    if org_credits.warning_5_sent:
        return "danger"
    if org_credits.warning_10_sent:
        return "warning"
    if org_credits.warning_25_sent:
        return "low"
    return "info"


@router.get("/credits/balance")
async def get_credits_balance(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)]
):
    """The organization's pool (monthly allowance + purchased top-ups), the
    caller's own monthly/daily limit, and the top-up packs on offer."""
    org_credits = await AICreditsService.get_or_create_org_credits(db, current_user.organization_id)
    monthly_remaining = max(0, org_credits.allowed_credits - org_credits.used_credits)
    purchased = max(0, org_credits.purchased_credits or 0)

    mine = None
    row = await AICreditsService.get_or_create_user_credits(db, current_user.organization_id, current_user.id)
    if row is not None:
        mine = {
            "monthly_limit": row.monthly_limit,
            "used_credits": row.used_credits,
            "remaining_credits": max(0, row.monthly_limit - row.used_credits),
            "daily_limit": daily_limit_for(row.monthly_limit),
            "daily_used": AICreditsService.user_daily_used(row),
        }
    await db.commit()

    return APIResponse.success(
        message="Credits balance retrieved successfully.",
        data={
            "allowed_credits": org_credits.allowed_credits,
            "used_credits": org_credits.used_credits,
            "monthly_remaining": monthly_remaining,
            "purchased_credits": purchased,
            "remaining_credits": monthly_remaining + purchased,
            "reset_at": org_credits.reset_at,
            "warning_level": _warning_level(org_credits),
            "my": mine,
            "credit_price_usd": ai_pricing.CREDIT_PRICE_USD,
            "topup_packs": [{"credits": c, "price_usd": p} for c, p in TOPUP_PACKS],
        }
    )

from sqlalchemy import select
from sqlalchemy import func
from app.models.ai_usage import AIUsage

@router.get("/credits/history")
async def get_credits_history(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)],
    page: int = 1,
    limit: int = 10
):
    """
    Get paginated AI usage/credits consumption history.
    """
    offset = (page - 1) * limit
    
    # Total count query
    count_query = select(func.count(AIUsage.id)).where(AIUsage.organization_id == current_user.organization_id)
    count_res = await db.execute(count_query)
    total = count_res.scalar() or 0
    
    # Usage logs query joining User
    query = (
        select(AIUsage, User.full_name, User.email)
        .outerjoin(User, AIUsage.user_id == User.id)
        .where(AIUsage.organization_id == current_user.organization_id)
        .order_by(AIUsage.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    rows = result.all()
    
    history_list = []
    for usage, name, email in rows:
        history_list.append({
            "id": str(usage.id),
            "provider": usage.provider,
            "model": usage.model,
            "feature": usage.feature,
            "prompt_tokens": usage.prompt_tokens,
            "completion_tokens": usage.completion_tokens,
            "total_tokens": usage.total_tokens,
            "credits_used": usage.credits_used,
            "cost": float(usage.cost or 0.0),
            "duration_ms": usage.duration_ms,
            "status": usage.status,
            "error_detail": usage.error_detail,
            "created_at": usage.created_at,
            "user_name": name or "System",
            "user_email": email or ""
        })
        
    return APIResponse.success(
        message="Usage history retrieved successfully.",
        data={
            "items": history_list,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit
        }
    )

@router.get("/credits/usage-by-feature")
async def get_usage_by_feature(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)]
):
    """
    Get credit usage aggregated by feature for charts.
    """
    query = (
        select(AIUsage.feature, func.sum(AIUsage.credits_used))
        .where(AIUsage.organization_id == current_user.organization_id)
        .where(AIUsage.status == "success")
        .group_by(AIUsage.feature)
    )
    result = await db.execute(query)
    rows = result.all()
    
    data = {}
    for feature, total_credits in rows:
        data[feature] = total_credits or 0
        
    return APIResponse.success(
        message="Usage by feature retrieved successfully.",
        data=data
    )

@router.get("/credits/usage-over-time")
async def get_usage_over_time(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)]
):
    """
    Get daily credit usage over time for charts.
    """
    query = (
        select(func.date(AIUsage.created_at), func.sum(AIUsage.credits_used))
        .where(AIUsage.organization_id == current_user.organization_id)
        .where(AIUsage.status == "success")
        .group_by(func.date(AIUsage.created_at))
        .order_by(func.date(AIUsage.created_at).asc())
    )
    result = await db.execute(query)
    rows = result.all()
    
    data = []
    for dt, total_credits in rows:
        data.append({
            "date": str(dt),
            "credits": total_credits or 0
        })
        
    return APIResponse.success(
        message="Usage over time retrieved successfully.",
        data=data
    )

@router.post("/credits/buy")
async def buy_credits(current_user: Annotated[User, Depends(require_recruiter)]):
    """Retired: this used to add any amount of credits for free. Top-ups are
    requested with /credits/request-topup and added by Hybent once paid."""
    raise HTTPException(
        status_code=410,
        detail="Credits can't be added from here. Ask your admin to request a top-up.",
    )


@router.post("/credits/request-topup")
async def request_topup(
    db: DB,
    current_user: Annotated[User, Depends(require_admin)],
    payload: dict = Body(...),
):
    """Admin asks Hybent for a top-up pack; the team invoices and adds it."""
    credits = payload.get("credits")
    pack = next(((c, p) for c, p in TOPUP_PACKS if c == credits), None)
    if pack is None:
        raise HTTPException(status_code=400, detail="Choose one of the available top-up packs.")

    org = await db.get(Organization, current_user.organization_id)
    org_name = org.name if org else str(current_user.organization_id)
    body = (
        f"<p><b>{html.escape(org_name)}</b> requested an AI credit top-up.</p>"
        f"<p>Pack: {pack[0]:,} credits (${pack[1]:,.2f})<br/>"
        f"Requested by: {html.escape(current_user.full_name or '')} &lt;{html.escape(current_user.email)}&gt;<br/>"
        f"Organization ID: {current_user.organization_id}</p>"
        "<p>Add the credits from the super-admin panel once payment is received.</p>"
    )
    sent = await asyncio.to_thread(
        send_email, TOPUP_REQUEST_EMAIL, f"AI credit top-up request: {org_name} ({pack[0]:,} credits)", body
    )
    if not sent:
        raise HTTPException(status_code=502, detail="We couldn't send your request. Please email info@hybent.com.")

    return APIResponse.success(
        message="Top-up requested. The Hybent team will contact you to complete it.",
        data={"credits": pack[0], "price_usd": pack[1]},
    )


# Seats that use AI and have a credit limit.
STAFF_ROLES = ("admin", "recruiter")


@router.get("/credits/users")
async def list_user_credit_limits(
    db: DB,
    current_user: Annotated[User, Depends(require_admin)],
):
    """Every staff member's monthly AI credit limit and usage this period."""
    users = (await db.execute(
        select(User)
        .where(User.organization_id == current_user.organization_id)
        .where(User.role.in_(STAFF_ROLES))
        .where(User.is_active.is_(True))
        .order_by(User.full_name)
    )).scalars().all()
    org_credits = await AICreditsService.get_or_create_org_credits(db, current_user.organization_id)

    items = []
    for u in users:
        row = await AICreditsService.get_or_create_user_credits(db, current_user.organization_id, u.id)
        if row is None:
            continue
        items.append({
            "user_id": str(u.id),
            "full_name": u.full_name,
            "email": u.email,
            "role": getattr(u.role, "value", u.role),
            "monthly_limit": row.monthly_limit,
            "used_credits": row.used_credits,
            "daily_limit": daily_limit_for(row.monthly_limit),
            "daily_used": AICreditsService.user_daily_used(row),
        })
    await db.commit()

    return APIResponse.success(
        message="User credit limits retrieved.",
        data={
            "items": items,
            "allocated": sum(i["monthly_limit"] for i in items),
            "pool": org_credits.allowed_credits + max(0, org_credits.purchased_credits or 0),
        },
    )


@router.put("/credits/users/{user_id}")
async def set_user_credit_limit(
    user_id: uuid.UUID,
    db: DB,
    current_user: Annotated[User, Depends(require_admin)],
    payload: dict = Body(...),
):
    """Set one user's monthly limit. Raising a limit can't take the total
    past the organization's pool; lowering one is always allowed."""
    limit = payload.get("monthly_limit")
    if not isinstance(limit, int) or isinstance(limit, bool) or limit < 0:
        raise HTTPException(status_code=400, detail="monthly_limit must be a whole number of credits (0 or more).")

    target = await db.get(User, user_id)
    if not target or target.organization_id != current_user.organization_id:
        raise HTTPException(status_code=404, detail="User not found")
    row = await AICreditsService.get_or_create_user_credits(db, current_user.organization_id, user_id)
    if row is None:
        raise HTTPException(status_code=400, detail="This user has no personal AI credit limit.")

    org_credits = await AICreditsService.get_or_create_org_credits(db, current_user.organization_id)
    pool = org_credits.allowed_credits + max(0, org_credits.purchased_credits or 0)
    others = (await db.execute(
        select(func.coalesce(func.sum(UserAICredits.monthly_limit), 0))
        .join(User, User.id == UserAICredits.user_id)
        .where(UserAICredits.organization_id == current_user.organization_id)
        .where(UserAICredits.user_id != user_id)
        .where(User.is_active.is_(True))
        .where(User.role.in_(STAFF_ROLES))
    )).scalar() or 0
    # Default limits can add up to more than the pool (large teams); any
    # change that doesn't raise the total is still allowed.
    if others + limit > pool and limit > row.monthly_limit:
        raise HTTPException(
            status_code=400,
            detail=f"That would allocate {others + limit:,} credits, more than the organization's {pool:,}. "
                   f"The most you can give this user is {max(0, pool - others):,}.",
        )

    row.monthly_limit = limit
    await db.commit()
    clear_blocked(user_id=user_id)
    return APIResponse.success(
        message="Credit limit updated.",
        data={"user_id": str(user_id), "monthly_limit": limit, "daily_limit": daily_limit_for(limit)},
    )
