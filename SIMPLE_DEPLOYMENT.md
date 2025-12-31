# Simple Deployment Guide

Stop overthinking it. Here's what you actually need to do.

**⚠️ First Time?** Complete `PRE_DEPLOYMENT_CHECKLIST.md` first to test everything locally!

---

## One-Time Setup (Do Once, Never Again)

### 0. Deploy ECR Repositories (FIRST!)

**CRITICAL**: Do this BEFORE everything else!

```bash
cd terraform-ecr
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Fill in: aws_region, aws_profile, project_name
terraform init
terraform apply
```

**These repos persist even when you destroy the main infrastructure!**

---

### 1. Get Route53 Hosted Zone ID

**Note**: Since your domain was bought from AWS, the hosted zone and nameservers are already configured!

Get the zone ID:
```bash
aws route53 list-hosted-zones --profile personal-terraform | grep yousha.click -A 5
# Copy the zone ID (looks like Z1234567890ABC)
```

**Cost**: $0.50/month (ongoing, already being charged)

### 2. Create terraform.tfvars
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Fill in your values
```

Required values:
- `route53_zone_id` - From step 1
- `db_password` - Make one up
- `first_superuser_password` - Your admin password
- `openai_api_key` - From OpenAI
- Everything else has defaults

---

## Deploy

```bash
cd terraform
terraform init

# If GitHub OIDC provider already exists (skip if first time):
terraform import aws_iam_openid_connect_provider.github \
  arn:aws:iam::$(aws sts get-caller-identity --query Account --output text --profile personal-terraform):oidc-provider/token.actions.githubusercontent.com

terraform apply
```

Type `yes` when prompted.

Wait 10-15 minutes for initialization.

**Done.**

---

## Access Your App

```bash
# Get the URL
terraform output application_url

# Or just go to:
https://yousha.click
```

Login with:
- Email: (what you set in `first_superuser_email`)
- Password: (what you set in `first_superuser_password`)

---

## Test/Destroy

```bash
cd terraform
terraform destroy  # Destroys everything except Route53 zone
```

Type `yes` when prompted.

**Note**: Route53 zone stays (still $0.50/month). This is intentional so you can redeploy without reconfiguring DNS.

---

## If Something Goes Wrong

### Check logs on EC2:
```bash
# Get instance IP
cd terraform
terraform output instance_public_ip

# SSH in
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP

# Check initialization
sudo tail -f /var/log/cloud-init-output.log

# Check services
docker ps
docker logs gamifying-education-backend
docker logs gamifying-education-traefik
```

### Fix specific issue without destroying everything:
```bash
# Example: Fix security group
cd terraform
vim security_groups.tf
terraform apply -target=aws_security_group.main
```

### GitHub OIDC Provider Already Exists Error:
```bash
cd terraform
terraform import aws_iam_openid_connect_provider.github \
  arn:aws:iam::$(aws sts get-caller-identity --query Account --output text --profile personal-terraform):oidc-provider/token.actions.githubusercontent.com

terraform apply
```

See `TERRAFORM_DEBUGGING.md` for more.

---

## That's It

Two one-time setup steps (domain from AWS = nameservers already done).

One command to deploy: `terraform apply`

One command to destroy: `terraform destroy`

Everything else is automatic.
