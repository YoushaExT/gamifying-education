"""API routes for media file uploads."""

import logging
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.api.deps import CurrentUser
from app.services.media_storage import get_storage

router = APIRouter(prefix="/media", tags=["media"])
logger = logging.getLogger(__name__)

# File validation configuration
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
    file.file.seek(0, 2)  # Seek to end
    size = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large. Maximum size: {MAX_FILE_SIZE / (1024*1024):.1f}MB",
        )

    try:
        # Generate unique filename
        file_id = uuid.uuid4()
        filename = f"{file_id}{ext}"

        # Get storage backend and upload
        storage = get_storage()
        url = await storage.upload(file, filename)

        logger.info(
            f"Image uploaded by user {current_user.id}: {filename} ({size} bytes)"
        )

        # Return URL
        return {"url": url}

    except Exception as e:
        logger.error(f"Failed to upload image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to upload image")


@router.get("/{filename}")
async def get_image(filename: str) -> Any:
    """Retrieve an uploaded image file.

    Args:
        filename: Name of the image file

    Returns:
        FileResponse or StreamingResponse with the image

    Raises:
        HTTPException: If image not found
    """
    # Security: Only allow alphanumeric, hyphens, underscores, and valid extensions
    if not filename or ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    try:
        storage = get_storage()
        return await storage.get(filename)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        logger.error(f"Failed to retrieve image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to retrieve image")


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

    try:
        storage = get_storage()
        await storage.delete(filename)
        logger.info(f"Image deleted by user {current_user.id}: {filename}")
        return {"message": "Image deleted successfully"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Image not found")
    except Exception as e:
        logger.error(f"Failed to delete image: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to delete image")
