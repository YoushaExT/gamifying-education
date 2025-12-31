# CI/CD Pipeline - Quick Summary

Automated deployment pipeline using GitHub Actions with OIDC authentication (no AWS keys needed!).

## 🚀 What's Set Up

### Pipeline Flow
```
Git Push to main → GitHub Actions → Build Docker Images → Push to ECR → Deploy to EC2
```

### Key Features
- ✅ **OIDC Authentication** - Secure, no long-lived AWS credentials
- ✅ **Docker Containers** - Backend + Frontend in separate containers
- ✅ **Amazon ECR** - Private Docker registry
- ✅ **SSM Session Manager** - Deployment without SSH keys
- ✅ **Automatic on Push** - Deploys when you push to `main` branch
- ✅ **Health Checks** - Ensures containers are healthy

## 📁 Files Created

```
.github/workflows/
└── deploy.yml                 # GitHub Actions workflow

backend/
└── Dockerfile                 # Backend Docker image

frontend/
├── Dockerfile.prod           # Frontend Docker image
└── nginx.conf                # Nginx config for frontend

docker-compose.prod.yml        # Production Docker Compose

terraform/
├── ecr.tf                    # ECR repositories
├── github_oidc.tf            # OIDC provider + IAM role
└── CI_CD_SETUP.md            # Complete setup guide
```

## 🔧 Quick Setup (5 steps)

### 1. Update Terraform

Add to `terraform/terraform.tfvars`:
```hcl
github_repo = "yourusername/gamifying-education"
```

Apply:
```bash
cd terraform/
terraform apply
```

### 2. Get Terraform Outputs

```bash
terraform output github_actions_role_arn  # Copy this
terraform output instance_id               # Copy this
```

### 3. Add GitHub Secrets

Go to GitHub repo → **Settings → Secrets and variables → Actions**

Add secrets:
- `AWS_ROLE_ARN` = (from terraform output)
- `EC2_INSTANCE_ID` = (from terraform output)

### 4. Install Docker on EC2

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu

# Install SSM Agent
sudo snap install amazon-ssm-agent --classic
sudo systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service

# Create environment file
cd /opt/gamifying-education
nano .env
# Add:
# ECR_REGISTRY=<account-id>.dkr.ecr.us-east-1.amazonaws.com
# ECR_REPOSITORY_BACKEND=gamifying-education-backend
# ECR_REPOSITORY_FRONTEND=gamifying-education-frontend
# DB_HOST=<rds-endpoint>
# DB_NAME=gamifying_education
# DB_USER=app_user
# DB_PASSWORD=<your-db-password>
```

### 5. Push to Deploy!

```bash
git add .
git commit -m "Setup CI/CD"
git push origin main
```

Watch it deploy in GitHub → **Actions** tab! 🎉

## 📊 Cost Impact

**ECR Storage**: ~$1-2/month
- Free Tier: 500MB for 12 months
- Lifecycle policy keeps only 5 recent images

**Total Additional**: ~$1-3/month

## 🔍 How It Works

### GitHub Actions Workflow

1. **Trigger**: Push to `main` branch
2. **Authenticate**: Uses OIDC to assume AWS role (no keys!)
3. **Build**: Creates Docker images for backend + frontend
4. **Push**: Uploads images to private ECR
5. **Deploy**: Uses SSM to pull images on EC2 and restart

### Security Features

- ✅ No AWS access keys stored anywhere
- ✅ OIDC temporary credentials only
- ✅ Private ECR repositories
- ✅ Image vulnerability scanning enabled
- ✅ SSM Session Manager (no SSH key management)
- ✅ IAM roles with least privilege

## 📝 Manual Deployment

If you need to deploy manually:

```bash
# Build locally
cd backend && docker build -t backend .
cd ../frontend && docker build -f Dockerfile.prod -t frontend .

# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REGISTRY>
docker tag backend:latest <ECR_REGISTRY>/gamifying-education-backend:latest
docker tag frontend:latest <ECR_REGISTRY>/gamifying-education-frontend:latest
docker push <ECR_REGISTRY>/gamifying-education-backend:latest
docker push <ECR_REGISTRY>/gamifying-education-frontend:latest

# Deploy on EC2
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
cd /opt/gamifying-education
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## 🐛 Troubleshooting

**"Unable to locate credentials"**
→ Check `github_repo` in terraform.tfvars matches exactly

**"Instance not found in SSM"**
→ Make sure SSM agent is running on EC2

**"Cannot connect to Docker daemon"**
→ Restart docker: `sudo systemctl restart docker`

**Deployment succeeded but app not working**
→ Check container logs: `docker logs gamifying-education-backend`

## 📚 Full Documentation

See `terraform/CI_CD_SETUP.md` for:
- Detailed step-by-step setup
- Architecture diagrams
- Advanced configuration
- Rollback procedures
- Monitoring setup

## 🎯 What You Get

After setup:
- ✅ Push to `main` → Automatic deployment
- ✅ No SSH keys to manage
- ✅ No AWS credentials to rotate
- ✅ Docker containerization
- ✅ Health checks and monitoring
- ✅ Easy rollbacks

**Just push and deploy!** 🚀

## Alternative Approaches

If you prefer:
- **No Docker**: Use direct SSH deployment (ask me to create this)
- **Different branch**: Change `branches:` in `.github/workflows/deploy.yml`
- **Manual approval**: Add environment protection rules in GitHub
- **Staging first**: Create separate workflow for staging environment

## Next Steps

1. Test the pipeline by pushing to main
2. Monitor first deployment in GitHub Actions
3. Verify containers are running: `docker ps`
4. Access your app: https://yousha.click
5. Set up staging environment (optional)
6. Add tests to workflow (optional)
