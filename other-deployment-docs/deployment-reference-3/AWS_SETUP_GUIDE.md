# AWS Setup Guide for Deployment

Quick reference for getting AWS resources needed for deployment.

**NOTE**: Since `yousha.click` was purchased from AWS, the Route53 hosted zone and nameservers are **already configured**!

## Prerequisites

- AWS Account
- Domain registered (you have: `yousha.click`) - **Bought from AWS** ✓
- AWS CLI installed locally

## 1. Get Your AWS Region

Your terraform is likely using `us-east-1` (check `terraform/terraform.tfvars`).

To verify:
```bash
aws configure get region
```

Common regions:
- `us-east-1` - US East (N. Virginia)
- `us-west-2` - US West (Oregon)
- `eu-west-1` - Europe (Ireland)

## 2. Get Your Route53 Hosted Zone ID

**Since domain was bought from AWS, the hosted zone already exists!**

Get the zone ID:

```bash
aws route53 list-hosted-zones --query "HostedZones[?Name=='yousha.click.'].Id" --output text --profile personal-terraform
```

Or in AWS Console:
1. Go to Route 53 → Hosted zones
2. Click on `yousha.click`
3. Copy the **Hosted zone ID** (looks like `Z1234567890ABC`)

**Nameservers**: Already configured automatically by AWS since domain was purchased through Route53! ✓

<details>
<summary>Verify nameservers (optional)</summary>

```bash
dig yousha.click NS +short
# Should show AWS nameservers like ns-####.awsdns-##.org
```

If you see AWS nameservers, you're good!
</details>

## 3. Get ECR Repository URLs

These are **automatically created by terraform** and available as outputs:

```bash
cd terraform
terraform output ecr_repository_backend
terraform output ecr_repository_frontend
```

Example output:
```
123456789012.dkr.ecr.us-east-1.amazonaws.com/gamifying-education-backend
123456789012.dkr.ecr.us-east-1.amazonaws.com/gamifying-education-frontend
```

These are used in:
- GitHub Actions (to push images)
- EC2 instance (to pull images)

## 4. Get Database Credentials

These are **set in terraform variables** and created by terraform:

```bash
cd terraform
terraform output rds_endpoint      # Database host
terraform output rds_database_name # Database name
terraform output rds_username      # Database username
```

The password is in your `terraform/terraform.tfvars` (not shown in outputs for security).

Example:
```
rds_endpoint = "gamifying-education-db.abc123.us-east-1.rds.amazonaws.com:5432"
rds_database_name = "gamifying_education"
rds_username = "app_user"
```

## 5. Environment Variable Summary

Here's where each variable comes from:

| Variable | Source | How to Get |
|----------|--------|------------|
| `DOMAIN_NAME` | You provide | `yousha.click` |
| `ADMIN_EMAIL` | You provide | `yousha234@gmail.com` |
| `AWS_REGION` | Your choice | Check `terraform/terraform.tfvars` |
| `AWS_HOSTED_ZONE_ID` | Terraform output | `terraform output` after applying |
| `ECR_REGISTRY` | Terraform output | Part of ECR repository URL |
| `ECR_REPOSITORY_BACKEND` | Terraform output | `terraform output ecr_repository_backend` |
| `ECR_REPOSITORY_FRONTEND` | Terraform output | `terraform output ecr_repository_frontend` |
| `DB_HOST` | Terraform output | `terraform output rds_endpoint` |
| `DB_NAME` | Terraform output | `terraform output rds_database_name` |
| `DB_USER` | Terraform output | `terraform output rds_username` |
| `DB_PASSWORD` | terraform.tfvars | Value you set in `db_password` |

## 6. Terraform Variable Setup

Your `terraform/terraform.tfvars` should look like:

```hcl
# AWS Configuration
aws_region = "us-east-1"  # Change to your preferred region

# Project
project_name = "gamifying-education"

# Domain
domain_name = "yousha.click"
route53_zone_id = "Z1234567890ABC"  # Get from Route53 after creating zone

# SSH Key (for EC2 access)
ssh_key_name = "gamifying-education-key"

# Database
db_password = "your-secure-password-here"  # CHANGE THIS

# Application
first_superuser_email = "yousha234@gmail.com"
first_superuser_password = "your-admin-password"  # CHANGE THIS
openai_api_key = "sk-..."  # Your OpenAI API key

# Email (for Traefik Let's Encrypt)
admin_email = "yousha234@gmail.com"

# GitHub (for CI/CD)
github_repo_owner = "your-github-username"
github_repo_name = "gamifying-education"
```

## 7. AWS Credentials for Local Terraform

You need AWS credentials to run terraform locally:

### Option A: AWS CLI Configure (Recommended)
```bash
aws configure
```
Enter:
- AWS Access Key ID
- AWS Secret Access Key
- Default region (e.g., us-east-1)
- Default output format (json)

### Option B: Environment Variables
```bash
export AWS_ACCESS_KEY_ID="YOUR_KEY"
export AWS_SECRET_ACCESS_KEY="YOUR_SECRET"
export AWS_DEFAULT_REGION="us-east-1"
```

### Creating AWS Access Keys:
1. AWS Console → IAM → Users → Your User
2. Security credentials tab
3. Create access key
4. Choose "Command Line Interface (CLI)"
5. Download/copy the keys

**Security**: Give your IAM user these permissions:
- `AdministratorAccess` (for initial setup)
- Or specific policies: EC2, RDS, Route53, S3, IAM, ECR

## 8. Initial Deployment Steps

```bash
# 1. Set up terraform variables
cd terraform
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your values

# 2. Initialize terraform
terraform init

# 3. Plan deployment (review changes)
terraform plan

# 4. Apply deployment (create resources)
terraform apply

# 5. Get outputs (save these)
terraform output > outputs.txt

# 6. SSH into EC2 instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# 7. Check deployment progress on EC2
sudo tail -f /var/log/cloud-init-output.log

# 8. Once complete, check services
app-status

# 9. Access your application
# https://yousha.click
```

## 9. GitHub Actions Setup (CI/CD)

After terraform creates resources, add these secrets to GitHub:

```bash
cd terraform

# Get the role ARN
terraform output github_actions_role_arn
```

Add to GitHub repo → Settings → Secrets and variables → Actions:

| Secret Name | Value | Source |
|-------------|-------|--------|
| `AWS_ROLE_ARN` | `arn:aws:iam::...` | Terraform output |
| `AWS_REGION` | `us-east-1` | Your region |
| `ECR_BACKEND_REPO` | `123...backend` | Terraform output |
| `ECR_FRONTEND_REPO` | `123...frontend` | Terraform output |
| `EC2_INSTANCE_ID` | `i-abc123` | Terraform output |

GitHub Actions will use OIDC to assume the role (no long-lived credentials needed).

## 10. Verification Checklist

After deployment, verify:

- [ ] Domain nameservers point to AWS (already done since domain from AWS) ✓
  ```bash
  dig yousha.click NS +short
  # Should show AWS nameservers
  ```

- [ ] Route53 hosted zone exists (already exists since domain from AWS) ✓
  ```bash
  aws route53 list-hosted-zones | grep yousha.click
  ```

- [ ] ECR repositories created
  ```bash
  aws ecr describe-repositories
  ```

- [ ] RDS instance running
  ```bash
  aws rds describe-db-instances --query "DBInstances[0].{Endpoint:Endpoint.Address,Status:DBInstanceStatus}"
  ```

- [ ] EC2 instance running
  ```bash
  aws ec2 describe-instances --filters "Name=tag:Name,Values=gamifying-education" --query "Reservations[0].Instances[0].State.Name"
  ```

- [ ] S3 backup bucket exists
  ```bash
  aws s3 ls
  ```

- [ ] Application accessible
  ```bash
  curl -I https://yousha.click
  ```

## Troubleshooting

### Can't connect to EC2
```bash
# Check instance is running
aws ec2 describe-instances --instance-ids $(terraform output -raw instance_id)

# Check security group allows SSH (port 22)
aws ec2 describe-security-groups --group-ids $(terraform output -raw security_group_id)

# Verify key permissions
chmod 400 ~/.ssh/gamifying-education-key.pem
```

### Can't access application
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Check services
sudo systemctl status docker
docker ps

# Check logs
app-logs
```

### Terraform errors
```bash
# State issues
terraform init -reconfigure

# Lock issues
terraform force-unlock LOCK_ID

# Start fresh (CAREFUL - deletes resources)
terraform destroy
terraform apply
```

## Cost Estimates

Approximate monthly costs (us-east-1):

| Service | Size | Monthly Cost |
|---------|------|--------------|
| EC2 (t3.medium) | 2 vCPU, 4 GB RAM | ~$30 |
| RDS (db.t3.micro) | PostgreSQL | ~$15 |
| Elastic IP | 1 static IP | $0 (while attached) |
| Route53 | 1 hosted zone | $0.50 |
| S3 | Backups (~10 GB) | ~$0.23 |
| Data Transfer | ~10 GB out | ~$0.90 |
| **Total** | | **~$47/month** |

ECR storage: First 500 MB free, then $0.10/GB/month.

## Security Best Practices

1. **Rotate secrets regularly**: Database passwords, API keys
2. **Use IAM roles** instead of access keys where possible
3. **Enable MFA** on your AWS account
4. **Regular backups**: Automated daily to S3 (already configured)
5. **Monitor costs**: Set up billing alerts in AWS
6. **Review IAM permissions**: Principle of least privilege
7. **Keep terraform state secure**: Consider using S3 backend with encryption

## Next Steps

After deployment:
1. Monitor instance with CloudWatch
2. Set up log aggregation (CloudWatch Logs)
3. Configure RDS automated backups (already enabled)
4. Set up monitoring/alerting (CloudWatch alarms)
5. Test disaster recovery (restore from backup)
6. Document runbooks for common operations

## Useful Links

- [AWS CLI Installation](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [ECR Documentation](https://docs.aws.amazon.com/ecr/)
- [RDS Documentation](https://docs.aws.amazon.com/rds/)
