output "media_bucket_name" {
  description = "S3 bucket name for media files"
  value       = aws_s3_bucket.media.id
}

output "media_bucket_arn" {
  description = "S3 bucket ARN for media files"
  value       = aws_s3_bucket.media.arn
}

output "media_bucket_region" {
  description = "S3 bucket region"
  value       = aws_s3_bucket.media.region
}

output "media_bucket_domain_name" {
  description = "S3 bucket domain name"
  value       = aws_s3_bucket.media.bucket_domain_name
}
