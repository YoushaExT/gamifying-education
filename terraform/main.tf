terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: Use S3 backend for state storage
  # backend "s3" {
  #   bucket = "your-terraform-state-bucket"
  #   key    = "gamifying-education/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = "production"
      ManagedBy   = "Terraform"
    }
  }
}

# Data source to get current AWS region
data "aws_region" "current" {}

# Data source to get AWS account ID
data "aws_caller_identity" "current" {}

# Data source for Route 53 zone (read-only, won't manage it)
data "aws_route53_zone" "main" {
  zone_id = var.route53_zone_id
}
