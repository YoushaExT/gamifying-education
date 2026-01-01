# S3 Terraform (Long-lived Resources)

This terraform project manages **S3 media bucket only**. This is a long-lived resource that persists even when you destroy the main infrastructure.

## Why Separate?

- **Preserve user-uploaded images** when destroying/recreating EC2, RDS, etc.
- **Faster iteration** - destroy main infra without losing media files
- **Data durability** - S3 provides 99.999999999% durability
- **Deploy once, rarely change** - S3 bucket configuration doesn't change often
- **Independent lifecycle** - Media storage outlives application infrastructure

## What's Included

- **S3 Bucket** for storing user-uploaded images (questions, etc.)
- **Versioning** enabled for data protection
- **Encryption** at rest (AES256)
- **Public access blocked** - only backend can access via IAM
- **Lifecycle rules**:
  - Old versions transition to cheaper storage after 30 days
  - Old versions deleted after 90 days
  - Failed uploads cleaned up after 7 days
- **CORS configuration** for future browser uploads if needed

## Setup

```bash
cd terraform-s3
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Fill in values (same as main terraform)

terraform init
terraform apply
```

## Outputs

After applying, note these outputs:
- `media_bucket_name` - Use this in backend environment variable
- `media_bucket_arn` - Use this in IAM policies (main terraform)
- `media_bucket_region`
- `media_bucket_domain_name`

## Integration with Main Infrastructure

**Good news: Integration is automatic!** 🎉

The main terraform configuration (`../terraform`) is already set up to use this S3 bucket:

1. **Data source** (`terraform/main.tf`) automatically references the bucket:
```hcl
data "aws_s3_bucket" "media" {
  bucket = var.s3_media_bucket_name  # Default: "gamifying-education-production-media"
}
```

2. **IAM permissions** (`terraform/iam.tf`) grant EC2 access to S3:
```hcl
resource "aws_iam_role_policy" "s3_media_policy" {
  # Grants GetObject, PutObject, DeleteObject, ListBucket
  Resource = data.aws_s3_bucket.media.arn
}
```

3. **User data** (`terraform/user_data.sh`) configures environment variables:
```bash
MEDIA_STORAGE_BACKEND=s3
AWS_S3_MEDIA_BUCKET=${s3_media_bucket}
```

**Only if using a custom bucket name:**

If you created this bucket with a different name than the default, update `terraform/terraform.tfvars`:
```hcl
s3_media_bucket_name = "your-custom-bucket-name"
```

## Usage

**First time:**
1. Deploy S3 bucket (this project): `terraform apply`
2. Deploy main infrastructure (`../terraform`): `terraform apply`
3. Backend will automatically use S3 for media storage

**When testing:**
- Destroy main infrastructure: `cd ../terraform && terraform destroy`
- S3 bucket remains intact with all images
- Redeploy: `cd ../terraform && terraform apply`

**Only destroy S3 if:**
- You're completely done with the project
- You want to start fresh (will lose all uploaded images!)

## Cost

S3 costs:
- **Storage**: ~$0.023/GB/month (Standard)
- **Requests**: ~$0.005 per 1,000 PUT/POST, ~$0.0004 per 1,000 GET
- **Data transfer**: Free to EC2 in same region

Estimated monthly cost for typical usage:
- 1GB of images: ~$0.03/month
- 10,000 image views: ~$0.004/month
- **Total: < $0.50/month** for small-scale usage

With lifecycle policies moving old versions to cheaper storage, costs remain minimal even as usage grows.

## Security

- ✅ No public access - only backend can access via IAM role
- ✅ Encryption at rest (AES256)
- ✅ Versioning enabled (data protection)
- ✅ HTTPS enforced via IAM policy (can be added)
- ✅ Failed uploads cleaned up automatically

## Local Development

Local development uses local filesystem storage instead of S3 (no AWS credentials needed). See backend configuration for details.
