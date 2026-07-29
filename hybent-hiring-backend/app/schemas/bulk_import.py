"""
Schemas for bulk import operations
"""

from pydantic import BaseModel
from typing import Any
from datetime import datetime


class SheetInfoSchema(BaseModel):
    """Information about a sheet"""
    name: str
    row_count: int


class ColumnMappingSchema(BaseModel):
    """Column to field mapping"""
    column_name: str
    field_name: str | None


class PreviewRowSchema(BaseModel):
    """A row from preview"""
    row_number: int
    raw_data: dict[str, Any]
    parsed_data: dict[str, Any]
    is_valid: bool
    errors: list[str] = []


class SheetPreviewSchema(BaseModel):
    """Preview of sheet data"""
    total_rows: int
    preview_rows: list[PreviewRowSchema]
    has_errors: bool
    column_mapping: dict[str, str | None]


class BulkImportRequestSchema(BaseModel):
    """Request to execute bulk import"""
    sheet_name: str | None = None
    import_all_sheets: bool = False


class DuplicateRecordSchema(BaseModel):
    """A duplicate record that was skipped"""
    row_number: int
    email: str
    full_name: str
    existing_id: str


class InvalidRowSchema(BaseModel):
    """An invalid row that was skipped"""
    row_number: int
    raw_data: dict[str, Any]
    errors: list[str]


class ImportErrorSchema(BaseModel):
    """An import error"""
    row_number: int | None = None
    message: str | None = None
    error: str | None = None


class PreviewCandidateSchema(BaseModel):
    """Preview of imported candidate"""
    id: str
    name: str
    email: str
    phone: str | None = None
    company: str | None = None
    experience: float | None = None


class BulkImportResultSchema(BaseModel):
    """Result of bulk import"""
    created_count: int
    skipped_count: int
    error_count: int
    errors: list[ImportErrorSchema] = []
    duplicates: list[DuplicateRecordSchema] = []
    invalid_rows: list[InvalidRowSchema] = []
    preview_data: list[PreviewCandidateSchema] = []
    imported_candidates: list[str] = []
    import_batch_id: str | None = None


class UploadResponseSchema(BaseModel):
    """Response after file upload"""
    file_id: str
    file_name: str
    file_size: int
    sheets: list[SheetInfoSchema]
    message: str


class ImportBatchSummarySchema(BaseModel):
    id: str
    file_name: str
    selected_panels: list[str]
    total_rows: int
    success_count: int
    failed_count: int
    duplicate_count: int
    status: str
    imported_by_name: str | None = None
    created_at: datetime


class ImportBatchDetailSchema(ImportBatchSummarySchema):
    failure_details: dict[str, Any] | None = None
    candidates: list[dict[str, Any]] = []
