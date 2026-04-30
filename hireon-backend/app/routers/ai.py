from fastapi import APIRouter, HTTPException, Body, Depends, Response, BackgroundTasks
from app.dependencies import DB, require_recruiter, require_interviewer_or_above
from app.services import ai_evaluator, jd_pdf_generator
from app.schemas.response import APIResponse
from app.models.user import User
from typing import List, Optional, Annotated

router = APIRouter(prefix="/v1/ai", tags=["ai"])

@router.post("/evaluate-notes")
async def evaluate_notes(
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_interviewer_or_above)],
    raw_notes: str = Body(..., embed=True)
):
    """
    Generate a structured evaluation from raw interview notes.
    """
    if not raw_notes or len(raw_notes.strip()) < 10:
        raise HTTPException(status_code=400, detail="Notes are too short to evaluate.")

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
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    prompt: str = Body(..., embed=True)
):
    """
    Generate a full Job Description from a short user prompt.
    """
    if not prompt or len(prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt is too short to generate a JD.")

    result, error_detail = await ai_evaluator.generate_jd_from_prompt(
        prompt,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    if not result:
        raise HTTPException(status_code=500, detail=f"AI JD generation failed: {error_detail or 'Check Gemini API key.'}")

    return APIResponse.success(message="Job description generated successfully.", data=result)
    
@router.get("/test-gemini")
async def test_gemini():
    from app.config import settings
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
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    data: dict = Body(...)
):
    """
    Generate an engaging LinkedIn post (content + hashtags) for a job opening.
    """
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Job title is required.")

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
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    data: dict = Body(...)
):
    """
    Generate a high-quality image prompt for LinkedIn based on job details.
    """
    if not data.get("title"):
        raise HTTPException(status_code=400, detail="Job title is required.")

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
    background_tasks: BackgroundTasks,
    current_user: Annotated[User, Depends(require_recruiter)],
    prompt: str = Body(..., embed=True)
):
    """
    Generate an image from a prompt using the configured AI service (Hugging Face).
    """
    if not prompt or len(prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt is too short.")

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
    from app.config import settings
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
