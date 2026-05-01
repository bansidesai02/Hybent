"""
Local filesystem storage service.
Files saved to uploads/ directory, served via FastAPI StaticFiles.
"""
import os
import uuid
import aiofiles
from pathlib import Path

from pathlib import Path

from fastapi import UploadFile, HTTPException
import cloudinary
import cloudinary.uploader

from app.config import settings

# Configure Cloudinary globally when the service loads
if settings.cloudinary_cloud_name:
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True
    )


UPLOAD_BASE = Path(settings.upload_dir)
UPLOAD_BASE.mkdir(exist_ok=True)

ALLOWED_RESUME_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    # Some browsers/OS report DOCX as zip
    "application/zip": ".docx",
    "application/x-zip-compressed": ".docx",
    "application/octet-stream": None,  # resolved by filename extension below
}

_EXT_MAP = {".pdf": ".pdf", ".docx": ".docx", ".doc": ".doc"}

ALLOWED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}

async def save_resume(file: UploadFile, organization_id: str) -> tuple[str, str]:
    """
    Save resume file to disk.
    Returns (file_url, original_filename).
    """
    ct = file.content_type or ""
    fname_ext = Path(file.filename or "").suffix.lower() if file.filename else ""

    if ct in ALLOWED_RESUME_TYPES and ALLOWED_RESUME_TYPES[ct] is not None:
        ext = ALLOWED_RESUME_TYPES[ct]
    elif fname_ext in _EXT_MAP:
        # Fallback: use file extension when browser sends generic content-type
        ext = _EXT_MAP[fname_ext]
    else:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and DOC files are supported")

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(status_code=400, detail=f"File too large (max {settings.max_file_size_mb}MB)")

    # 1. Cloudinary Upload Flow
    if settings.cloudinary_cloud_name:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: cloudinary.uploader.upload(
                    content,
                    folder=f"hireon_resumes/{organization_id}",
                    public_id=f"resume_{uuid.uuid4().hex[:8]}{ext}",
                    resource_type="raw"
                )
            )
            return response.get("secure_url"), file.filename
        except Exception as e:
            print(f"ERROR: Cloudinary upload failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Resume upload to Cloudinary failed: {str(e)}")

    # 2. Fallback Local Storage Flow
    filename = f"{uuid.uuid4()}{ext}"
    folder = UPLOAD_BASE / "resumes" / organization_id
    folder.mkdir(parents=True, exist_ok=True)

    filepath = folder / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return f"/static/uploads/resumes/{organization_id}/{filename}", file.filename


async def save_jd(file: UploadFile, organization_id: str) -> tuple[str, str]:
    """
    Save job description file to disk.
    Returns (file_url, original_filename).
    """
    if file.content_type not in ALLOWED_RESUME_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    content = await file.read()
    if len(content) > settings.max_file_size_bytes:
        raise HTTPException(status_code=400, detail=f"File too large (max {settings.max_file_size_mb}MB)")

    ext = ALLOWED_RESUME_TYPES[file.content_type]

    # 1. Cloudinary Upload Flow
    if settings.cloudinary_cloud_name:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: cloudinary.uploader.upload(
                    content,
                    folder=f"hireon_jds/{organization_id}",
                    public_id=f"jd_{uuid.uuid4().hex[:8]}{ext}",
                    resource_type="raw"
                )
            )
            return response.get("secure_url"), file.filename
        except Exception as e:
            print(f"ERROR: Cloudinary upload failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"JD upload to Cloudinary failed: {str(e)}")

    # 2. Fallback Local Storage Flow
    filename = f"{uuid.uuid4()}{ext}"
    folder = UPLOAD_BASE / "jds" / organization_id
    folder.mkdir(parents=True, exist_ok=True)

    filepath = folder / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return f"/static/uploads/jds/{organization_id}/{filename}", file.filename


async def save_offer_pdf(pdf_bytes: bytes, organization_id: str) -> str:
    """Save generated offer PDF and return URL."""
    filename = f"{uuid.uuid4()}.pdf"
    folder = UPLOAD_BASE / "offers" / organization_id
    folder.mkdir(parents=True, exist_ok=True)

    filepath = folder / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(pdf_bytes)

    return f"/static/uploads/offers/{organization_id}/{filename}"


async def save_avatar(file: UploadFile, user_id: str) -> str:
    """Save user avatar to Cloudinary (if configured) or local disk, and return URL."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP images are supported")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="Avatar too large (max 5MB)")

    # 1. Cloudinary Upload Flow
    if settings.cloudinary_cloud_name:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: cloudinary.uploader.upload(
                    content,
                    folder="hireon_avatars",
                    public_id=f"avatar_{user_id}_{uuid.uuid4().hex[:8]}"
                )
            )
            return response.get("secure_url")
        except Exception as e:
            print(f"ERROR: Cloudinary upload failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Image upload to Cloudinary failed: {str(e)}")

    # 2. Fallback Local Storage Flow
    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    folder = UPLOAD_BASE / "avatars"
    folder.mkdir(parents=True, exist_ok=True)

    filepath = folder / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return f"/static/uploads/avatars/{filename}"


async def save_logo(file: UploadFile, organization_id: str) -> str:
    """Save organization logo to Cloudinary (if configured) or local disk, and return URL."""
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP images are supported")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB
        raise HTTPException(status_code=400, detail="Logo too large (max 5MB)")

    # 1. Cloudinary Upload Flow
    if settings.cloudinary_cloud_name:
        import asyncio
        try:
            loop = asyncio.get_event_loop()
            response = await loop.run_in_executor(
                None,
                lambda: cloudinary.uploader.upload(
                    content,
                    folder="hireon_logos",
                    public_id=f"logo_{organization_id}_{uuid.uuid4().hex[:8]}"
                )
            )
            return response.get("secure_url")
        except Exception as e:
            print(f"ERROR: Cloudinary upload failed: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Image upload to Cloudinary failed: {str(e)}")

    # 2. Fallback Local Storage Flow
    ext = ALLOWED_IMAGE_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}{ext}"
    folder = UPLOAD_BASE / "logos"
    folder.mkdir(parents=True, exist_ok=True)

    filepath = folder / filename
    async with aiofiles.open(filepath, "wb") as f:
        await f.write(content)

    return f"/static/uploads/logos/{filename}"


def get_file_path(url: str) -> Path:
    """Convert a /static/uploads/... URL to a local filesystem path."""
    relative = url.replace("/static/uploads/", "", 1)
    return UPLOAD_BASE / relative


async def read_file_bytes(url: str) -> bytes:
    """Read raw bytes from a stored file (for AI parsing etc.)."""
    path = get_file_path(url)
    if not path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    async with aiofiles.open(path, "rb") as f:
        return await f.read()
