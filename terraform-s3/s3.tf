# S3 Bucket for Media Files
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-${var.environment}-media"

  tags = {
    Name        = "${var.project_name}-media"
    Environment = var.environment
    Purpose     = "User-uploaded images for questions"
  }
}

# Enable versioning for data protection
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Server-side encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Block public access
resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lifecycle rule to transition old versions to cheaper storage
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "transition-old-versions"
    status = "Enabled"

    # Apply to all objects
    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA" # Cheaper storage for old versions
    }

    noncurrent_version_expiration {
      noncurrent_days = 90 # Delete old versions after 90 days
    }
  }

  rule {
    id     = "delete-incomplete-uploads"
    status = "Enabled"

    # Apply to all objects
    filter {}

    abort_incomplete_multipart_upload {
      days_after_initiation = 7 # Clean up failed uploads
    }
  }
}

# CORS configuration for browser uploads (if needed in future)
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST", "DELETE", "HEAD"]
    allowed_origins = ["*"] # Restrict this to your domain in production
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
