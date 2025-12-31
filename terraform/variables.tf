variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for authentication"
  type        = string
  default     = "personal-terraform"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "gamifying-education"
}

variable "domain_name" {
  description = "Domain name for the application (must exist in Route 53)"
  type        = string
}

variable "route53_zone_id" {
  description = "Route 53 hosted zone ID (find in Route 53 console)"
  type        = string
}

variable "ssh_key_name" {
  description = "Name of AWS EC2 key pair for SSH access"
  type        = string
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed to SSH into EC2 instance (your IP/32)"
  type        = string
  default     = "0.0.0.0/0" # WARNING: Change this to your IP for security!
}

variable "instance_type" {
  description = "EC2 instance type"
  type        = string
  default     = "t4g.micro" # ARM64, Free Tier eligible
}

variable "db_password" {
  description = "PostgreSQL database password"
  type        = string
  sensitive   = true
}

variable "django_secret_key" {
  description = "Django/FastAPI secret key"
  type        = string
  sensitive   = true
}

variable "first_superuser_email" {
  description = "First superuser email"
  type        = string
  default     = "admin@example.com"
}

variable "first_superuser_password" {
  description = "First superuser password"
  type        = string
  sensitive   = true
}

variable "openai_api_key" {
  description = "OpenAI API key for question generation"
  type        = string
  sensitive   = true
}

variable "admin_email" {
  description = "Admin email for Let's Encrypt SSL certificate"
  type        = string
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro" # x86, Free Tier for 12 months (recommended for year 1)
  # Options:
  # - db.t3.micro: Free Tier for 12 months, then ~$15/month (x86) - RECOMMENDED YEAR 1
  # - db.t4g.micro: ~$12/month (ARM64, cheaper long-term, no Free Tier)
  # - db.t4g.small: ~$24/month (better performance)
}

variable "db_allocated_storage" {
  description = "Initial storage size in GB"
  type        = number
  default     = 20 # Free Tier: 20GB, will auto-scale up to max_allocated_storage
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for high availability (doubles cost)"
  type        = bool
  default     = false # Set to true for production HA
}

variable "db_deletion_protection" {
  description = "Enable deletion protection"
  type        = bool
  default     = false # Set to true for production
}

variable "db_skip_final_snapshot" {
  description = "Skip final snapshot when deleting (for testing)"
  type        = bool
  default     = true # Set to false for production
}

# GitHub Configuration
variable "github_repo" {
  description = "GitHub repository in format 'owner/repo' for OIDC"
  type        = string
  # Example: "yourusername/gamifying-education"
}

# ECR Configuration (repositories managed in separate terraform-ecr project)
variable "ecr_backend_repository_name" {
  description = "ECR repository name for backend (from terraform-ecr)"
  type        = string
  default     = "gamifying-education-backend"
}

variable "ecr_frontend_repository_name" {
  description = "ECR repository name for frontend (from terraform-ecr)"
  type        = string
  default     = "gamifying-education-frontend"
}
