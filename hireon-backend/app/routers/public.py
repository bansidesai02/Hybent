from fastapi import APIRouter
from app.schemas.demo import DemoRequest
from app.services.email_service import send_demo_request_email
from app.schemas.response import APIResponse

router = APIRouter(prefix="/public", tags=["Public"])

@router.post("/demo-request")
async def demo_request(request: DemoRequest):
    """Handle public demo requests from the landing page."""
    try:
        send_demo_request_email(
            first_name=request.first_name,
            last_name=request.last_name,
            work_email=request.work_email,
            company_name=request.company_name,
            team_size=request.team_size,
            monthly_hires=request.monthly_hires,
            hiring_challenge=request.hiring_challenge
        )
        return APIResponse.success(message="Demo request submitted successfully. We will get back to you soon!")
    except Exception as e:
        return APIResponse.error(message=f"Failed to submit demo request: {str(e)}", status_code=500)
