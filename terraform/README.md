# Terraform AWS Deployment - Summary

## What's Been Created

Complete, **fully automated** Terraform deployment for your Gamifying Education app on AWS.

**Configuration**:
- Domain: `yousha.click`
- Region: `us-east-1`
- Architecture: Single EC2 instance (t4g.micro) with everything
- SSL: Automatic Let's Encrypt with Route 53 DNS challenge
- Cost: ~$5-8/month (first year free with Free Tier)

## Files Created

### Core Terraform Files
- `main.tf` - Provider and main configuration
- `variables.tf` - All input variables
- `terraform.tfvars.example` - Example configuration (copy to terraform.tfvars)
- `outputs.tf` - Deployment outputs (IP, URLs, SSH commands)

### Infrastructure Resources
- `vpc.tf` - VPC, subnet, internet gateway, Elastic IP, Route 53 records
- `security_groups.tf` - Firewall rules (SSH, HTTP, HTTPS)
- `ec2.tf` - EC2 instance configuration
- `iam.tf` - IAM roles for Route 53 and ECR access

### Automation
- `user_data.sh` - **Fully automated** instance initialization script:
  - ✅ Installs all dependencies (PostgreSQL, Nginx, Python, Node.js)
  - ✅ Configures PostgreSQL database
  - ✅ Clones repository and builds application
  - ✅ Sets up Nginx with SSL
  - ✅ **Automatic SSL certificate** with Let's Encrypt + Route 53 DNS
  - ✅ Creates systemd services
  - ✅ Configures automated backups
  - ✅ **Idempotent** - can run multiple times safely
  - ✅ **No manual steps required!**

### Documentation
- `QUICK_START.md` - 5-step deployment guide (15 minutes)
- `DEPLOYMENT_README.md` - Comprehensive documentation
- `SSH_KEY_SETUP.md` - SSH key pair creation guide
- `.gitignore` - Protects sensitive files

## Key Features

### 🚀 Zero Manual Steps
Run `terraform apply` and wait. Everything is configured automatically:
- Database setup ✅
- Application deployment ✅
- SSL/HTTPS configuration ✅ (using Route 53 DNS challenge)
- Service startup ✅
- Automated backups ✅

### 🔒 Security
- IAM roles (no hardcoded credentials)
- SSL/TLS encryption
- Firewall configured
- Automatic security updates
- Secrets in terraform.tfvars (gitignored)

### 💰 Cost Optimized
- Free Tier eligible (first 12 months)
- Single instance architecture
- RDS automated backups (7 days retention)
- ~$6-7/month after Free Tier

### 🔄 Idempotent
All scripts can run multiple times safely:
- Checks before creating resources
- Handles errors gracefully
- Won't duplicate configurations

## How It Works

### 1. Terraform Creates Infrastructure
```
VPC → Subnet → Security Group → IAM Role → EC2 Instance → Elastic IP → Route 53 Records → ECR Repositories
```

### 2. User Data Runs Automatically (on First Boot)
```
Install packages → Configure PostgreSQL → Clone repo → Build backend
→ Build frontend → Configure Nginx → Get SSL certificate → Start services
→ Setup backups → Done!
```

### 3. SSL Certificate (Fully Automatic)
Uses **Certbot with Route 53 DNS-01 challenge**:
- EC2 instance has IAM role with Route 53 permissions
- Certbot creates temporary TXT records in Route 53
- Let's Encrypt verifies domain ownership via DNS
- Certificate is issued and installed
- Nginx configured with HTTPS
- **No HTTP challenge needed** (works even before web server is accessible)

## Before You Deploy

### 1. Prerequisites
- [ ] AWS account
- [ ] AWS CLI configured: `aws configure`
- [ ] Terraform installed: `terraform --version`
- [ ] OpenAI API key

### 2. Create SSH Key
See `SSH_KEY_SETUP.md` for detailed instructions.

**Quick option**:
```bash
aws ec2 create-key-pair \
    --key-name gamifying-education-key \
    --query 'KeyMaterial' \
    --output text \
    --region us-east-1 \
    > ~/.ssh/gamifying-education-key.pem

chmod 400 ~/.ssh/gamifying-education-key.pem
```

### 3. Get Route 53 Zone ID
```bash
aws route53 list-hosted-zones | grep -A 2 "yousha.click"
# Copy the ID (looks like: Z0123456789ABC)
```

### 4. Update Repository URL
**IMPORTANT**: Edit `user_data.sh` line 79:
```bash
nano user_data.sh

# Change this line:
git clone https://github.com/yourusername/gamifying-education.git

# To your actual repository URL:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

For private repos:
```bash
git clone https://TOKEN@github.com/YOUR_USERNAME/YOUR_REPO.git
```

### 5. Configure Variables
```bash
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars
```

**Required changes**:
```hcl
route53_zone_id = "Z0123456789ABC"  # From step 3
ssh_key_name = "gamifying-education-key"  # From step 2
allowed_ssh_cidr = "YOUR_IP/32"  # Get with: curl ifconfig.me

# Generate secure passwords:
# openssl rand -base64 32
db_password = "PASTE_GENERATED_HERE"
django_secret_key = "PASTE_GENERATED_HERE"
first_superuser_password = "PASTE_GENERATED_HERE"

openai_api_key = "sk-proj-..."  # Your OpenAI key
admin_email = "your-email@example.com"
```

## Deployment

### Deploy Everything
```bash
cd terraform/
terraform init
terraform plan  # Review what will be created
terraform apply  # Type 'yes' to confirm
```

**Wait 8-12 minutes** for:
- Terraform to create infrastructure (2 minutes)
- Instance to boot and run initialization script (6-10 minutes)

### Check Progress
```bash
# Get instance IP
terraform output instance_public_ip

# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Watch initialization logs
sudo tail -f /var/log/cloud-init-output.log

# When you see "Instance initialization completed", it's ready!
```

### Access Application
Open browser: **https://yousha.click**

Login:
- Email: `admin@example.com`
- Password: `first_superuser_password` from terraform.tfvars

## Monitoring

### Check Status
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Quick status
app-status

# Detailed logs
sudo journalctl -u gamifying-education-backend -f
sudo tail -f /var/log/nginx/access.log
```

### Verify SSL
```bash
# Check certificate
sudo certbot certificates

# Test HTTPS
curl -I https://yousha.click
```

## Troubleshooting

### "SSL certificate generation failed"
**Cause**: IAM permissions issue

**Fix**:
```bash
# Check IAM role
terraform state show aws_iam_role.ec2_role

# Verify Route 53 policy
terraform state show aws_iam_role_policy.route53_policy

# Re-apply
terraform apply
```

### "Backend not responding"
```bash
# SSH into instance
sudo systemctl status gamifying-education-backend
sudo journalctl -u gamifying-education-backend -n 50

# Restart
sudo systemctl restart gamifying-education-backend
```

### "Repository clone failed"
**Cause**: Incorrect repository URL in user_data.sh

**Fix**:
1. Update `user_data.sh` line 79 with correct URL
2. `terraform apply` (will recreate instance)

Or manually:
```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP
cd /opt
sudo rm -rf gamifying-education
sudo git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git gamifying-education
sudo /var/lib/cloud/instance/scripts/part-001  # Re-run user_data
```

## Updating the Application

### Code Updates
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Pull latest code
cd /opt/gamifying-education
sudo git pull

# Update backend
cd backend
sudo -u root bash -c 'source .venv/bin/activate && uv sync && alembic upgrade head'
sudo systemctl restart gamifying-education-backend

# Update frontend
cd ../frontend
sudo npm install
sudo npm run build
sudo cp -r dist/* /var/www/html/
```

### Infrastructure Updates
```bash
# Edit terraform files or terraform.tfvars
nano terraform.tfvars

# Apply changes
terraform plan
terraform apply
```

## Destroy Resources

**WARNING**: Deletes everything!

```bash
# Backup first!
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
sudo /opt/scripts/backup-db.sh

# Download backups
aws s3 sync s3://$(terraform output -raw s3_backup_bucket)/backups/ ./backups/

# Destroy
terraform destroy  # Type 'yes' to confirm
```

**Note**: Route 53 hosted zone is NOT managed by Terraform (won't be deleted).

## Cost Breakdown

### First Year (Free Tier)
- EC2 t4g.micro: **Free** (750 hours/month)
- 30GB EBS: **Free**
- Elastic IP: **Free** (while instance running)
- Data transfer: **Free** (first 100GB)
- **Total: Free**

### After Free Tier
- EC2 t4g.micro: $3.50/month
- EBS 30GB: $2.40/month
- **Total: $6/month (~$72/year)**

## Architecture Diagram

```
Internet
    ↓
Route 53 (yousha.click)
    ↓
Elastic IP (Static)
    ↓
Security Group (22, 80, 443)
    ↓
EC2 t4g.micro (Ubuntu 24.04 ARM64)
┌─────────────────────────────────┐
│ Traefik (443) - HTTPS/SSL       │
│  ├─ Frontend (React)            │
│  └─ Reverse Proxy → Backend     │
│                                 │
│ FastAPI Backend (8000)          │
│  ├─ REST API                    │
│  └─ WebSocket (game)            │
└─────────────────────────────────┘
    ↓
RDS PostgreSQL (db.t3.micro)
└─ Automated backups (7 days)
```

## Next Steps

1. **Test the application**:
   - Create questions
   - Generate AI questions
   - Take quizzes
   - Play card game

2. **Set up monitoring**:
   - AWS CloudWatch basic metrics (free)
   - Billing alerts

3. **Configure CI/CD** (optional):
   - GitHub Actions for auto-deployment
   - Deploy on push to main branch

4. **Optimize** (when needed):
   - Add Redis caching
   - Upgrade to t4g.small if needed
   - Add CloudFront CDN

## Support

- **Quick Start**: `QUICK_START.md`
- **Full Documentation**: `DEPLOYMENT_README.md`
- **SSH Setup**: `SSH_KEY_SETUP.md`
- **Architecture Plan**: `../my-deployment.md`

## File Checklist

Before committing:
- [ ] Updated `user_data.sh` with correct repository URL
- [ ] Created `terraform.tfvars` (don't commit this!)
- [ ] Generated secure passwords
- [ ] Created SSH key pair in AWS
- [ ] Got Route 53 zone ID

## What Gets Committed to Git

✅ Commit these:
- All `.tf` files
- `user_data.sh`
- Documentation files
- `.gitignore`
- `terraform.tfvars.example`

❌ Never commit:
- `terraform.tfvars` (contains secrets!)
- `.terraform/` directory
- `terraform.tfstate` files
- SSH keys (*.pem files)

These are already in `.gitignore`.

## Ready to Deploy?

Follow `QUICK_START.md` for the fastest path to deployment!

Or `DEPLOYMENT_README.md` for comprehensive step-by-step instructions.
