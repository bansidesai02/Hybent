"""
Bulk Import API Routes
"""

import uuid
import os
import tempfile
import aiofiles
import csv
import io
from datetime import datetime, timezone
from fastapi import APIRouter, File, UploadFile, Query, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import DB, RecruiterUser
from app.schemas.bulk_import import (
    UploadResponseSchema,
    SheetInfoSchema,
    BulkImportResultSchema,
    ImportBatchSummarySchema,
    ImportBatchDetailSchema,
)
from app.services.bulk_import_service import BulkImportService
from app.schemas.response import APIResponse
from app.config import settings
from app.models.import_batch import ImportBatch
from app.models.user import User
from app.models.candidate import Candidate
from app.utils.json_sanitize import sanitize_json_data
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/bulk-import", tags=["bulk-import"])

# Temporary storage for uploaded files
UPLOAD_TEMP_DIR = tempfile.gettempdir()
MAX_UPLOAD_SIZE_BYTES = 50 * 1024 * 1024


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: RecruiterUser = None,
    db: DB = None,
):
    """
    Upload Excel or CSV file and detect sheets
    
    Returns:
        - file_id: Temporary file ID
        - sheets: List of detected sheets with row counts
        - file_name: Original file name
    """
    try:
        logger.info(
            "Bulk import upload request started: filename=%s content_type=%s user_id=%s org_id=%s",
            file.filename,
            file.content_type,
            getattr(current_user, "id", None),
            getattr(current_user, "organization_id", None),
        )
        # Validate file type
        file_name = file.filename or "upload"
        file_name_lower = file_name.lower()
        if not (file_name_lower.endswith('.xlsx') or file_name_lower.endswith('.csv')):
            raise HTTPException(
                status_code=400,
                detail="Only .xlsx and .csv files are supported"
            )
        
        file_id = str(uuid.uuid4())
        ext = ".xlsx" if file_name_lower.endswith(".xlsx") else ".csv"
        
        # Write chunks to a temp file first to count size and run sheet detection
        temp_file_path = os.path.join(UPLOAD_TEMP_DIR, f"bulk_import_{file_id}{ext}")
        file_size = 0
        try:
            async with aiofiles.open(temp_file_path, "wb") as out_file:
                while True:
                    chunk = await file.read(1024 * 1024)
                    if not chunk:
                        break
                    file_size += len(chunk)
                    if file_size > MAX_UPLOAD_SIZE_BYTES:
                        raise HTTPException(
                            status_code=413,
                            detail="File size exceeds 50MB limit"
                        )
                    await out_file.write(chunk)
        except Exception as e:
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
            raise e

        # Read the file content bytes
        try:
            async with aiofiles.open(temp_file_path, "rb") as f:
                file_content_bytes = await f.read()
        except Exception as e:
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
            raise HTTPException(
                status_code=500,
                detail=f"Failed to read uploaded file: {str(e)}"
            )

        # Detect sheets
        try:
            sheets_info = BulkImportService.detect_sheets(temp_file_path)
            sheets = [SheetInfoSchema(name=s.name, row_count=s.row_count) for s in sheets_info]
        except Exception as e:
            logger.error(f"Error detecting sheets: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to read file: {str(e)}"
            )
        finally:
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass

        # Create immediate ImportBatch record to hold the state
        batch = ImportBatch(
            id=uuid.UUID(file_id),
            organization_id=current_user.organization_id,
            imported_by_id=current_user.id,
            file_name=file_name,
            file_path=None,
            selected_panels=[s.name for s in sheets_info],
            total_rows=sum(s.row_count for s in sheets_info),
            status="uploaded",
            file_content=file_content_bytes,
        )
        db.add(batch)
        await db.commit()
        
        return APIResponse.success(
            message="File uploaded successfully. Detected sheets above.",
            data=UploadResponseSchema(
                file_id=file_id,
                file_name=file_name,
                file_size=file_size,
                sheets=sheets,
                message="File uploaded successfully. Detected sheets above."
            ),
        )
    
    except HTTPException as e:
        logger.warning("Bulk import upload rejected: %s", e.detail)
        raise e
    except Exception as e:
        logger.error(f"Upload error: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/preview")
async def preview_sheet(
    file_id: str = Query(...),
    sheet_name: str | None = Query(None),
    import_all_sheets: bool = Query(False),
    current_user: RecruiterUser = None,
    db: DB = None,
):
    """
    Preview data from a sheet before import
    
    Args:
        file_id: File ID from upload
        sheet_name: Sheet name to preview (required for Excel)
    
    Returns:
        - total_rows: Total rows in sheet
        - preview_rows: First 10 rows with parsed data
        - column_mapping: Mapping of columns to database fields
        - has_errors: Whether any preview rows have errors
    """
    try:
        # Fetch the batch record
        batch = (
            await db.execute(
                select(ImportBatch).where(
                    ImportBatch.id == uuid.UUID(file_id),
                    ImportBatch.organization_id == current_user.organization_id,
                )
            )
        ).scalar_one_or_none()
        
        if not batch or not batch.file_content:
            raise HTTPException(
                status_code=404,
                detail="Uploaded file not found or expired. Please upload again."
            )
        
        ext = ".xlsx" if batch.file_name.lower().endswith(".xlsx") else ".csv"
        temp_file_path = os.path.join(UPLOAD_TEMP_DIR, f"preview_{file_id}{ext}")
        
        # Write bytes from database to a temporary file
        async with aiofiles.open(temp_file_path, "wb") as f:
            await f.write(batch.file_content)
        
        # Preview data
        try:
            if import_all_sheets:
                preview_data = BulkImportService.preview_all_sheets_data(
                    temp_file_path,
                    preview_rows_per_sheet=5
                )
            else:
                preview_data = BulkImportService.preview_sheet_data(
                    temp_file_path,
                    sheet_name=sheet_name,
                    preview_rows=10
                )
            preview_data = sanitize_json_data(preview_data)
            
            return APIResponse.success(
                message="Preview loaded successfully.",
                data=preview_data,
            )
        except Exception as e:
            logger.error(f"Preview error: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to preview data: {str(e)}"
            )
        finally:
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Preview error: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


@router.post("/execute")
async def execute_import(
    file_id: str = Query(...),
    sheet_name: str | None = Query(None),
    import_all_sheets: bool = Query(False),
    current_user: RecruiterUser = None,
    db: DB = None,
):
    """
    Execute bulk import of candidates
    
    Args:
        file_id: File ID from upload
        sheet_name: Sheet name to import (required for Excel)
    
    Returns:
        - created_count: Number of candidates created
        - skipped_count: Number of duplicates skipped
        - error_count: Number of invalid records
        - preview_data: Sample of created candidates
        - duplicates: List of duplicate records
        - invalid_rows: List of invalid records with errors
        - errors: List of general errors
    """
    try:
        # Fetch the batch record
        batch = (
            await db.execute(
                select(ImportBatch).where(
                    ImportBatch.id == uuid.UUID(file_id),
                    ImportBatch.organization_id == current_user.organization_id,
                )
            )
        ).scalar_one_or_none()
        
        if not batch or not batch.file_content:
            raise HTTPException(
                status_code=404,
                detail="Uploaded file not found or expired. Please upload again."
            )
        
        ext = ".xlsx" if batch.file_name.lower().endswith(".xlsx") else ".csv"
        temp_file_path = os.path.join(UPLOAD_TEMP_DIR, f"execute_{file_id}{ext}")
        
        # Write bytes from database to a temporary file
        async with aiofiles.open(temp_file_path, "wb") as f:
            await f.write(batch.file_content)
        
        # Execute import
        try:
            if import_all_sheets:
                result = await BulkImportService.bulk_import_all_sheets(
                    temp_file_path,
                    current_user.organization_id,
                    current_user.id,
                    db,
                    auto_commit=False,
                )
            else:
                result = await BulkImportService.bulk_import_sheet(
                    temp_file_path,
                    sheet_name,
                    current_user.organization_id,
                    current_user.id,
                    db,
                    auto_commit=False,
                )
            
            selected_panels = (
                batch.selected_panels
                if import_all_sheets
                else ([sheet_name] if sheet_name else [])
            )
            
            batch.selected_panels = selected_panels
            batch.total_rows = result.total_rows
            batch.success_count = result.created_count
            batch.failed_count = result.error_count
            batch.duplicate_count = result.skipped_count
            batch.status = "completed"
            batch.failure_details = {
                "errors": sanitize_json_data(result.errors),
                "invalid_rows": sanitize_json_data(result.invalid_rows),
                "duplicates": sanitize_json_data(result.duplicates),
            }
            
            imported_at = datetime.now(timezone.utc)
            # Link newly created candidates to batch in a single update
            if result.imported_candidates:
                await db.execute(
                    Candidate.__table__.update()
                    .where(Candidate.id.in_([uuid.UUID(cid) for cid in result.imported_candidates]))
                    .values(
                        import_batch_id=batch.id,
                        imported_by_id=current_user.id,
                        imported_at=imported_at,
                    )
                )
            await db.commit()
            result.import_batch_id = str(batch.id)
            safe_errors = sanitize_json_data(result.errors)
            safe_duplicates = sanitize_json_data(result.duplicates)
            safe_invalid_rows = sanitize_json_data(result.invalid_rows)
            safe_preview_data = sanitize_json_data(result.preview_data)
            
            return APIResponse.success(
                message=f"Import completed. Created: {result.created_count}, Skipped: {result.skipped_count}, Errors: {result.error_count}",
                data=BulkImportResultSchema(
                    created_count=result.created_count,
                    skipped_count=result.skipped_count,
                    error_count=result.error_count,
                    errors=safe_errors,
                    duplicates=safe_duplicates,
                    invalid_rows=safe_invalid_rows,
                    preview_data=safe_preview_data,
                    imported_candidates=result.imported_candidates,
                    import_batch_id=result.import_batch_id,
                ),
            )
        except Exception as e:
            await db.rollback()
            logger.error(f"Import execution error: {e}")
            raise HTTPException(
                status_code=400,
                detail=f"Import failed: {str(e)}"
            )
        finally:
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass
    
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )


def _resolve_temp_file(file_id: str) -> str:
    if file_id in UPLOAD_FILE_INDEX and os.path.exists(UPLOAD_FILE_INDEX[file_id]["path"]):
        return UPLOAD_FILE_INDEX[file_id]["path"]
    candidates = [
        os.path.join(BULK_IMPORT_DIR, f"bulk_import_{file_id}.xlsx"),
        os.path.join(BULK_IMPORT_DIR, f"bulk_import_{file_id}.csv"),
        os.path.join(UPLOAD_TEMP_DIR, f"bulk_import_{file_id}.xlsx"),
        os.path.join(UPLOAD_TEMP_DIR, f"bulk_import_{file_id}.csv"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return os.path.join(BULK_IMPORT_DIR, f"bulk_import_{file_id}.xlsx")


@router.get("/history")
async def list_import_history(
    current_user: RecruiterUser,
    db: DB,
    search: str | None = Query(None),
    status: str | None = Query(None),
):
    query = (
        select(ImportBatch)
        .where(ImportBatch.organization_id == current_user.organization_id)
        .options(selectinload(ImportBatch.candidates))
        .order_by(ImportBatch.created_at.desc())
    )
    if search:
        query = query.where(ImportBatch.file_name.ilike(f"%{search}%"))
    if status:
        query = query.where(ImportBatch.status == status)

    batches = (await db.execute(query)).scalars().all()
    user_ids = [b.imported_by_id for b in batches if b.imported_by_id]
    user_map: dict[str, str] = {}
    if user_ids:
        users = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
        user_map = {str(u.id): u.full_name for u in users}

    data = [
        ImportBatchSummarySchema(
            id=str(b.id),
            file_name=b.file_name,
            selected_panels=b.selected_panels or [],
            total_rows=b.total_rows,
            success_count=b.success_count,
            failed_count=b.failed_count,
            duplicate_count=b.duplicate_count,
            status=b.status,
            imported_by_name=user_map.get(str(b.imported_by_id)) if b.imported_by_id else None,
            created_at=b.created_at,
        )
        for b in batches
    ]
    return APIResponse.success(message="Import history fetched.", data=data)


@router.get("/history/{batch_id}")
async def get_import_history_detail(
    batch_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    batch = (
        await db.execute(
            select(ImportBatch).where(
                ImportBatch.id == batch_id,
                ImportBatch.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")

    user_name = None
    if batch.imported_by_id:
        user = (await db.execute(select(User).where(User.id == batch.imported_by_id))).scalar_one_or_none()
        user_name = user.full_name if user else None

    detail = ImportBatchDetailSchema(
        id=str(batch.id),
        file_name=batch.file_name,
        selected_panels=batch.selected_panels or [],
        total_rows=batch.total_rows,
        success_count=batch.success_count,
        failed_count=batch.failed_count,
        duplicate_count=batch.duplicate_count,
        status=batch.status,
        imported_by_name=user_name,
        created_at=batch.created_at,
        failure_details=sanitize_json_data(batch.failure_details),
        candidates=[],
    )
    candidates = (
        await db.execute(
            select(Candidate).where(
                Candidate.organization_id == current_user.organization_id,
                Candidate.import_batch_id == batch_id,
            ).order_by(Candidate.created_at.asc())
        )
    ).scalars().all()
    detail.candidates = [
        {
            "id": str(c.id),
            "full_name": c.full_name,
            "email": c.email,
            "phone": c.phone,
            "import_panel_name": c.import_panel_name,
            "imported_at": c.imported_at.isoformat() if c.imported_at else None,
        }
        for c in candidates
    ]
    return APIResponse.success(message="Import batch detail fetched.", data=detail)


@router.post("/history/{batch_id}/rollback")
async def rollback_import_batch(
    batch_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    batch = (
        await db.execute(
            select(ImportBatch).where(
                ImportBatch.id == batch_id,
                ImportBatch.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    if batch.status == "rolled_back":
        raise HTTPException(status_code=400, detail="Batch already rolled back")

    candidates = (
        await db.execute(
            select(Candidate).where(
                Candidate.organization_id == current_user.organization_id,
                Candidate.import_batch_id == batch_id,
            )
        )
    ).scalars().all()
    deleted_count = len(candidates)
    for candidate in candidates:
        await db.delete(candidate)

    batch.status = "rolled_back"
    batch.deleted_at = datetime.now(timezone.utc)
    batch.deleted_by_id = current_user.id
    await db.commit()

    return APIResponse.success(
        message=f"Rolled back import batch successfully. Deleted {deleted_count} imported candidates.",
        data={"batch_id": str(batch_id), "deleted_count": deleted_count},
    )


@router.get("/history/{batch_id}/failed-rows")
async def download_failed_rows(
    batch_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    batch = (
        await db.execute(
            select(ImportBatch).where(
                ImportBatch.id == batch_id,
                ImportBatch.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")

    failure_details = batch.failure_details or {}
    invalid_rows = failure_details.get("invalid_rows", [])
    duplicates = failure_details.get("duplicates", [])
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["type", "row_number", "email", "full_name", "errors"])
    for row in invalid_rows:
        writer.writerow(["invalid", row.get("row_number"), "", "", "; ".join(row.get("errors", []))])
    for dup in duplicates:
        writer.writerow(["duplicate", dup.get("row_number"), dup.get("email", ""), dup.get("full_name", ""), "Duplicate"])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=import_{batch_id}_failed_rows.csv"},
    )


@router.get("/history/{batch_id}/original-file")
async def download_original_file(
    batch_id: uuid.UUID,
    current_user: RecruiterUser,
    db: DB,
):
    batch = (
        await db.execute(
            select(ImportBatch).where(
                ImportBatch.id == batch_id,
                ImportBatch.organization_id == current_user.organization_id,
            )
        )
    ).scalar_one_or_none()
    if not batch:
        raise HTTPException(status_code=404, detail="Import batch not found")
    if not batch.file_content:
        raise HTTPException(status_code=404, detail="Original file is no longer available")
    return StreamingResponse(
        io.BytesIO(batch.file_content),
        media_type="application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename={batch.file_name}"},
    )
