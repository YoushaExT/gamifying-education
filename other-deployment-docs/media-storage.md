# Media Storage Deployment

This document explains how to configure media storage (image uploads) for both development and production environments.

## Overview

Images uploaded through the question editor can be stored in two ways:
- **Local Filesystem** (development): Files stored in `backend/media/` directory
- **AWS S3** (production): Files stored in S3 bucket with high durability and scalability

The backend automatically uses the appropriate storage backend based on the `MEDIA_STORAGE_BACKEND` environment variable.

## Local Development Setup

**Already configured** - no additional setup needed!

The `docker-compose.override.yml` file automatically:
- Bind mounts `./backend/media` to `/app/media` in the container
- Sets `MEDIA_STORAGE_BACKEND=local`

Files are visible on your host machine in `backend/media/` for easy inspection.

```bash
# Just start the stack
docker compose watch

# Upload an image via the editor
# Check it appears in backend/media/ directory
ls backend/media/
```

## Production Deployment

### Prerequisites

- AWS account with credentials configured
- Terraform installed locally
- Access to create S3 buckets and IAM policies

### Step 1: Create S3 Bucket (One-time Setup)

The S3 bucket is managed separately from the main infrastructure to prevent accidental deletion.

```bash
# Navigate to terraform-s3 directory
cd terraform-s3

# Copy example config
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
vim terraform.tfvars
```

**terraform.tfvars:**
```hcl
aws_region   = "us-east-1"
aws_profile  = "your-aws-profile"  # AWS CLI profile name
project_name = "gamifying-education"
environment  = "production"
```

```bash
# Initialize and apply
terraform init
terraform apply

# Note the outputs - you'll need these
# Output: media_bucket_name = "gamifying-education-production-media"
# Output: media_bucket_arn = "arn:aws:s3:::gamifying-education-production-media"
```

### Step 2: Configure Main Terraform (Already Done!)

The main Terraform configuration automatically integrates with the S3 bucket created in Step 1.

**What's already configured:**

1. **Data source** (`terraform/main.tf`): References the S3 bucket by name
```hcl
data "aws_s3_bucket" "media" {
  bucket = var.s3_media_bucket_name  # Default: "gamifying-education-production-media"
}
```

2. **IAM policy** (`terraform/iam.tf`): Grants EC2 instance S3 access
```hcl
resource "aws_iam_role_policy" "s3_media_policy" {
  # Allows GetObject, PutObject, DeleteObject, ListBucket
  Resource = data.aws_s3_bucket.media.arn
}
```

3. **User data** (`terraform/user_data.sh`): Automatically configures environment variables
```bash
MEDIA_STORAGE_BACKEND=s3
AWS_S3_MEDIA_BUCKET=${s3_media_bucket}
```

**Only if you used a different bucket name:**

If you created the S3 bucket with a different name than the default, update `terraform/terraform.tfvars`:
```hcl
s3_media_bucket_name = "your-custom-bucket-name"
```

### Step 3: Deploy Infrastructure

Apply the main Terraform configuration:

```bash
cd terraform
terraform apply
```

This will:
- Grant the EC2 instance IAM permissions to access the S3 bucket
- Automatically configure environment variables in the EC2 instance:
  - `MEDIA_STORAGE_BACKEND=s3`
  - `AWS_S3_MEDIA_BUCKET=<bucket-name>`
  - `AWS_REGION=<region>`

**Note:** Credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY) are NOT needed. The EC2 instance uses its IAM role for authentication (more secure).

### Step 4: Verify Deployment

```bash
# If deploying for the first time
docker compose -f docker-compose.prod.yml up -d

# If updating existing deployment
docker compose -f docker-compose.prod.yml up -d backend

# Verify it's using S3
docker compose -f docker-compose.prod.yml logs backend | grep "S3Storage initialized"
```

## Testing

### Test Upload (Development)
```bash
# Start dev environment
docker compose watch

# Upload an image via the UI editor
# Check it appears locally
ls backend/media/
```

### Test Upload (Production)
```bash
# Upload an image via the production UI

# Check it appears in S3
aws s3 ls s3://gamifying-education-production-media/

# Download and verify
aws s3 cp s3://gamifying-education-production-media/<filename> /tmp/test.jpg
open /tmp/test.jpg
```

## S3 Bucket Configuration

The Terraform-managed S3 bucket includes:

- ✅ **Versioning** enabled for data protection
- ✅ **Encryption** at rest (AES256)
- ✅ **Public access blocked** - only backend can access via IAM
- ✅ **Lifecycle rules**:
  - Old versions → cheaper storage after 30 days
  - Old versions deleted after 90 days
  - Failed uploads cleaned up after 7 days
- ✅ **CORS** configured for browser uploads (future)

## Cost Estimates

**S3 Storage Costs:**
- Storage: ~$0.023/GB/month (Standard)
- Requests: ~$0.005 per 1,000 PUT, ~$0.0004 per 1,000 GET
- Data transfer: Free to/from EC2 in same region

**Typical usage (small scale):**
- 1GB of images: ~$0.03/month
- 10,000 image views: ~$0.004/month
- **Total: < $0.50/month**

## Troubleshooting

### Images not uploading in production

**Check environment variables:**
```bash
docker compose -f docker-compose.prod.yml exec backend env | grep MEDIA
# Should show:
# MEDIA_STORAGE_BACKEND=s3
# AWS_S3_MEDIA_BUCKET=gamifying-education-production-media
# AWS_REGION=us-east-1
```

**Check IAM permissions:**
```bash
# From EC2 instance
aws s3 ls s3://gamifying-education-production-media/
# Should list files without errors
```

**Check logs:**
```bash
docker compose -f docker-compose.prod.yml logs backend | grep -i "s3\|media"
```

### Images lost after deployment

This means S3 wasn't configured. Without S3:
- Images are stored in container filesystem
- Container restart = all images lost
- Solution: Follow production setup steps above

### boto3 import error

```bash
# Install boto3 dependency
cd backend
uv add boto3
uv sync
```

## Switching Between Storage Backends

You can switch between local and S3 storage by changing the environment variable:

```bash
# Switch to local (development)
MEDIA_STORAGE_BACKEND=local

# Switch to S3 (production)
MEDIA_STORAGE_BACKEND=s3
AWS_S3_MEDIA_BUCKET=your-bucket-name
```

**Warning:** Existing images won't automatically migrate. If you switch from local to S3, you'll need to manually upload existing files to S3.

## Security Considerations

✅ **No credentials in code** - EC2 uses IAM role
✅ **No public access** - S3 bucket blocks all public access
✅ **Encryption at rest** - AES256 encryption enabled
✅ **Unique filenames** - UUID-based to prevent overwrites
✅ **File validation** - Max 5MB, only image formats allowed
✅ **Authentication required** - Only logged-in users can upload

## Backup and Recovery

The S3 bucket has versioning enabled:

```bash
# List all versions of a file
aws s3api list-object-versions \
  --bucket gamifying-education-production-media \
  --prefix <filename>

# Restore a previous version
aws s3api copy-object \
  --bucket gamifying-education-production-media \
  --copy-source gamifying-education-production-media/<filename>?versionId=<version-id> \
  --key <filename>
```

## Destroying Infrastructure

**Important:** The S3 bucket is managed separately and will NOT be destroyed when you run `terraform destroy` in the main terraform directory.

To destroy the S3 bucket (only when completely done):
```bash
# WARNING: This deletes ALL uploaded images permanently
cd terraform-s3
terraform destroy
```

This separation ensures you can iterate on infrastructure (EC2, RDS, etc.) without losing user-uploaded images.
