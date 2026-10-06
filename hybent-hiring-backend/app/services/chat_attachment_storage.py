"""
Chat attachment storage — picks the backend by environment, like resumes:
production (Render) → private Supabase bucket; local/Docker → Cloudinary.

Both backends keep files private and hand out short-lived signed URLs on
demand. `storage_path` ({org}/{uuid}/{name}) is the same shape for both.
"""
import asyncio
import logging
import time

import cloudinary
import cloudinary.api
import cloudinary.uploader
import cloudinary.utils
from fastapi import HTTPException

from app.core.config import settings
from app.services import supabase_storage_service as supabase

logger = logging.getLogger(__name__)

CLOUDINARY_FOLDER = "hybent_hiring_chat"

build_chat_attachment_path = supabase.build_chat_attachment_path


def _use_supabase() -> bool:
    return settings.use_supabase_resume_storage


def _public_id(storage_path: str) -> str:
    return f"{CLOUDINARY_FOLDER}/{storage_path}"


def _require_cloudinary() -> None:
    if not settings.cloudinary_cloud_name:
        raise HTTPException(status_code=500, detail="File storage is not configured.")
    cloudinary.config(
        cloud_name=settings.cloudinary_cloud_name,
        api_key=settings.cloudinary_api_key,
        api_secret=settings.cloudinary_api_secret,
        secure=True,
    )


async def upload_chat_attachment(file_content: bytes, storage_path: str, content_type: str) -> None:
    if _use_supabase():
        return await supabase.upload_chat_attachment(file_content, storage_path, content_type)

    _require_cloudinary()
    try:
        # raw + authenticated: any file type, and never publicly reachable.
        await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: cloudinary.uploader.upload(
                file_content,
                public_id=_public_id(storage_path),
                resource_type="raw",
                type="authenticated",
                overwrite=False,
            ),
        )
    except Exception as exc:
        logger.error("Cloudinary chat upload failed | path=%s | error=%s", storage_path, exc)
        raise HTTPException(status_code=500, detail="Failed to upload file. Please try again.")


async def get_signed_chat_attachment_url(storage_path: str, download_name: str | None = None,
                                         expiry_seconds: int = 300) -> str:
    if _use_supabase():
        return await supabase.get_signed_chat_attachment_url(storage_path, download_name, expiry_seconds)

    _require_cloudinary()
    return cloudinary.utils.private_download_url(
        _public_id(storage_path),
        "",
        resource_type="raw",
        type="authenticated",
        expires_at=int(time.time()) + expiry_seconds,
        attachment=bool(download_name),
    )


async def delete_chat_attachments(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    if _use_supabase():
        return await supabase.delete_chat_attachments(storage_paths)

    _require_cloudinary()
    try:
        await asyncio.get_running_loop().run_in_executor(
            None,
            lambda: cloudinary.api.delete_resources(
                [_public_id(p) for p in storage_paths], resource_type="raw", type="authenticated"
            ),
        )
    except Exception as exc:
        logger.warning("Cloudinary chat delete failed | count=%d | error=%s", len(storage_paths), exc)
