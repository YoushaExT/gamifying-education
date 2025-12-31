terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}

# Get latest Ubuntu 24.04 LTS AMI
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Default VPC (most AWS accounts have this)
data "aws_vpc" "default" {
  default = true
}

# Default subnet
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

# Security group allowing SSH
resource "aws_security_group" "test" {
  name        = "terraform-test-sg"
  description = "Allow SSH for testing"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "SSH from anywhere (test only!)"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # For testing - restrict this in production!
  }

  ingress {
    description = "HTTP for testing"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "terraform-test-sg"
  }
}

# Simple EC2 instance with a web server
resource "aws_instance" "test" {
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type
  key_name      = var.ssh_key_name

  vpc_security_group_ids = [aws_security_group.test.id]
  subnet_id              = data.aws_subnets.default.ids[0]

  # Simple user data to install nginx and show "Hello from Terraform!"
  user_data = <<-EOF
              #!/bin/bash
              apt-get update
              apt-get install -y nginx

              cat > /var/www/html/index.html <<HTML
              <!DOCTYPE html>
              <html>
              <head>
                  <title>Terraform Test</title>
                  <style>
                      body {
                          font-family: Arial, sans-serif;
                          display: flex;
                          justify-content: center;
                          align-items: center;
                          height: 100vh;
                          margin: 0;
                          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                          color: white;
                      }
                      .container {
                          text-align: center;
                          padding: 50px;
                          background: rgba(255, 255, 255, 0.1);
                          border-radius: 20px;
                          backdrop-filter: blur(10px);
                      }
                      h1 {
                          font-size: 3em;
                          margin-bottom: 20px;
                      }
                      .emoji {
                          font-size: 5em;
                          margin: 20px 0;
                      }
                      .info {
                          margin-top: 30px;
                          font-size: 1.2em;
                          opacity: 0.9;
                      }
                  </style>
              </head>
              <body>
                  <div class="container">
                      <div class="emoji">🚀</div>
                      <h1>Hello from Terraform!</h1>
                      <p>Your AWS setup is working correctly!</p>
                      <div class="info">
                          <p><strong>Instance:</strong> $(ec2-metadata --instance-id | cut -d ' ' -f 2)</p>
                          <p><strong>Region:</strong> ${var.aws_region}</p>
                          <p><strong>Instance Type:</strong> ${var.instance_type}</p>
                          <p><strong>Time:</strong> $(date)</p>
                      </div>
                  </div>
              </body>
              </html>
HTML

              systemctl restart nginx
              EOF

  tags = {
    Name = "terraform-test-instance"
  }
}
