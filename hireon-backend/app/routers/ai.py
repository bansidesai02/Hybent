from fastapi import APIRouter, HTTPException, Body, Depends, Response, BackgroundTasks
from app.dependencies import DB, InterviewerUser, RecruiterUser
from app.services import ai_evaluator, jd_pdf_generator
from app.schemas.response import APIResponse
from typing import List, Optional

router = APIRouter(prefix="/v1/ai", tags=["ai"])

@router.post("/evaluate-notes")
async def evaluate_notes(
    current_user: InterviewerUser,
    background_tasks: BackgroundTasks,
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
    current_user: RecruiterUser,
    background_tasks: BackgroundTasks,
    prompt: str = Body(..., embed=True)
):
    """
    Generate a full Job Description from a short user prompt.
    """
    if not prompt or len(prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt is too short to generate a JD.")

    result = await ai_evaluator.generate_jd_from_prompt(
        prompt,
        background_tasks=background_tasks,
        user_id=current_user.id,
        organization_id=current_user.organization_id
    )
    
    if not result:
        raise HTTPException(status_code=500, detail="AI JD generation failed. Please try again or check your Gemini API key.")

    return APIResponse.success(message="Job description generated successfully.", data=result)

@router.post("/generate-jd-pdf")
async def generate_jd_pdf_endpoint(
    data: dict = Body(...),
    current_user: RecruiterUser = None
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
    current_user: RecruiterUser,
    background_tasks: BackgroundTasks,
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
    current_user: RecruiterUser,
    background_tasks: BackgroundTasks,
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
    current_user: RecruiterUser,
    background_tasks: BackgroundTasks,
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
