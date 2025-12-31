# Get latest Ubuntu 24.04 LTS ARM64 AMI
data "aws_ami" "ubuntu_arm64" {
  most_recent = true
  owners      = ["099720109477"] # Canonical (Ubuntu) AWS account ID

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "root-device-type"
    values = ["ebs"]
  }
}

# EC2 Instance
resource "aws_instance" "main" {
  ami                    = data.aws_ami.ubuntu_arm64.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.main.id]
  iam_instance_profile   = aws_iam_instance_profile.main.name
  key_name               = var.ssh_key_name

  # Root volume (30GB Free Tier)
  root_block_device {
    volume_size           = 30
    volume_type           = "gp3"
    delete_on_termination = true
    encrypted             = true

    tags = {
      Name = "${var.project_name}-root-volume"
    }
  }

  # User data script for initial setup
  user_data = templatefile("${path.module}/user_data.sh", {
    domain_name              = var.domain_name
    admin_email              = var.admin_email
    db_endpoint              = aws_db_instance.main.endpoint
    db_password              = var.db_password
    django_secret_key        = var.django_secret_key
    first_superuser_email    = var.first_superuser_email
    first_superuser_password = var.first_superuser_password
    openai_api_key           = var.openai_api_key
    aws_region               = var.aws_region
    ecr_registry             = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${var.aws_region}.amazonaws.com"
    ecr_repository_backend   = data.aws_ecr_repository.backend.name
    ecr_repository_frontend  = data.aws_ecr_repository.frontend.name
    hosted_zone_id           = var.route53_zone_id
    github_repo_url          = var.github_repo_url
    github_token             = var.github_token
  })

  # Enable detailed monitoring (Free Tier includes basic monitoring)
  monitoring = false

  # Instance metadata options (security best practice)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required" # IMDSv2 only
    http_put_response_hop_limit = 2          # Allow Docker containers to access IMDS
  }

  tags = {
    Name = "${var.project_name}-instance"
  }

  # Wait for RDS before running user_data
  depends_on = [
    aws_db_instance.main
  ]
}
