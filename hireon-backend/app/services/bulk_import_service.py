"""
Bulk Import Service for candidate data from CSV/Excel files
"""

import uuid
from datetime import datetime, timezone
from typing import Any
import pandas as pd
from openpyxl import load_workbook
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.candidate import Candidate
from app.models.application import Application
from app.models.import_batch import ImportBatch
from app.models.job import Job
from app.utils.permissions import ApplicationStage, JobStatus
from app.utils.json_sanitize import sanitize_json_data
import logging
import time

logger = logging.getLogger(__name__)

# Mapping of possible column names to database field names
COLUMN_MAPPING = {
    # Basic info
    'sr no.': 'sr_no',
    'sr no': 'sr_no',
    'serial no': 'sr_no',
    'date': 'import_row_date',
    'name': 'full_name',
    'full_name': 'full_name',
    'first_name': 'first_name',
    'last_name': 'last_name',
    'phone no.': 'phone',
    'phone no': 'phone',
    'phone': 'phone',
    'phone_number': 'phone',
    'contact': 'phone',
    'email_id': 'email',
    'email': 'email',
    'email_address': 'email',
    
    # Experience
    'experience': 'experience',
    'years_experience': 'years_experience',
    'years exp': 'years_experience',
    'exp': 'years_experience',
    'relevant experience': 'relevant_experience',
    'relevant_experience': 'relevant_experience',
    
    # Company info
    'current employer': 'current_company',
    'current_employer': 'current_company',
    'employer': 'current_company',
    'company': 'current_company',
    'current company': 'current_company',
    'current_company': 'current_company',
    
    # Location
    'current location': 'location',
    'current_location': 'location',
    'location': 'location',
    'city': 'location',
    
    # Salary
    'current salary': 'current_salary',
    'current_salary': 'current_salary',
    'ctc': 'current_salary',
    'expected': 'expected_salary',
    'expected salary': 'expected_salary',
    'expected_salary': 'expected_salary',
    'salary': 'expected_salary',
    
    # Notice period
    'notice period': 'notice_period_days',
    'notice_period': 'notice_period_days',
    'notice': 'notice_period_days',
    
    # Reference
    'reference': 'reference',
    'referred by': 'reference',
    'referral': 'reference',
    
    # HR related
    'hr': 'hr_name',
    'hr notes': 'remarks_hr',
    'hr_notes': 'remarks_hr',
    'hr remarks': 'remarks_hr',
    'remarks (hr)': 'remarks_hr',
    'remarks_hr': 'remarks_hr',
    
    # Status
    'status': 'import_status',
    
    # Technical
    'technical panel': 'technical_panel',
    'technical_panel': 'remarks_technical',
    'technical': 'remarks_technical',
    'remarks (technical)': 'remarks_technical',
    'remarks_technical': 'remarks_technical',
    'technical remarks': 'remarks_technical',
    
    # Practical
    'remarks (practical)': 'remarks_practical',
    'remarks_practical': 'remarks_practical',
    'practical remarks': 'remarks_practical',
    'practical': 'remarks_practical',
    
    # Techno functional
    'techno functional & hr interview': 'techno_functional_hr_interview',
    'techno_functional_hr_interview': 'techno_functional_hr_interview',
    'techno functional hr': 'techno_functional_hr_interview',
    'techno_functional': 'techno_functional_hr_interview',
}


class SheetInfo:
    """Information about a sheet in an Excel file"""
    def __init__(self, name: str, row_count: int):
        self.name = name
        self.row_count = row_count


class BulkImportResult:
    """Result of a bulk import operation"""
    def __init__(self):
        self.created_count = 0
        self.skipped_count = 0
        self.error_count = 0
        self.errors: list[dict[str, Any]] = []
        self.duplicates: list[dict[str, Any]] = []
        self.invalid_rows: list[dict[str, Any]] = []
        self.preview_data: list[dict[str, Any]] = []
        self.imported_candidates: list[str] = []
        self.import_batch_id: str | None = None
        self.total_rows: int = 0


class BulkImportService:
    """Service for handling bulk import operations"""

    IMPORT_CANDIDATES_DESIGNATION_TITLE = "Import Candidates"

    @staticmethod
    def _normalize_designation_title(title: str | None) -> str | None:
        if not title:
            return None
        cleaned = " ".join(str(title).strip().split())
        return cleaned or None

    @staticmethod
    async def _get_or_create_pool_job(
        db: AsyncSession,
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID | None,
        title: str,
        cache: dict[str, Job] | None = None,
    ) -> Job:
        """
        Designations in this project are represented as POOL jobs.
        This helper ensures we reuse an existing POOL job (case-insensitive),
        and only create it once if missing.
        """
        normalized = BulkImportService._normalize_designation_title(title)
        if not normalized:
            raise ValueError("Job title is required")
        key = normalized.lower()
        if cache is not None and key in cache:
            return cache[key]

        existing = (
            await db.execute(
                select(Job).where(
                    Job.organization_id == organization_id,
                    Job.status == JobStatus.POOL,
                    func.lower(Job.title) == key,
                )
            )
        ).scalar_one_or_none()
        if existing:
            if cache is not None:
                cache[key] = existing
            return existing

        job = Job(
            organization_id=organization_id,
            created_by_id=created_by_id,
            title=normalized,
            description=normalized,
            status=JobStatus.POOL,
            job_type="full_time",
            openings=0,
        )
        db.add(job)
        await db.flush()
        if cache is not None:
            cache[key] = job
        return job
    
    @staticmethod
    def detect_sheets(file_path: str) -> list[SheetInfo]:
        """
        Detect all sheet names and row counts in an Excel file
        
        Args:
            file_path: Path to Excel file
            
        Returns:
            List of SheetInfo objects
        """
        sheets = []
        try:
            lowered = file_path.lower()
            if lowered.endswith(".csv"):
                df = pd.read_csv(file_path)
                sheets.append(SheetInfo(name="CSV", row_count=len(df)))
                return sheets
            # Fast path: use openpyxl metadata in read-only mode.
            # Avoid reading full sheet data with pandas during upload stage.
            start = time.perf_counter()
            wb = load_workbook(filename=file_path, read_only=True, data_only=True)
            try:
                for ws in wb.worksheets:
                    row_count = BulkImportService._count_data_rows_in_worksheet(ws)
                    sheets.append(SheetInfo(name=ws.title, row_count=row_count))
            finally:
                wb.close()
            elapsed = (time.perf_counter() - start) * 1000
            logger.info("Detected %s sheets in %.1fms for file=%s", len(sheets), elapsed, file_path)
        except Exception as e:
            logger.error(f"Error detecting sheets: {e}")
            raise ValueError(f"Failed to detect sheets: {str(e)}")
        
        return sheets

    @staticmethod
    def _count_data_rows_in_worksheet(ws) -> int:
        """
        Count non-empty data rows in worksheet.
        Handles sparse sheets and offset headers by counting non-empty rows,
        then subtracting one header row if present.
        """
        # Fast path: use ws.max_row directly if available in openpyxl read-only mode.
        if hasattr(ws, "max_row") and ws.max_row is not None:
            return max(ws.max_row - 1, 0)

        non_empty_rows = 0
        for row in ws.iter_rows(values_only=True):
            if any(cell not in (None, "", " ") for cell in row):
                non_empty_rows += 1
        return max(non_empty_rows - 1, 0)
    
    @staticmethod
    def normalize_column_name(col_name: str) -> str:
        """Normalize column name for mapping"""
        return col_name.strip().lower()
    
    @staticmethod
    def get_field_name(column_name: str) -> str | None:
        """Get database field name from Excel column name"""
        normalized = BulkImportService.normalize_column_name(column_name)
        return COLUMN_MAPPING.get(normalized)
    
    @staticmethod
    def read_sheet_data(file_path: str, sheet_name: str | None = None) -> pd.DataFrame:
        """
        Read data from Excel or CSV file
        
        Args:
            file_path: Path to file
            sheet_name: Sheet name (for Excel) or None for CSV
            
        Returns:
            DataFrame with data
        """
        try:
            lowered = file_path.lower()
            if lowered.endswith('.csv'):
                df = pd.read_csv(file_path)
            elif lowered.endswith('.xlsx'):
                df = pd.read_excel(file_path, sheet_name=sheet_name)
            else:
                raise ValueError("Unsupported file format. Use .xlsx or .csv")
            
            # Convert NaN to None
            df = df.where(pd.notna(df), None)
            return df
        except Exception as e:
            logger.error(f"Error reading file: {e}")
            raise ValueError(f"Failed to read file: {str(e)}")
    
    @staticmethod
    def parse_row(row: dict[str, Any]) -> dict[str, Any]:
        """
        Parse a row from DataFrame to candidate data
        
        Args:
            row: Row data from DataFrame
            
        Returns:
            Parsed candidate data
        """
        parsed = {}
        
        # Map each column to database field
        for col_name, col_value in row.items():
            if col_value is None or (isinstance(col_value, float) and pd.isna(col_value)):
                continue
            
            field_name = BulkImportService.get_field_name(col_name)
            if field_name:
                parsed[field_name] = str(col_value).strip() if col_value else None
        
        return parsed
    
    @staticmethod
    def validate_candidate_data(data: dict[str, Any]) -> tuple[bool, list[str]]:
        """
        Validate candidate data
        
        Args:
            data: Candidate data to validate
            
        Returns:
            Tuple of (is_valid, error_messages)
        """
        errors = []
        
        # Check required fields
        email = data.get('email', '').strip() if data.get('email') else None
        full_name = data.get('full_name', '').strip() if data.get('full_name') else None
        
        if not email:
            errors.append("Email is required")
        elif '@' not in email:
            errors.append(f"Invalid email format: {email}")
        
        if not full_name:
            errors.append("Name is required")
        
        # Parse years of experience if present
        if 'years_experience' in data and data['years_experience']:
            try:
                years_str = data['years_experience'].strip()
                # Try to extract number from strings like "3.5", "3-4 years", etc.
                import re
                match = re.search(r'(\d+\.?\d*)', years_str)
                if match:
                    years_float = float(match.group(1))
                    data['years_experience'] = years_float
                else:
                    errors.append(f"Invalid experience format: {years_str}")
                    data.pop('years_experience', None)
            except Exception as e:
                errors.append(f"Error parsing experience: {str(e)}")
                data.pop('years_experience', None)
        
        return len(errors) == 0, errors
    
    @staticmethod
    async def check_duplicate(email: str, phone: str | None, organization_id: uuid.UUID, db: AsyncSession) -> Candidate | None:
        """
        Check if candidate already exists
        
        Args:
            email: Candidate email
            phone: Candidate phone (optional)
            organization_id: Organization ID
            db: Database session
            
        Returns:
            Existing candidate or None
        """
        # Check by email
        existing = (
            await db.execute(
                select(Candidate).where(
                    Candidate.organization_id == organization_id,
                    func.lower(Candidate.email) == email.lower().strip()
                )
            )
        ).scalar_one_or_none()
        
        if existing:
            return existing
        
        # Check by phone if provided
        if phone and phone.strip():
            existing = (
                await db.execute(
                    select(Candidate).where(
                        Candidate.organization_id == organization_id,
                        Candidate.phone == phone.strip()
                    )
                )
            ).scalar_one_or_none()
            if existing:
                return existing
        
        return None
    
    @staticmethod
    def create_candidate_from_data(
        data: dict[str, Any],
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID | None,
        panel_name: str | None = None,
        import_batch_id: uuid.UUID | None = None,
        imported_at: datetime | None = None,
    ) -> Candidate:
        """
        Create a Candidate instance from parsed data
        
        Args:
            data: Parsed candidate data
            organization_id: Organization ID
            created_by_id: User ID who is importing
            panel_name: Panel/sheet name where imported from
            
        Returns:
            Candidate instance (not saved)
        """
        candidate = Candidate(
            organization_id=organization_id,
            created_by_id=created_by_id,
            import_batch_id=import_batch_id,
            imported_by_id=created_by_id,
            imported_at=imported_at or datetime.now(timezone.utc),
            email=data.get('email', '').strip(),
            full_name=data.get('full_name', '').strip(),
            phone=data.get('phone'),
            location=data.get('location'),
            current_company=data.get('current_company'),
            current_title=data.get('current_title'),
            current_salary=data.get('current_salary'),
            expected_salary=data.get('expected_salary'),
            years_experience=data.get('years_experience'),
            relevant_experience=data.get('relevant_experience'),
            notice_period_days=data.get('notice_period_days'),
            reference=data.get('reference'),
            sr_no=data.get('sr_no'),
            import_row_date=data.get('import_row_date'),
            hr_name=data.get('hr_name'),
            technical_panel=data.get('technical_panel'),
            remarks_hr=data.get('remarks_hr'),
            remarks_technical=data.get('remarks_technical'),
            remarks_practical=data.get('remarks_practical'),
            techno_functional_hr_interview=data.get('techno_functional_hr_interview'),
            import_status=data.get('import_status', 'active'),
            import_panel_name=panel_name,
            import_date=datetime.now(timezone.utc),
            source='bulk_import',
            tags=['bulk_import'],
            pipeline_stage='applied'
        )
        
        return candidate
    
    @staticmethod
    def preview_sheet_data(
        file_path: str,
        sheet_name: str | None = None,
        preview_rows: int = 10
    ) -> dict[str, Any]:
        """
        Preview data from a sheet
        
        Args:
            file_path: Path to file
            sheet_name: Sheet name (for Excel)
            preview_rows: Number of rows to preview
            
        Returns:
            Preview data with parsed and unparsed records
        """
        try:
            df = BulkImportService.read_sheet_data(file_path, sheet_name)
            
            preview_data = []
            errors = []
            
            # Get first N rows
            df_preview = df.head(preview_rows)
            
            for idx, row in df_preview.iterrows():
                row_dict = row.to_dict()
                parsed = BulkImportService.parse_row(row_dict)
                is_valid, validation_errors = BulkImportService.validate_candidate_data(parsed)
                
                preview_data.append({
                    'row_number': idx + 2,  # +2 because Excel is 1-indexed and has header
                    'raw_data': sanitize_json_data(row_dict),
                    'parsed_data': sanitize_json_data(parsed),
                    'is_valid': is_valid,
                    'errors': validation_errors
                })
                
                if not is_valid:
                    errors.extend(validation_errors)
            
            return {
                'total_rows': len(df),
                'preview_rows': sanitize_json_data(preview_data),
                'has_errors': len([p for p in preview_data if not p['is_valid']]) > 0,
                'column_mapping': {
                    col: BulkImportService.get_field_name(col)
                    for col in df.columns
                }
            }
        except Exception as e:
            logger.error(f"Error previewing sheet: {e}")
            raise ValueError(f"Failed to preview sheet: {str(e)}")

    @staticmethod
    def preview_all_sheets_data(
        file_path: str,
        preview_rows_per_sheet: int = 5
    ) -> dict[str, Any]:
        """
        Preview first rows from all sheets in an Excel file.
        """
        lowered = file_path.lower()
        if not lowered.endswith(".xlsx"):
            return BulkImportService.preview_sheet_data(file_path, preview_rows=preview_rows_per_sheet)

        xls = pd.ExcelFile(file_path)
        combined_preview_rows: list[dict[str, Any]] = []
        total_rows = 0
        has_errors = False
        column_mapping: dict[str, str | None] = {}

        for sheet in xls.sheet_names:
            sheet_preview = BulkImportService.preview_sheet_data(
                file_path=file_path,
                sheet_name=sheet,
                preview_rows=preview_rows_per_sheet
            )
            total_rows += sheet_preview["total_rows"]
            has_errors = has_errors or sheet_preview["has_errors"]
            for col, mapped in sheet_preview["column_mapping"].items():
                if col not in column_mapping:
                    column_mapping[col] = mapped
            for row in sheet_preview["preview_rows"]:
                row["sheet_name"] = sheet
                combined_preview_rows.append(row)

        return {
            "total_rows": total_rows,
            "preview_rows": combined_preview_rows[: max(10, preview_rows_per_sheet * len(xls.sheet_names))],
            "has_errors": has_errors,
            "column_mapping": column_mapping
        }
    
    @staticmethod
    async def bulk_import_sheet(
        file_path: str,
        sheet_name: str | None,
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID | None,
        db: AsyncSession,
        import_batch_id: uuid.UUID | None = None,
        imported_at: datetime | None = None,
        auto_commit: bool = True,
        job_cache: dict[str, Job] | None = None,
        import_job: Job | None = None,
        existing_emails: dict[str, Candidate] | None = None,
        existing_phones: dict[str, Candidate] | None = None,
    ) -> BulkImportResult:
        """
        Import candidates from a sheet
        
        Args:
            file_path: Path to file
            sheet_name: Sheet name (for Excel) or None for CSV
            organization_id: Organization ID
            created_by_id: User ID performing import
            db: Database session
            
        Returns:
            BulkImportResult with import statistics
        """
        result = BulkImportResult()
        
        try:
            if job_cache is None:
                job_cache = {}

            # Pre-populate job_cache with existing POOL jobs if it's empty
            if not job_cache:
                jobs_res = await db.execute(
                    select(Job).where(
                        Job.organization_id == organization_id,
                        Job.status == JobStatus.POOL
                    )
                )
                for j in jobs_res.scalars().all():
                    if j.title:
                        job_cache[j.title.lower().strip()] = j

            # Pre-fetch existing candidates' emails and phones if caches are None
            if existing_emails is None or existing_phones is None:
                candidates_res = await db.execute(
                    select(Candidate).where(
                        Candidate.organization_id == organization_id
                    )
                )
                candidates_list = candidates_res.scalars().all()
                if existing_emails is None:
                    existing_emails = {}
                    for c in candidates_list:
                        if c.email:
                            existing_emails[c.email.lower().strip()] = c
                if existing_phones is None:
                    existing_phones = {}
                    for c in candidates_list:
                        if c.phone:
                            existing_phones[c.phone.strip()] = c

            if import_job is None:
                import_job = await BulkImportService._get_or_create_pool_job(
                    db=db,
                    organization_id=organization_id,
                    created_by_id=created_by_id,
                    title=BulkImportService.IMPORT_CANDIDATES_DESIGNATION_TITLE,
                    cache=job_cache,
                )

            # Read sheet data
            df = BulkImportService.read_sheet_data(file_path, sheet_name)
            
            if df.empty:
                result.errors.append({'message': 'File is empty', 'row': 0})
                return result
            result.total_rows = len(df)
            
            # Process each row
            for idx, row in df.iterrows():
                try:
                    async with db.begin_nested():
                        row_dict = row.to_dict()
                        parsed_data = BulkImportService.parse_row(row_dict)
                        
                        # Validate
                        is_valid, validation_errors = BulkImportService.validate_candidate_data(parsed_data)
                        
                        if not is_valid:
                            result.invalid_rows.append({
                                'row_number': idx + 2,
                                'raw_data': sanitize_json_data(row_dict),
                                'errors': validation_errors
                            })
                            result.error_count += 1
                            continue
                        
                        # Check for duplicates in-memory
                        existing = None
                        email_val = parsed_data.get('email')
                        if email_val and str(email_val).strip():
                            email_key = str(email_val).lower().strip()
                            if email_key in existing_emails:
                                existing = existing_emails[email_key]
                        
                        if not existing:
                            phone_val = parsed_data.get('phone')
                            if phone_val and str(phone_val).strip():
                                phone_key = str(phone_val).strip()
                                if phone_key in existing_phones:
                                    existing = existing_phones[phone_key]
                        
                        if existing:
                            result.duplicates.append({
                                'row_number': idx + 2,
                                'email': parsed_data.get('email'),
                                'full_name': parsed_data.get('full_name'),
                                'existing_id': str(existing.id)
                            })
                            result.skipped_count += 1
                            continue
                        
                        # Create candidate
                        candidate = BulkImportService.create_candidate_from_data(
                            parsed_data,
                            organization_id,
                            created_by_id,
                            panel_name=sheet_name,
                            import_batch_id=import_batch_id,
                            imported_at=imported_at,
                        )
                        
                        db.add(candidate)
                        await db.flush()
                        result.created_count += 1
                        result.imported_candidates.append(str(candidate.id))

                        # Track new candidate in memory to catch duplicates within the same sheet
                        if candidate.email:
                            existing_emails[candidate.email.lower().strip()] = candidate
                        if candidate.phone:
                            existing_phones[candidate.phone.strip()] = candidate

                        # Assign candidate to designations via applications:
                        # 1) Global "Import Candidates" (reused forever)
                        # 2) Role/technology designation (sheet/panel name), created once then reused
                        role_title = (
                            BulkImportService._normalize_designation_title(sheet_name)
                            or BulkImportService._normalize_designation_title(parsed_data.get("technical_panel"))
                            or BulkImportService._normalize_designation_title(parsed_data.get("current_title"))
                            or "Imported"
                        )
                        role_job = await BulkImportService._get_or_create_pool_job(
                            db=db,
                            organization_id=organization_id,
                            created_by_id=created_by_id,
                            title=role_title,
                            cache=job_cache,
                        )

                        db.add(
                            Application(
                                organization_id=organization_id,
                                job_id=import_job.id,
                                candidate_id=candidate.id,
                                stage=ApplicationStage.APPLIED,
                                source="import",
                            )
                        )
                        if role_job.id != import_job.id:
                            db.add(
                                Application(
                                    organization_id=organization_id,
                                    job_id=role_job.id,
                                    candidate_id=candidate.id,
                                    stage=ApplicationStage.APPLIED,
                                    source="import",
                                )
                            )
                            # Prefer the role designation for display in All Talent list.
                            candidate.applied_job_title = role_job.title
                        
                        # Add to preview
                        if len(result.preview_data) < 5:
                            result.preview_data.append({
                                'id': str(candidate.id),
                                'name': candidate.full_name,
                                'email': candidate.email,
                                'phone': candidate.phone,
                                'company': candidate.current_company,
                                'experience': candidate.years_experience
                            })
                
                except Exception as e:
                    logger.error(f"Error processing row {idx}: {e}")
                    result.errors.append({
                        'row_number': idx + 2,
                        'error': str(e)
                    })
                    result.error_count += 1
                    continue
            
            # Commit to database
            if auto_commit:
                try:
                    await db.commit()
                except Exception as e:
                    await db.rollback()
                    logger.error(f"Database commit error: {e}")
                    result.errors.append({
                        'message': f'Database error: {str(e)}',
                        'row': 0
                    })
                    result.created_count = 0
                    result.imported_candidates = []
            
        except Exception as e:
            logger.error(f"Error during bulk import: {e}")
            result.errors.append({
                'message': f'Import error: {str(e)}',
                'row': 0
            })
        
        return result

    @staticmethod
    async def bulk_import_all_sheets(
        file_path: str,
        organization_id: uuid.UUID,
        created_by_id: uuid.UUID | None,
        db: AsyncSession,
        import_batch_id: uuid.UUID | None = None,
        imported_at: datetime | None = None,
        auto_commit: bool = True,
    ) -> BulkImportResult:
        """
        Import all sheets from an Excel file. For CSV, imports the single dataset.
        """
        lowered = file_path.lower()
        if lowered.endswith(".csv"):
            return await BulkImportService.bulk_import_sheet(
                file_path=file_path,
                sheet_name=None,
                organization_id=organization_id,
                created_by_id=created_by_id,
                db=db,
                import_batch_id=import_batch_id,
                imported_at=imported_at,
                auto_commit=auto_commit,
            )

        result = BulkImportResult()
        job_cache: dict[str, Job] = {}
        
        # Pre-populate cache with all existing POOL jobs
        jobs_res = await db.execute(
            select(Job).where(
                Job.organization_id == organization_id,
                Job.status == JobStatus.POOL
            )
        )
        for j in jobs_res.scalars().all():
            if j.title:
                job_cache[j.title.lower().strip()] = j

        # Pre-fetch all candidates' emails and phones
        candidates_res = await db.execute(
            select(Candidate).where(
                Candidate.organization_id == organization_id
            )
        )
        candidates_list = candidates_res.scalars().all()
        existing_emails = {}
        existing_phones = {}
        for c in candidates_list:
            if c.email:
                existing_emails[c.email.lower().strip()] = c
            if c.phone:
                existing_phones[c.phone.strip()] = c

        import_job = await BulkImportService._get_or_create_pool_job(
            db=db,
            organization_id=organization_id,
            created_by_id=created_by_id,
            title=BulkImportService.IMPORT_CANDIDATES_DESIGNATION_TITLE,
            cache=job_cache,
        )
        
        sheets = BulkImportService.detect_sheets(file_path)
        for sheet in sheets:
            sheet_result = await BulkImportService.bulk_import_sheet(
                file_path=file_path,
                sheet_name=sheet.name,
                organization_id=organization_id,
                created_by_id=created_by_id,
                db=db,
                import_batch_id=import_batch_id,
                imported_at=imported_at,
                auto_commit=False,
                job_cache=job_cache,
                import_job=import_job,
                existing_emails=existing_emails,
                existing_phones=existing_phones,
            )
            result.total_rows += sheet_result.total_rows
            result.created_count += sheet_result.created_count
            result.skipped_count += sheet_result.skipped_count
            result.error_count += sheet_result.error_count
            result.errors.extend(sheet_result.errors)
            result.duplicates.extend(sheet_result.duplicates)
            result.invalid_rows.extend(sheet_result.invalid_rows)
            remaining = 5 - len(result.preview_data)
            if remaining > 0:
                result.preview_data.extend(sheet_result.preview_data[:remaining])
            result.imported_candidates.extend(sheet_result.imported_candidates)

        if auto_commit:
            try:
                await db.commit()
            except Exception as e:
                await db.rollback()
                logger.error(f"Database commit error (all sheets): {e}")
                result.errors.append({'message': f'Database error: {str(e)}', 'row': 0})
                result.created_count = 0
                result.imported_candidates = []
        return result

    @staticmethod
    async def create_import_batch(
        db: AsyncSession,
        organization_id: uuid.UUID,
        imported_by_id: uuid.UUID | None,
        file_name: str,
        file_path: str | None,
        selected_panels: list[str],
        total_rows: int,
        result: BulkImportResult,
    ) -> ImportBatch:
        batch = ImportBatch(
            organization_id=organization_id,
            imported_by_id=imported_by_id,
            file_name=file_name,
            file_path=file_path,
            selected_panels=selected_panels,
            total_rows=total_rows,
            success_count=result.created_count,
            failed_count=result.error_count,
            duplicate_count=result.skipped_count,
            status="completed",
            failure_details={
                "errors": sanitize_json_data(result.errors),
                "invalid_rows": sanitize_json_data(result.invalid_rows),
                "duplicates": sanitize_json_data(result.duplicates),
            },
        )
        db.add(batch)
        await db.flush()
        return batch
