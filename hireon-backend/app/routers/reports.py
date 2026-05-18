from fastapi import APIRouter, Depends, Response
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.services import report_service
from app.utils.permissions import UserRole
from app.schemas.response import APIResponse

router = APIRouter(prefix="/v1/reports", tags=["reports"])

@router.get("/summary")
async def get_summary(
    current_user: RecruiterUser,
    db: DB,
    recruiter_id: str | None = None,
    days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
):
    is_admin = current_user.role == UserRole.ADMIN
    return APIResponse.success(
        message="Report summary retrieved successfully.",
        data=await report_service.get_report_summary(
            current_user.organization_id,
            current_user.id,
            is_admin,
            db,
            recruiter_id=recruiter_id,
            days=days,
            start_date=start_date,
            end_date=end_date,
        )
    )

@router.get("/export")
async def export_report(
    current_user: RecruiterUser, 
    db: DB,
    days: int | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    recruiter_id: str | None = None
):
    is_admin = current_user.role == UserRole.ADMIN
    data = await report_service.export_report_excel(
        current_user.organization_id, 
        current_user.id, 
        is_admin, 
        db,
        days=days,
        start_date=start_date,
        end_date=end_date,
        recruiter_id=recruiter_id
    )
    
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=recruitment_report.xlsx"
        }
    )
