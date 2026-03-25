from fastapi import APIRouter, Depends, Response
from app.dependencies import DB, CurrentUser, RecruiterUser
from app.services import report_service
from app.utils.permissions import UserRole

router = APIRouter(prefix="/v1/reports", tags=["reports"])

@router.get("/summary")
async def get_summary(current_user: RecruiterUser, db: DB):
    is_admin = current_user.role == UserRole.ADMIN
    return await report_service.get_report_summary(
        current_user.organization_id, 
        current_user.id, 
        is_admin, 
        db
    )

@router.get("/export")
async def export_report(current_user: RecruiterUser, db: DB):
    is_admin = current_user.role == UserRole.ADMIN
    data = await report_service.export_report_excel(
        current_user.organization_id, 
        current_user.id, 
        is_admin, 
        db
    )
    
    return Response(
        content=data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": "attachment; filename=recruitment_report.xlsx"
        }
    )
