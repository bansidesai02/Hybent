from fastapi import APIRouter, HTTPException, Body, Depends, Response
from app.dependencies import DB, InterviewerUser, RecruiterUser
from app.services import ai_evaluator, jd_pdf_generator
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/ai", tags=["ai"])

@router.post("/evaluate-notes")
async def evaluate_notes(
    current_user: InterviewerUser,
    raw_notes: str = Body(..., embed=True)
):
    """
    Generate a structured evaluation from raw interview notes.
    """
    if not raw_notes or len(raw_notes.strip()) < 10:
        raise HTTPException(status_code=400, detail="Notes are too short to evaluate.")

    result = await ai_evaluator.evaluate_interview_notes(raw_notes)
    
    if not result:
        raise HTTPException(status_code=500, detail="AI evaluation failed. Please try again or check your Gemini API key.")

    return APIResponse.success(message="Interview notes evaluated successfully.", data=result)
@router.post("/generate-jd")
async def generate_jd(
    current_user: RecruiterUser,
    prompt: str = Body(..., embed=True)
):
    """
    Generate a full Job Description from a short user prompt.
    """
    if not prompt or len(prompt.strip()) < 5:
        raise HTTPException(status_code=400, detail="Prompt is too short to generate a JD.")

    result = await ai_evaluator.generate_jd_from_prompt(prompt)
    
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
