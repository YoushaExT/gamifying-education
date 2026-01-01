"""API routes for media file uploads."""

import logging
import os
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse

from app.api.deps import CurrentUser

router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)

# Media directory configuration
MEDIA_DIR = Path("/app/media")  # Docker volume mount path
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# TODO: Add image compression in future iteration


@router.post("/upload")
async def upload_image(
    *,
    current_user: CurrentUser,
    file: UploadFile = File(...),
) -> dict[str, str]:
    """Upload an image file.

    Accepts images up to 5MB in JPG, PNG, GIF, WEBP, or SVG format.
    Returns the URL where the image can be accessed.

    Args:
        current_user: Current authenticated user
        file: Image file to upload

    Returns:
        Dictionary with 'url' key containing the image URL

    Raises:
        HTTPException: If file type or size is invalid
    """
    # Validate file extension
    if not file.filename:
        raise HTTPException(status_code=400, detail="File name is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Validate file size
    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024):.1f}MB",
        )

    try:
        # Generate unique filename
        file_id = uuid.uuid4()
        filename = f"{file_id}{ext}"
        filepath = MEDIA_DIR / filename

        # Ensure media directory exists
        MEDIA_DIR.mkdir(parents=True, exist_ok=True)

        # Save file
        with filepath.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        logger.info(
            f"Image uploaded by user {current_user.id}: {filename} ({size} bytes)"
        )

        # Return URL
        return {"url": f"/api/v1/media/{filename}"}

    except Exception as e:
        logger.error(f"Failed to upload image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")


@router.get("/{filename}")
async def get_image(filename: str) -> Any:
    """Retrieve an uploaded image file.

    Args:
        filename: Name of the image file

    Returns:
        FileResponse with the image

    Raises:
        HTTPException: If image not found
    """
    # Security: Only allow alphanumeric, hyphens, underscores, and valid extensions
    if not filename or ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = MEDIA_DIR / filename

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    # Return image file
    return FileResponse(filepath)


@router.delete("/{filename}")
async def delete_image(
    *,
    current_user: CurrentUser,
    filename: str,
) -> dict[str, str]:
    """Delete an uploaded image file.

    Only superusers can delete images.

    Args:
        current_user: Current authenticated user
        filename: Name of the image file to delete

    Returns:
        Success message

    Raises:
        HTTPException: If not authorized or image not found
    """
    # Only superusers can delete images
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Only superusers can delete images")

    # Security: Only allow alphanumeric, hyphens, underscores, and valid extensions
    if not filename or ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    filepath = MEDIA_DIR / filename

    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Image not found")

    try:
        filepath.unlink()
        logger.info(f"Image deleted by user {current_user.id}: {filename}")
        return {"message": "Image deleted successfully"}
    except Exception as e:
        logger.error(f"Failed to delete image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete image")
