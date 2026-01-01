# Deployment Checklist

Simple checklist - only the essentials.

**⚠️ First Time?** Complete `PRE_DEPLOYMENT_CHECKLIST.md` first to verify everything works locally!

---

## One-Time Setup (First Deployment Only)

### AWS Setup
- [x] AWS CLI installed: `aws --version`
- [x] AWS credentials configured (profile: `personal-terraform`)
  ```bash
  aws configure --profile personal-terraform
  ```

### ECR Setup (REQUIRED - Do This First!)

**IMPORTANT**: ECR repositories must be deployed BEFORE main infrastructure!

- [x] Deploy ECR repositories:
  ```bash
  cd terraform-ecr
  cp terraform.tfvars.example terraform.tfvars
  vim terraform.tfvars  # Fill in: aws_region, aws_profile, project_name
  terraform init
  terraform apply
  # Type: yes
  ```

- [x] Verify ECR repos created:
  ```bash
  terraform output
  # Should show backend and frontend repository URLs
  ```

**Note**: These repos persist even when you destroy the main infrastructure!

### Route53 Setup

**Note**: Domain bought from AWS = hosted zone and nameservers already configured!

- [x] Get zone ID:
  ```bash
  aws route53 list-hosted-zones --profile personal-terraform | grep yousha.click -A 5
  # Copy the zone ID (looks like Z1234567890ABC)
  ```

- [x] Verify nameservers already point to AWS (optional check):
  ```bash
  dig yousha.click NS +short
  # Should show AWS nameservers (already done)
  ```

### Terraform Setup
- [x] Create terraform.tfvars:
  ```bash
  cd terraform
  cp terraform.tfvars.example terraform.tfvars
  vim terraform.tfvars
  ```

- [x] Fill in required values:
  - [x] `route53_zone_id` (from above)
  - [x] `db_password` (make one up)
  - [x] `first_superuser_password` (your admin password)
  - [x] `openai_api_key` (from OpenAI)
  - [x] `github_token` (GitHub personal access token - only if repo is private)

---

## Deploy

- [x] **If GitHub OIDC provider already exists** (skip if first time):
  ```bash
  cd terraform
  terraform import aws_iam_openid_connect_provider.github \
    arn:aws:iam::$(aws sts get-caller-identity --query Account --output text --profile personal-terraform):oidc-provider/token.actions.githubusercontent.com
  ```

  **Note**: Only needed if you get "EntityAlreadyExists" error. Safe to run even if not needed.

- [ ] Run deployment:
  ```bash
  ./scripts/deploy.sh
  # Or manually: cd terraform && terraform apply
  ```

- [ ] Type `yes` when prompted

- [ ] Wait 10-15 minutes for initialization

- [ ] Access application:
  ```bash
  # Get URL from terraform
  cd terraform && terraform output application_url
  # Or just: https://yousha.click
  ```

- [ ] Login with your superuser email and password

- [ ] Verify everything works

---

## If Something Breaks

### Quick Debug
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(cd terraform && terraform output -raw instance_public_ip)

# Check logs
sudo tail -f /var/log/cloud-init-output.log
docker ps
docker logs gamifying-education-backend
docker logs gamifying-education-traefik
```

### Fix Without Full Redeploy
```bash
# Fix specific resource
cd terraform
vim SOME_FILE.tf
terraform apply -target=RESOURCE_NAME

# See TERRAFORM_DEBUGGING.md for details
```

### Common Error: GitHub OIDC Provider Already Exists

**Error**: `EntityAlreadyExists: Provider with url https://token.actions.githubusercontent.com already exists`

**Solution**:
```bash
cd terraform
terraform import aws_iam_openid_connect_provider.github \
  arn:aws:iam::$(aws sts get-caller-identity --query Account --output text --profile personal-terraform):oidc-provider/token.actions.githubusercontent.com

# Then retry apply
terraform apply
```

---

## Cleanup (Testing)

- [ ] Destroy infrastructure:
  ```bash
  ./scripts/destroy.sh
  # Or manually: cd terraform && terraform destroy
  ```

- [ ] Type `yes` when prompted

**Note**: Route53 zone stays ($0.50/month) so you can redeploy without DNS hassle

---

## Summary

**One-time setup**: 2 steps (Get Route53 zone ID, create terraform.tfvars)
- Domain from AWS = nameservers already done ✓

**Deploy**: 1 command (`./scripts/deploy.sh`)

**Destroy**: 1 command (`./scripts/destroy.sh`)

**Everything else**: Automatic

See `SIMPLE_DEPLOYMENT.md` for details.
