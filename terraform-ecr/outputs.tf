output "backend_repository_url" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "backend_repository_name" {
  description = "ECR repository name for backend"
  value       = aws_ecr_repository.backend.name
}

output "frontend_repository_url" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "frontend_repository_name" {
  description = "ECR repository name for frontend"
  value       = aws_ecr_repository.frontend.name
}

output "ecr_registry" {
  description = "ECR registry URL (account_id.dkr.ecr.region.amazonaws.com)"
  value       = split("/", aws_ecr_repository.backend.repository_url)[0]
}
