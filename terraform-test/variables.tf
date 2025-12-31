variable "aws_region" {
  description = "AWS region to deploy test instance"
  type        = string
  default     = "us-east-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use for authentication"
  type        = string
  default     = "personal-terraform"
}

variable "ssh_key_name" {
  description = "Name of AWS EC2 key pair for SSH access"
  type        = string
}

variable "instance_type" {
  description = "EC2 instance type (use t2.micro for free tier on x86)"
  type        = string
  default     = "t2.micro" # Free tier eligible
}
