from fastapi import APIRouter, HTTPException, Body, Depends, Response, BackgroundTasks
import logging
from app.dependencies import DB, require_recruiter, require_interviewer_or_above
from app.services import ai_evaluator, jd_pdf_generator
from app.services.ai_credit_service import AICreditsService
from app.schemas.response import APIResponse
from app.models.user import User
from typing import Annotated

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/ai", tags=["ai"])

@router.post("/evaluate-notes")
async def evaluate_notes(
    db: DB,
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_interviewer_or_above)],
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


@router.get("/credits/balance")
async def get_credits_balance(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)]
):
    """
    Get current credit balance, warning thresholds, and reset timestamp.
    """
    org_credits = await AICreditsService.get_or_create_org_credits(db, current_user.organization_id)
    remaining = max(0, org_credits.allowed_credits - org_credits.used_credits)
    
    # Calculate warning level
    warning_level = "info"
    if org_credits.warning_0_sent:
        warning_level = "critical"
    elif org_credits.warning_5_sent:
        warning_level = "danger"
    elif org_credits.warning_10_sent:
        warning_level = "warning"
    elif org_credits.warning_25_sent:
        warning_level = "low"
        
    return APIResponse.success(
        message="Credits balance retrieved successfully.",
        data={
            "allowed_credits": org_credits.allowed_credits,
            "used_credits": org_credits.used_credits,
            "remaining_credits": remaining,
            "reset_at": org_credits.reset_at,
            "warning_level": warning_level
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
async def buy_credits(
    db: DB,
    current_user: Annotated[User, Depends(require_recruiter)],
    payload: dict = Body(...)
):
    """
    Simulate purchasing additional credits.
    """
    amount = payload.get("amount")
    if not amount or not isinstance(amount, int) or amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid credits amount. Must be a positive integer.")
        
    org_credits = await AICreditsService.get_or_create_org_credits(db, current_user.organization_id)
    
    # Add credits
    org_credits.allowed_credits += amount
    
    # Clear warning flags
    org_credits.warning_0_sent = False
    org_credits.warning_5_sent = False
    org_credits.warning_10_sent = False
    org_credits.warning_25_sent = False
    org_credits.warning_50_sent = False
    
    db.add(org_credits)
    await db.commit()
    
    # Send purchase confirmation notification
    from app.tasks.notifications import notify_organization_roles
    notify_organization_roles.delay(
        str(current_user.organization_id),
        ["admin", "recruiter"],
        "system",
        "Credits Purchased Successfully",
        f"Your organization successfully purchased {amount:,} AI credits. New limit: {org_credits.allowed_credits:,} credits.",
        {"added_credits": amount, "new_allowed_credits": org_credits.allowed_credits}
    )
    
    return APIResponse.success(
        message=f"Successfully added {amount:,} credits to organization.",
        data={
            "allowed_credits": org_credits.allowed_credits,
            "used_credits": org_credits.used_credits,
            "remaining_credits": max(0, org_credits.allowed_credits - org_credits.used_credits)
        }
    )
