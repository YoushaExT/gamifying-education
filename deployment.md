# Deployment Guide - Modern AWS Setup

**Primary deployment method**: Modern AWS infrastructure with OIDC authentication and automated CI/CD.

## 🚀 Overview

This project uses a **fully automated AWS deployment** with:
- ✅ EC2 + RDS (managed database)
- ✅ GitHub Actions with **OIDC** (no AWS keys!)
- ✅ Amazon ECR (private Docker registry)
- ✅ Nginx with Let's Encrypt SSL
- ✅ Terraform infrastructure as code
- ✅ SSM Session Manager (no SSH key management)

**Domain**: `devops-assignment.today`

## 📚 Documentation Structure

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **DEPLOYMENT_SUMMARY.md** | Complete overview of both test and production | Start here for big picture |
| **terraform-test/README.md** | Test deployment (hello world) | Before main deployment |
| **terraform/QUICK_START.md** | 5-step production deployment | Quick deployment guide |
| **terraform/CI_CD_SETUP.md** | Complete CI/CD setup | Setting up automated deployments |
| **CI_CD_README.md** | CI/CD quick reference | Quick CI/CD commands |
| **my-deployment.md** | Architecture and cost details | Understanding the setup |

## 🎯 Quick Start Paths

### Path 1: Infrastructure Only (No CI/CD)
**Just deploy the infrastructure and run the app**

```bash
# 1. Test deployment first
cd terraform-test/
# Follow terraform-test/README.md

# 2. Deploy production infrastructure
cd ../terraform/
# Follow terraform/QUICK_START.md
```

**Result**: App running at https://devops-assignment.today
**Deployment**: Manual (SSH to update)

### Path 2: Infrastructure + CI/CD (Recommended)
**Deploy infrastructure AND automated deployments**

```bash
# 1. Deploy infrastructure
cd terraform/
# Follow terraform/QUICK_START.md

# 2. Setup CI/CD
# Follow CI_CD_README.md or terraform/CI_CD_SETUP.md
```

**Result**: App running at https://devops-assignment.today
**Deployment**: Automatic on git push to main!

## 📋 Prerequisites

- AWS account (Free Tier eligible)
- AWS CLI configured
- Terraform installed
- Domain in Route 53: `devops-assignment.today`
- OpenAI API key
- GitHub repository (for CI/CD)

## 🏗️ Architecture

```
GitHub (Code Push)
    ↓ (OIDC Auth)
GitHub Actions
    ↓
Amazon ECR (Docker Images)
    ↓ (SSM Deploy)
EC2 t4g.micro (Public Subnet)
├── Nginx (SSL, Frontend)
└── FastAPI Backend
    ↓
RDS PostgreSQL db.t3.micro (Private Subnet)
    ↓
S3 (Backups)
```

## 💰 Cost

**First Year** (AWS Free Tier):
- With db.t3.micro: ~$6-10/month
- With db.t4g.micro: ~$12-15/month

**After Free Tier**: ~$21/month

**With CI/CD**: Add ~$1-3/month (ECR storage)

See `my-deployment.md` for detailed cost breakdown.

## 🔧 Deployment Steps

### Step 1: Test Deployment (5 minutes)

Verify AWS setup works:

```bash
cd terraform-test/
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your SSH key name
terraform init
terraform apply
# Visit http://<IP> to see "Hello from Terraform!"
terraform destroy  # Clean up
```

**Details**: See `terraform-test/README.md`

### Step 2: Production Infrastructure (15 minutes)

Deploy the full application:

```bash
cd terraform/
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars (see QUICK_START.md)
terraform init
terraform apply
# Wait 12-15 minutes for automatic setup
```

**Access**: https://devops-assignment.today

**Details**: See `terraform/QUICK_START.md`

### Step 3: CI/CD Setup (Optional, 10 minutes)

Enable automatic deployments:

```bash
# 1. Add github_repo to terraform.tfvars
# 2. terraform apply
# 3. Add GitHub secrets (AWS_ROLE_ARN, EC2_INSTANCE_ID)
# 4. Install Docker on EC2
# 5. Push to main branch
```

**Details**: See `CI_CD_README.md` or `terraform/CI_CD_SETUP.md`

## 🔄 Deployment Workflows

### Without CI/CD (Manual)
```bash
# SSH to EC2
ssh -i ~/.ssh/key.pem ubuntu@<IP>

# Pull latest code
cd /opt/gamifying-education
git pull

# Restart services
sudo systemctl restart gamifying-education-backend
sudo systemctl reload nginx
```

### With CI/CD (Automatic)
```bash
# Just push to main!
git push origin main

# GitHub Actions will:
# 1. Build Docker images
# 2. Push to ECR
# 3. Deploy to EC2
# 4. Restart containers
```

## 🛠️ Common Tasks

### Update Application
**With CI/CD**: `git push origin main`

**Without CI/CD**: See manual steps above

### View Logs
```bash
ssh -i ~/.ssh/key.pem ubuntu@<IP>

# Backend logs
sudo journalctl -u gamifying-education-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log

# With Docker (CI/CD):
docker logs -f gamifying-education-backend
```

### Database Backups
```bash
# Automatic: RDS backups (7 days retention)
# Manual: S3 backups (daily at 2 AM)

# Trigger manual backup
ssh -i ~/.ssh/key.pem ubuntu@<IP>
sudo /opt/scripts/backup-db.sh

# List backups
aws s3 ls s3://<bucket-name>/backups/
```

### Rollback Deployment
**With CI/CD**:
```bash
# Revert git commit
git revert HEAD
git push origin main

# Or use specific image
ssh -i ~/.ssh/key.pem ubuntu@<IP>
docker pull <ECR>/<repo>:<old-commit-sha>
docker-compose up -d
```

**Without CI/CD**:
```bash
git checkout <previous-commit>
# Restart services
```

## 🔒 Security Features

✅ OIDC authentication (no AWS access keys)
✅ Private ECR repositories
✅ RDS in private subnet
✅ SSM Session Manager (no SSH key storage)
✅ Let's Encrypt SSL
✅ Security groups (firewall)
✅ IAM roles with least privilege
✅ Image vulnerability scanning

## 📊 Monitoring

### Application Health
```bash
# Check services
ssh -i ~/.ssh/key.pem ubuntu@<IP>
app-status

# Or with Docker
docker ps
docker stats
```

### AWS Console
- **EC2**: Instance status, CPU, network
- **RDS**: Database metrics, connections
- **ECR**: Image vulnerabilities
- **CloudWatch**: Basic metrics (free)

## 🐛 Troubleshooting

### Application not loading
```bash
# Check Nginx
sudo systemctl status nginx
sudo nginx -t

# Check backend
sudo systemctl status gamifying-education-backend

# Check SSL
sudo certbot certificates
```

### Database connection issues
```bash
# Check RDS status in AWS console
# Verify security group allows EC2 → RDS
# Check environment variables
```

### CI/CD deployment fails
- Check GitHub Actions logs
- Verify secrets are set correctly
- Ensure Docker is installed on EC2
- Check SSM agent is running

**Full troubleshooting**: See respective documentation files

## 📁 Project Structure

```
gamifying-education/
├── .github/workflows/
│   └── deploy.yml                # ✅ ACTIVE - OIDC deployment
│
├── terraform/                    # ✅ ACTIVE - Infrastructure
│   ├── *.tf                      # Terraform configs
│   ├── QUICK_START.md           # Quick deployment
│   └── CI_CD_SETUP.md           # CI/CD setup
│
├── terraform-test/               # ✅ ACTIVE - Test deployment
│   └── README.md
│
├── deployment-reference/         # ⚠️ REFERENCE ONLY
│   ├── README.md                # Explanation
│   └── deployment.md            # Old template guide
│
├── backend/
│   └── Dockerfile               # ✅ ACTIVE - Backend image
│
├── frontend/
│   ├── Dockerfile.prod          # ✅ ACTIVE - Frontend image
│   └── nginx.conf               # Nginx config
│
├── docker-compose.prod.yml      # ✅ ACTIVE - Production
├── DEPLOYMENT.md                # ✅ THIS FILE
├── DEPLOYMENT_SUMMARY.md        # Overview
├── CI_CD_README.md              # CI/CD quick ref
└── my-deployment.md             # Architecture details
```

## 🔄 Alternative Deployment (Reference Only)

The original FastAPI template had a **Traefik-based deployment** with SSH.

**This is NOT used** but kept for reference in `deployment-reference/`.

See `deployment-reference/README.md` for differences.

## 🎓 Learning Resources

- **New to Terraform?** Start with `terraform-test/README.md`
- **New to AWS?** Read `DEPLOYMENT_SUMMARY.md`
- **New to Docker?** Check `docker-compose.prod.yml`
- **Want CI/CD?** Read `CI_CD_README.md`

## 🆘 Getting Help

1. Check the relevant documentation file
2. Look at troubleshooting sections
3. Review error messages carefully
4. Check AWS CloudWatch logs

## ✅ Deployment Checklist

**Initial Setup**:
- [ ] AWS account created
- [ ] AWS CLI configured
- [ ] Terraform installed
- [ ] Domain configured in Route 53
- [ ] OpenAI API key obtained
- [ ] SSH key created in AWS

**Test Deployment**:
- [ ] terraform-test deployed successfully
- [ ] Can SSH to test instance
- [ ] Web page shows "Hello from Terraform"
- [ ] terraform-test destroyed

**Production Deployment**:
- [ ] terraform.tfvars configured
- [ ] All passwords generated
- [ ] terraform apply completed
- [ ] Application accessible at https://devops-assignment.today
- [ ] SSL certificate valid
- [ ] Can login with admin credentials
- [ ] Database connections working

**CI/CD Setup** (Optional):
- [ ] github_repo added to terraform.tfvars
- [ ] GitHub secrets configured
- [ ] Docker installed on EC2
- [ ] SSM agent running
- [ ] Test push deploys successfully

## 🚀 Next Steps After Deployment

1. **Test the application** - Create questions, quizzes, play game
2. **Set up monitoring** - AWS CloudWatch, billing alerts
3. **Configure backups** - Verify RDS and S3 backups
4. **Plan updates** - Decide on CI/CD or manual updates
5. **Document customizations** - Track any changes you make

## 📞 Summary

**Quick deployment**: Follow `terraform/QUICK_START.md`
**With CI/CD**: Add steps from `CI_CD_README.md`
**Full details**: Read `DEPLOYMENT_SUMMARY.md`

**Your app will be live at**: https://devops-assignment.today

---

**Status**: ✅ Modern OIDC deployment is ACTIVE
**Template deployment**: ⚠️ Moved to `deployment-reference/` (not used)
