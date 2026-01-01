"""Media storage abstraction layer.

Supports both local filesystem (development) and S3 (production) storage backends.
"""

import logging
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from fastapi import UploadFile
from fastapi.responses import FileResponse, StreamingResponse

logger = logging.getLogger(__name__)


class MediaStorage(ABC):
    """Abstract base class for media storage backends."""

    @abstractmethod
    async def upload(self, file: UploadFile, filename: str) -> str:
        """Upload a file and return its URL.

        Args:
            file: Uploaded file from FastAPI
            filename: Desired filename (with extension)

        Returns:
            URL where the file can be accessed

        Raises:
            Exception: If upload fails
        """
        pass

    @abstractmethod
    async def get(self, filename: str) -> Any:
        """Retrieve a file for serving.

        Args:
            filename: Name of the file to retrieve

        Returns:
            Response object (FileResponse, StreamingResponse, etc.)

        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass

    @abstractmethod
    async def delete(self, filename: str) -> None:
        """Delete a file.

        Args:
            filename: Name of the file to delete

        Raises:
            FileNotFoundError: If file doesn't exist
        """
        pass

    @abstractmethod
    async def exists(self, filename: str) -> bool:
        """Check if a file exists.

        Args:
            filename: Name of the file to check

        Returns:
            True if file exists, False otherwise
        """
        pass


class LocalStorage(MediaStorage):
    """Local filesystem storage backend for development."""

    def __init__(self, media_dir: str = "/app/media"):
        """Initialize local storage.

        Args:
            media_dir: Directory path for storing media files
        """
        self.media_dir = Path(media_dir)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        logger.info(f"LocalStorage initialized with directory: {self.media_dir}")

    async def upload(self, file: UploadFile, filename: str) -> str:
        """Upload file to local filesystem."""
        filepath = self.media_dir / filename

        try:
            with filepath.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)

            logger.info(f"File uploaded to local storage: {filename}")
            return f"/api/v1/media/{filename}"

        except Exception as e:
            logger.error(f"Failed to upload file to local storage: {e}", exc_info=True)
            raise Exception(f"Failed to upload file: {str(e)}")

    async def get(self, filename: str) -> FileResponse:
        """Retrieve file from local filesystem."""
        filepath = self.media_dir / filename

        if not filepath.exists() or not filepath.is_file():
            raise FileNotFoundError(f"File not found: {filename}")

        return FileResponse(filepath)

    async def delete(self, filename: str) -> None:
        """Delete file from local filesystem."""
        filepath = self.media_dir / filename

        if not filepath.exists() or not filepath.is_file():
            raise FileNotFoundError(f"File not found: {filename}")

        try:
            filepath.unlink()
            logger.info(f"File deleted from local storage: {filename}")
        except Exception as e:
            logger.error(
                f"Failed to delete file from local storage: {e}", exc_info=True
            )
            raise Exception(f"Failed to delete file: {str(e)}")

    async def exists(self, filename: str) -> bool:
        """Check if file exists in local filesystem."""
        filepath = self.media_dir / filename
        return filepath.exists() and filepath.is_file()


class S3Storage(MediaStorage):
    """S3 storage backend for production."""

    def __init__(
        self, bucket_name: str, region: str = "us-east-1", base_url: str | None = None
    ):
        """Initialize S3 storage.

        Args:
            bucket_name: S3 bucket name
            region: AWS region
            base_url: Optional base URL for serving files (e.g., CloudFront)
        """
        try:
            import boto3  # type: ignore[import-not-found]  # noqa: I001
            from botocore.exceptions import ClientError  # type: ignore[import-not-found]  # noqa: I001

            self.ClientError = ClientError
        except ImportError:
            raise ImportError(
                "boto3 is required for S3 storage. Install with: pip install boto3"
            )

        self.bucket_name = bucket_name
        self.region = region
        self.base_url = base_url
        self.s3_client = boto3.client("s3", region_name=region)

        logger.info(
            f"S3Storage initialized with bucket: {bucket_name}, region: {region}"
        )

        # Verify bucket exists
        try:
            self.s3_client.head_bucket(Bucket=bucket_name)
        except Exception as e:
            logger.error(f"Failed to access S3 bucket {bucket_name}: {e}")
            raise Exception(f"Cannot access S3 bucket {bucket_name}: {str(e)}")

    async def upload(self, file: UploadFile, filename: str) -> str:
        """Upload file to S3."""
        try:
            # Upload to S3
            self.s3_client.upload_fileobj(
                file.file,
                self.bucket_name,
                filename,
                ExtraArgs={
                    "ContentType": file.content_type or "application/octet-stream",
                    "CacheControl": "max-age=31536000",  # 1 year cache
                },
            )

            logger.info(f"File uploaded to S3: {filename}")

            # Return URL
            if self.base_url:
                return f"{self.base_url}/{filename}"
            else:
                return f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{filename}"

        except Exception as e:
            logger.error(f"Failed to upload file to S3: {e}", exc_info=True)
            raise Exception(f"Failed to upload file to S3: {str(e)}")

    async def get(self, filename: str) -> StreamingResponse:
        """Retrieve file from S3 as streaming response."""
        try:
            # Get object from S3
            response = self.s3_client.get_object(Bucket=self.bucket_name, Key=filename)

            # Stream the file content
            return StreamingResponse(
                response["Body"].iter_chunks(chunk_size=8192),
                media_type=response.get("ContentType", "application/octet-stream"),
                headers={
                    "Content-Disposition": f'inline; filename="{filename}"',
                    "Cache-Control": "max-age=31536000",  # 1 year cache
                },
            )

        except self.ClientError as e:
            if e.response["Error"]["Code"] == "NoSuchKey":
                raise FileNotFoundError(f"File not found in S3: {filename}")
            logger.error(f"Failed to get file from S3: {e}", exc_info=True)
            raise Exception(f"Failed to retrieve file from S3: {str(e)}")

    async def delete(self, filename: str) -> None:
        """Delete file from S3."""
        try:
            # Check if file exists first
            if not await self.exists(filename):
                raise FileNotFoundError(f"File not found in S3: {filename}")

            # Delete object
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=filename)

            logger.info(f"File deleted from S3: {filename}")

        except FileNotFoundError:
            raise
        except Exception as e:
            logger.error(f"Failed to delete file from S3: {e}", exc_info=True)
            raise Exception(f"Failed to delete file from S3: {str(e)}")

    async def exists(self, filename: str) -> bool:
        """Check if file exists in S3."""
        try:
            self.s3_client.head_object(Bucket=self.bucket_name, Key=filename)
            return True
        except self.ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            # Other errors should be raised
            logger.error(f"Error checking file existence in S3: {e}")
            return False


def get_storage(
    backend: str | None = None,
    media_dir: str | None = None,
    bucket_name: str | None = None,
    region: str | None = None,
) -> MediaStorage:
    """Factory function to get the appropriate storage backend.

    Args:
        backend: Storage backend type ("local" or "s3")
        media_dir: Directory for local storage
        bucket_name: S3 bucket name
        region: AWS region

    Returns:
        MediaStorage instance

    Raises:
        ValueError: If invalid backend or missing configuration
    """
    from app.core.config import settings

    # Use settings if not provided
    backend = backend or settings.MEDIA_STORAGE_BACKEND
    media_dir = media_dir or settings.MEDIA_LOCAL_PATH
    bucket_name = bucket_name or settings.AWS_S3_MEDIA_BUCKET
    region = region or settings.AWS_REGION

    if backend == "local":
        return LocalStorage(media_dir=media_dir)
    elif backend == "s3":
        if not bucket_name:
            raise ValueError(
                "AWS_S3_MEDIA_BUCKET must be set when using S3 storage backend"
            )
        return S3Storage(bucket_name=bucket_name, region=region or "us-east-1")
    else:
        raise ValueError(f"Invalid storage backend: {backend}. Must be 'local' or 's3'")
