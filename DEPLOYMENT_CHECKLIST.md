# Deployment Checklist

Simple checklist - only the essentials.

**⚠️ First Time?** Complete `PRE_DEPLOYMENT_CHECKLIST.md` first to verify everything works locally!

---

## One-Time Setup (First Deployment Only)

### AWS Setup
- [ ] AWS CLI installed: `aws --version`
- [ ] AWS credentials configured (profile: `personal-terraform`)
  ```bash
  aws configure --profile personal-terraform
  ```

### Route53 Setup

**Note**: Domain bought from AWS = hosted zone and nameservers already configured!

- [ ] Get zone ID:
  ```bash
  aws route53 list-hosted-zones --profile personal-terraform | grep yousha.click -A 5
  # Copy the zone ID (looks like Z1234567890ABC)
  ```

- [ ] Verify nameservers already point to AWS (optional check):
  ```bash
  dig yousha.click NS +short
  # Should show AWS nameservers (already done)
  ```

### Terraform Setup
- [ ] Create terraform.tfvars:
  ```bash
  cd terraform
  cp terraform.tfvars.example terraform.tfvars
  vim terraform.tfvars
  ```

- [ ] Fill in required values:
  - [ ] `route53_zone_id` (from above)
  - [ ] `db_password` (make one up)
  - [ ] `first_superuser_password` (your admin password)
  - [ ] `openai_api_key` (from OpenAI)

---

## Deploy

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
