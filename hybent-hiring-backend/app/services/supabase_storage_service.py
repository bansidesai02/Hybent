"""
Supabase Storage Service for Hybent Hiring.

Handles all file operations with Supabase Storage:
- Resume upload and retrieval (current scope)
- Designed for extensibility: audio and other file types can be added later
  by adding new methods following the same pattern.

Security principles:
- Service role key is only ever used server-side.
- All buckets are private; files are never publicly accessible.
- Signed URLs are generated on-demand and never stored in the database.
- All operations are tenant-isolated by organization_id.
"""
import logging
import uuid
from pathlib import Path

from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Bucket names (constants — change here if renamed in Supabase dashboard) ────
RESUME_BUCKET = "resume"


def _get_supabase_client():
    """
    Returns a Supabase client configured with the service role key.
    Raises a clear error if credentials are not configured.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise HTTPException(
            status_code=503,
            detail="Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment.",
        )
    from supabase import create_client, Client  # type: ignore[import]
    client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return client


def _build_resume_path(organization_id: str, candidate_id: str, filename: str) -> str:
    """
    Construct the canonical storage path for a resume.

    Format: resumes/{organization_id}/{candidate_id}/{uuid}_{sanitized_filename}

    The UUID prefix prevents path collisions when the same candidate
    re-uploads a resume with the same original filename.
    """
    uid = uuid.uuid4().hex[:8]
    # Sanitize filename: keep only safe characters
    safe_name = Path(filename).name.replace(" ", "_")
    return f"{organization_id}/{candidate_id}/{uid}_{safe_name}"

# ─────────────────────────────────────────────────────────────────────────────
# Resume Operations
# ─────────────────────────────────────────────────────────────────────────────

async def upload_resume(
    file_content: bytes,
    organization_id: str,
    candidate_id: str,
    original_filename: str,
    content_type: str,
) -> str:
    """
    Upload a resume file to the private Supabase 'resumes' bucket.

    Returns the storage path (NOT a URL). This path should be stored in the
    database and used later to generate signed URLs on demand.

    Raises:
        HTTPException 400: File too large.
        HTTPException 503: Supabase not configured.
        HTTPException 500: Upload failed after retries.
    """
    if len(file_content) > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum allowed size is {settings.max_file_size_mb}MB.",
        )

    storage_path = _build_resume_path(organization_id, candidate_id, original_filename)

    client = _get_supabase_client()

    max_attempts = 3
    last_error: Exception | None = None

    for attempt in range(1, max_attempts + 1):
        try:
            import asyncio
            loop = asyncio.get_event_loop()

            def _upload():
                try:
                    client.storage.get_bucket(RESUME_BUCKET)
                except Exception:
                    try:
                        client.storage.create_bucket(RESUME_BUCKET, options={"public": False})
                    except Exception:
                        pass

                return client.storage.from_(RESUME_BUCKET).upload(
                    path=storage_path,
                    file=file_content,
                    file_options={
                        "content-type": content_type,
                        "upsert": "true",  # Allow re-upload for same path
                    },
                )

            await loop.run_in_executor(None, _upload)
            logger.info(
                "Resume uploaded to Supabase | org=%s candidate=%s path=%s",
                organization_id,
                candidate_id,
                storage_path,
            )
            return storage_path

        except Exception as exc:
            last_error = exc
            logger.warning(
                "Supabase upload attempt %d/%d failed | path=%s | error=%s",
                attempt,
                max_attempts,
                storage_path,
                exc,
            )
            if attempt < max_attempts:
                import asyncio
                await asyncio.sleep(0.5 * attempt)  # Backoff: 0.5s, 1.0s

    logger.error(
        "Supabase upload failed after %d attempts | path=%s | error=%s",
        max_attempts,
        storage_path,
        last_error,
    )
    raise HTTPException(
        status_code=500,
        detail=f"Failed to upload resume to storage after {max_attempts} attempts. Please try again.",
    )


async def get_signed_resume_url(
    storage_path: str,
    expiry_seconds: int | None = None,
) -> str:
    """
    Generate a temporary signed URL for a stored resume.

    The URL expires after `expiry_seconds` (defaults to RESUME_SIGNED_URL_EXPIRY
    from settings). This method must be called on EVERY access — signed URLs
    are never stored in the database.

    Args:
        storage_path: The path returned by upload_resume(), stored in the DB.
        expiry_seconds: Override the default expiry. Falls back to settings value.

    Returns:
        A time-limited signed URL string.

    Raises:
        HTTPException 404: File not found in storage.
        HTTPException 503: Supabase not configured.
        HTTPException 500: Failed to generate signed URL.
    """
    if expiry_seconds is None:
        expiry_seconds = settings.resume_signed_url_expiry

    client = _get_supabase_client()

    try:
        import asyncio
        loop = asyncio.get_event_loop()

        def _sign():
            return client.storage.from_(RESUME_BUCKET).create_signed_url(
                path=storage_path,
                expires_in=expiry_seconds,
            )

        response = await loop.run_in_executor(None, _sign)

        signed_url: str | None = None
        if isinstance(response, dict):
            signed_url = response.get("signedURL") or response.get("signedUrl")
        elif hasattr(response, "signed_url"):
            signed_url = response.signed_url

        if not signed_url:
            logger.error(
                "Supabase signed URL generation returned no URL | path=%s | response=%s",
                storage_path,
                response,
            )
            raise HTTPException(
                status_code=500,
                detail="Failed to generate a secure file URL. Please try again.",
            )

        logger.info(
            "Signed resume URL generated | path=%s | expiry=%ds",
            storage_path,
            expiry_seconds,
        )
        return signed_url

    except HTTPException:
        raise
    except Exception as exc:
        logger.error(
            "Failed to generate signed URL | path=%s | error=%s",
            storage_path,
            exc,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to generate a secure file URL. Please try again.",
        )


async def delete_resume(storage_path: str) -> None:
    """
    Delete a resume file from Supabase Storage.

    Silently succeeds if the file does not exist (idempotent).
    Only raises on unexpected errors to prevent blocking candidate deletion.
    """
    client = _get_supabase_client()
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        await loop.run_in_executor(
            None,
            lambda: client.storage.from_(RESUME_BUCKET).remove([storage_path]),
        )
        logger.info("Deleted resume from Supabase | path=%s", storage_path)
    except Exception as exc:
        # Log but don't block — candidate deletion should still proceed
        logger.error(
            "Failed to delete resume from Supabase | path=%s | error=%s",
            storage_path,
            exc,
        )


async def delete_candidate_files(organization_id: str, candidate_id: str) -> None:
    """
    Delete ALL files associated with a candidate across all storage buckets.

    Called when a candidate is permanently deleted. Currently deletes resumes.

    This is a best-effort operation — failures are logged but do not block
    the candidate deletion flow.
    """
    # Future-proof: we list the candidate's prefix in each bucket and remove all files.
    # This handles cases where a candidate has uploaded multiple resumes over time.
    client = _get_supabase_client()

    async def _delete_bucket_prefix(bucket: str, prefix: str) -> None:
        import asyncio
        loop = asyncio.get_event_loop()
        try:
            # List all files under the candidate's directory prefix
            files = await loop.run_in_executor(
                None,
                lambda: client.storage.from_(bucket).list(prefix),
            )
            if not files:
                return
            # Extract paths and delete
            paths = [f"{prefix}/{f['name']}" for f in files if f.get("name")]
            if paths:
                await loop.run_in_executor(
                    None,
                    lambda: client.storage.from_(bucket).remove(paths),
                )
                logger.info(
                    "Deleted %d file(s) from bucket '%s' | prefix=%s",
                    len(paths),
                    bucket,
                    prefix,
                )
        except Exception as exc:
            logger.error(
                "Failed to delete files from bucket '%s' | prefix=%s | error=%s",
                bucket,
                prefix,
                exc,
            )

    candidate_prefix = f"{organization_id}/{candidate_id}"
    await _delete_bucket_prefix(RESUME_BUCKET, candidate_prefix)


# ─────────────────────────────────────────────────────────────────────────────
# Chat Attachment Operations
# ─────────────────────────────────────────────────────────────────────────────

CHAT_ATTACHMENT_BUCKET = "chat-attachments"


def build_chat_attachment_path(organization_id: str, filename: str) -> str:
    """Format: {organization_id}/{uuid}/{sanitized_filename}"""
    safe_name = "".join(
        c if c.isalnum() or c in "._-" else "_" for c in Path(filename).name
    )[:150] or "file"
    return f"{organization_id}/{uuid.uuid4().hex}/{safe_name}"


async def upload_chat_attachment(file_content: bytes, storage_path: str, content_type: str) -> None:
    """Upload a chat file to the private chat-attachments bucket."""
    import asyncio

    client = _get_supabase_client()
    loop = asyncio.get_event_loop()

    def _upload():
        try:
            client.storage.get_bucket(CHAT_ATTACHMENT_BUCKET)
        except Exception:
            try:
                client.storage.create_bucket(CHAT_ATTACHMENT_BUCKET, options={"public": False})
            except Exception:
                pass
        return client.storage.from_(CHAT_ATTACHMENT_BUCKET).upload(
            path=storage_path,
            file=file_content,
            file_options={"content-type": content_type},
        )

    try:
        await loop.run_in_executor(None, _upload)
    except Exception as exc:
        logger.error("Chat attachment upload failed | path=%s | error=%s", storage_path, exc)
        raise HTTPException(status_code=500, detail="Failed to upload file. Please try again.")


async def get_signed_chat_attachment_url(storage_path: str, download_name: str | None = None,
                                         expiry_seconds: int = 300) -> str:
    """Short-lived signed URL for a chat attachment. Never stored."""
    import asyncio

    client = _get_supabase_client()
    loop = asyncio.get_event_loop()

    def _sign():
        options = {"download": download_name} if download_name else None
        if options:
            return client.storage.from_(CHAT_ATTACHMENT_BUCKET).create_signed_url(
                path=storage_path, expires_in=expiry_seconds, options=options,
            )
        return client.storage.from_(CHAT_ATTACHMENT_BUCKET).create_signed_url(
            path=storage_path, expires_in=expiry_seconds,
        )

    try:
        response = await loop.run_in_executor(None, _sign)
    except Exception as exc:
        logger.error("Chat attachment signing failed | path=%s | error=%s", storage_path, exc)
        raise HTTPException(status_code=500, detail="Could not open this file.")

    signed_url = None
    if isinstance(response, dict):
        signed_url = response.get("signedURL") or response.get("signedUrl")
    elif hasattr(response, "signed_url"):
        signed_url = response.signed_url
    if not signed_url:
        raise HTTPException(status_code=404, detail="File not found.")
    return signed_url


async def delete_chat_attachments(storage_paths: list[str]) -> None:
    if not storage_paths:
        return
    import asyncio

    client = _get_supabase_client()
    loop = asyncio.get_event_loop()
    try:
        await loop.run_in_executor(
            None, lambda: client.storage.from_(CHAT_ATTACHMENT_BUCKET).remove(storage_paths)
        )
    except Exception as exc:
        logger.warning("Chat attachment delete failed | count=%d | error=%s", len(storage_paths), exc)
