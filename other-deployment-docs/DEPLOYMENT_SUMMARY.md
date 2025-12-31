# AWS Deployment - Complete Setup ✅

Your low-cost AWS deployment infrastructure is ready!

## 📦 What's Been Created

### 1. Test Deployment (`terraform-test/`)
**Purpose**: Verify AWS setup works before main deployment

**What it creates**:
- Single EC2 instance (t2.micro - FREE with Free Tier)
- Simple Nginx web server
- "Hello from Terraform!" test page
- Uses default VPC (simple setup)

**Time to deploy**: 3 minutes
**Cost**: $0 (Free Tier)

```bash
cd terraform-test/
terraform init
terraform apply
# Visit http://<INSTANCE_IP> to see test page
terraform destroy  # Clean up when done
```

### 2. Production Deployment (`terraform/`)
**Purpose**: Full application deployment with all features

**What it creates**:
- Complete VPC with public + private subnets
- EC2 t4g.micro (ARM64) with:
  - FastAPI backend
  - React frontend
  - Nginx web server
- **RDS PostgreSQL db.t4g.micro** (managed database):
  - Automated backups (7 days)
  - Point-in-time recovery
  - Performance Insights
- **Automatic SSL** with Let's Encrypt (Route 53 DNS)
- S3 bucket for supplemental backups
- IAM roles for security
- Route 53 DNS records

**Time to deploy**: 12-15 minutes (fully automatic!)
**Cost**: ~$12-20/month (~$6-10/month first year with db.t3.micro Free Tier)

```bash
cd terraform/
# Follow QUICK_START.md
terraform init
terraform apply
# Access: https://yousha.click
```

## 🎯 Your Configuration

**Domain**: `yousha.click` (Route 53)
- ✅ NOT managed by Terraform (safe from accidental deletion)
- ✅ DNS records WILL be created/updated by Terraform

**Region**: `us-east-1`

**SSL**: Automatic with Let's Encrypt + Route 53 DNS challenge
- ✅ No manual steps needed
- ✅ Auto-renews every 90 days
- ✅ Works immediately on deployment

## 📋 Recommended Workflow

### Step 1: Test Your Setup (5 minutes)
Start with the test deployment to verify everything works:

```bash
cd terraform-test/

# 1. Create SSH key (if you haven't)
aws ec2 create-key-pair \
    --key-name gamifying-education-key \
    --query 'KeyMaterial' \
    --output text \
    --region us-east-1 \
    > ~/.ssh/gamifying-education-key.pem
chmod 400 ~/.ssh/gamifying-education-key.pem

# 2. Configure
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Set ssh_key_name

# 3. Deploy
terraform init
terraform plan
terraform apply

# 4. Test
# SSH: ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<IP>
# Web: http://<IP> (wait 2 minutes for nginx)

# 5. Clean up
terraform destroy
```

**Success criteria**:
- ✅ `terraform apply` completes without errors
- ✅ Can SSH to instance
- ✅ Web page shows "Hello from Terraform!"
- ✅ `terraform destroy` removes everything

### Step 2: Get Route 53 Zone ID (1 minute)

```bash
aws route53 list-hosted-zones | grep -A 2 "yousha.click"
# Copy the zone ID (looks like: Z0123456789ABC)
```

### Step 3: Update Repository URL (1 minute)

Edit `terraform/user_data.sh` line 79:
```bash
nano terraform/user_data.sh

# Change:
git clone https://github.com/yourusername/gamifying-education.git

# To your actual repo:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

### Step 4: Deploy Production (3 minutes setup + 10 minutes automatic)

```bash
cd terraform/

# 1. Configure
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars

# Update these:
route53_zone_id = "Z..."  # From Step 2
ssh_key_name = "gamifying-education-key"
allowed_ssh_cidr = "$(curl -s ifconfig.me)/32"

# Generate passwords:
openssl rand -base64 32  # db_password
openssl rand -base64 32  # django_secret_key
openssl rand -base64 32  # first_superuser_password

# Add OpenAI key:
openai_api_key = "sk-proj-..."

# 2. Deploy
terraform init
terraform plan
terraform apply

# 3. Wait 10-12 minutes for automatic setup
# 4. Access: https://yousha.click
```

## 🚀 What Happens Automatically

When you run `terraform apply` on the main deployment:

1. **Infrastructure Creation** (5-7 minutes)
   - VPC, public + private subnets, security groups
   - **RDS PostgreSQL instance** (5-10 minutes)
   - EC2 instance launched
   - Elastic IP assigned
   - Route 53 DNS records created
   - S3 backup bucket created

2. **Instance Initialization** (7-10 minutes) - **ALL AUTOMATIC!**
   - Updates system packages
   - Installs: Nginx, Python, Node.js, Certbot, PostgreSQL client
   - **Waits for RDS database to be ready**
   - Clones your repository
   - Builds backend (FastAPI + dependencies)
   - **Runs database migrations on RDS**
   - Builds frontend (React + Vite)
   - Configures Nginx
   - **Gets SSL certificate** (Route 53 DNS challenge)
   - Updates Nginx with HTTPS
   - Starts all services
   - Sets up supplemental S3 backups (daily at 2 AM)

3. **Result** ✨
   - Application live at: https://yousha.click
   - All services running
   - HTTPS working
   - RDS automated backups active (7 days retention)
   - S3 supplemental backups scheduled

**No SSH needed. No manual steps. Just wait 12-15 minutes!**

## 📊 Cost Breakdown

### Test Deployment
- **Cost**: $0 (Free Tier t2.micro)
- **Usage**: < 1 hour
- **Safe to run**: Anytime within Free Tier limits

### Production Deployment

**First Year (AWS Free Tier)**:

**Option A: db.t3.micro (Recommended for Year 1)**
- EC2 t4g.micro: FREE (750 hours/month for 12 months)
- RDS db.t3.micro: FREE (750 hours/month for 12 months)
- 30GB EBS: FREE
- 20GB RDS Storage: FREE
- Elastic IP: FREE (while instance running)
- Data transfer: FREE (first 100GB/month)
- S3 backups: ~$0.50/month
- Route 53 queries: FREE (first million/month)
- **Total Year 1: ~$6-10/month (~$75-120/year)**

**Option B: db.t4g.micro (Better long-term cost)**
- EC2 t4g.micro: FREE (750 hours/month for 12 months)
- RDS db.t4g.micro: ~$12/month (no Free Tier for ARM)
- Everything else: FREE or minimal
- **Total Year 1: ~$12-15/month (~$150-180/year)**

**After Free Tier (Month 13+)**:
- EC2 t4g.micro: $3.50/month
- EBS 30GB gp3: $2.40/month
- **RDS db.t4g.micro: ~$12/month** (switch from t3 to t4g for long-term savings)
- **RDS Storage 20GB: ~$2.30/month**
- Elastic IP: FREE
- Data transfer: FREE (first 100GB)
- S3 backups: $0.50/month
- Route 53 queries: $0.40/month
- **Total: ~$21/month = ~$250/year**

**Recommendation**: Use `db.t3.micro` first year (Free Tier), switch to `db.t4g.micro` after for lower ongoing cost

## 📁 File Structure

```
gamifying-education/
├── terraform-test/          # 🧪 Test deployment (hello world)
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── terraform.tfvars.example
│   └── README.md
│
├── terraform/               # 🚀 Production deployment
│   ├── main.tf             # Provider config
│   ├── variables.tf        # All variables
│   ├── vpc.tf              # VPC, public + private subnets
│   ├── security_groups.tf  # Firewall rules (EC2, RDS)
│   ├── ec2.tf              # EC2 instance
│   ├── rds.tf              # RDS PostgreSQL
│   ├── iam.tf              # IAM roles (Route 53, S3)
│   ├── s3.tf               # Backup bucket
│   ├── outputs.tf          # Deployment info + RDS endpoint
│   ├── user_data.sh        # 🔥 Automatic setup script
│   ├── terraform.tfvars.example
│   ├── README.md           # Main docs
│   ├── QUICK_START.md      # 5-step guide
│   ├── DEPLOYMENT_README.md # Comprehensive guide
│   └── SSH_KEY_SETUP.md    # SSH key guide
│
├── my-deployment.md         # Deployment plan (this was the first doc)
└── DEPLOYMENT_SUMMARY.md    # This file
```

## 🔒 Security Features

✅ **No hardcoded credentials** - Uses IAM roles
✅ **SSL/TLS encryption** - Let's Encrypt
✅ **Firewall configured** - Security groups
✅ **SSH restricted** - Can restrict to your IP
✅ **Secrets in gitignored files** - terraform.tfvars
✅ **Automatic updates** - Unattended-upgrades
✅ **Encrypted backups** - S3 encryption at rest
✅ **Route 53 protected** - NOT managed by Terraform

## 🛠️ Monitoring & Maintenance

### Check Status
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Quick status check
app-status

# Individual services
sudo systemctl status gamifying-education-backend
sudo systemctl status nginx
sudo systemctl status postgresql

# Logs
sudo journalctl -u gamifying-education-backend -f
sudo tail -f /var/log/nginx/access.log
```

### Update Application
```bash
# SSH into instance
cd /opt/gamifying-education
sudo git pull

# Update backend
cd backend
sudo -u root bash -c 'source .venv/bin/activate && uv sync && alembic upgrade head'
sudo systemctl restart gamifying-education-backend

# Update frontend
cd ../frontend
sudo npm install && sudo npm run build
sudo cp -r dist/* /var/www/html/
```

### Manual Backup
```bash
# SSH into instance
sudo /opt/scripts/backup-db.sh

# Download backups
aws s3 ls s3://$(terraform output -raw s3_backup_bucket)/backups/
aws s3 sync s3://$(terraform output -raw s3_backup_bucket)/backups/ ./local-backups/
```

## 🔄 Idempotent Design

The deployment is **idempotent** - you can run `terraform apply` multiple times safely:

✅ Won't duplicate resources
✅ Won't fail if already configured
✅ Updates only what changed
✅ Safe to re-run user_data script

## 🗑️ Cleanup

### Test Deployment
```bash
cd terraform-test/
terraform destroy  # Type 'yes'
```

### Production Deployment
```bash
# ⚠️ WARNING: This deletes everything!

# 1. Backup first
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
sudo /opt/scripts/backup-db.sh
exit

# 2. Download backups
aws s3 sync s3://$(terraform output -raw s3_backup_bucket)/backups/ ./backups/

# 3. Destroy
cd terraform/
terraform destroy  # Type 'yes'
```

**Note**: Route 53 hosted zone is NOT deleted (as designed).

## 📚 Documentation Index

| File | Purpose | When to Use |
|------|---------|-------------|
| `terraform-test/README.md` | Test deployment guide | Before main deployment |
| `terraform/QUICK_START.md` | Fast 5-step guide | Quick deployment |
| `terraform/DEPLOYMENT_README.md` | Comprehensive guide | Detailed walkthrough |
| `terraform/SSH_KEY_SETUP.md` | SSH key creation | Setting up SSH |
| `terraform/README.md` | Technical overview | Understanding setup |
| `my-deployment.md` | Architecture plan | Understanding architecture |
| `DEPLOYMENT_SUMMARY.md` | This file | Overview & workflow |

## ✅ Checklist

### Before Test Deployment
- [ ] AWS account created
- [ ] AWS CLI installed: `aws --version`
- [ ] AWS credentials configured: `aws configure`
- [ ] Terraform installed: `terraform --version`

### Before Production Deployment
- [ ] Test deployment successful
- [ ] SSH key created in AWS
- [ ] Route 53 zone ID obtained
- [ ] OpenAI API key ready
- [ ] Repository URL updated in user_data.sh
- [ ] terraform.tfvars configured

### After Deployment
- [ ] Application accessible at https://yousha.click
- [ ] Can login with admin credentials
- [ ] SSL certificate valid (check browser padlock)
- [ ] Backend API responding: `curl https://yousha.click/api/v1/health`
- [ ] Database working (create test question)
- [ ] Backups running (check S3 bucket)

## 🆘 Troubleshooting

### Test Deployment Issues
See `terraform-test/README.md` - Troubleshooting section

### Production Deployment Issues
See `terraform/DEPLOYMENT_README.md` - Troubleshooting section

### Common Issues

**"No valid credential sources"**
```bash
aws configure
aws sts get-caller-identity  # Verify
```

**"InvalidKeyPair.NotFound"**
```bash
aws ec2 describe-key-pairs --region us-east-1
# Update terraform.tfvars with correct key name
```

**"SSL certificate failed"**
```bash
# Check IAM permissions
terraform state show aws_iam_role_policy.route53_policy

# Manually retry SSL
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<IP>
sudo certbot certificates
sudo /var/lib/cloud/instance/scripts/part-001  # Re-run user_data
```

## 🚀 Ready to Deploy?

### Test First (Recommended)
```bash
cd terraform-test/
# Follow terraform-test/README.md
```

### Then Production
```bash
cd terraform/
# Follow terraform/QUICK_START.md
```

## 📞 Support Resources

- AWS Free Tier: https://aws.amazon.com/free/
- Terraform Docs: https://www.terraform.io/docs
- Let's Encrypt: https://letsencrypt.org/
- FastAPI Docs: https://fastapi.tiangolo.com/

## 🎉 Success!

When you see:
- ✅ `terraform apply` completes
- ✅ Browser shows your app at https://yousha.click
- ✅ Green padlock (HTTPS working)
- ✅ Can login with admin credentials

**You're done! Your app is live on AWS!** 🚀

---

**Estimated Time**:
- Test: 10 minutes
- Production: 20 minutes
- **Total: 30 minutes from start to live app!**
