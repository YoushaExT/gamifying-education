# CI/CD Pipeline Setup Guide

Complete guide to set up automated deployments with GitHub Actions using OIDC authentication.

## Overview

**Pipeline Flow**:
```
Git Push → GitHub Actions → Build Docker Images → Push to ECR → Deploy to EC2 → Restart Services
```

**Key Features**:
- ✅ **OIDC Authentication** - No AWS access keys stored in GitHub!
- ✅ **Docker-based** - Consistent builds and deployments
- ✅ **Amazon ECR** - Private Docker registry
- ✅ **SSM Session Manager** - Secure deployment without SSH keys
- ✅ **Automatic** - Deploy on push to main branch
- ✅ **Zero downtime** - Health checks ensure smooth transitions

## Architecture

```
┌─────────────────┐
│  GitHub Repo    │
│  (Code Push)    │
└────────┬────────┘
         ↓
┌─────────────────┐
│ GitHub Actions  │ ← Authenticates via OIDC (no keys!)
│ (Build & Test)  │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Amazon ECR      │
│ (Docker Images) │
└────────┬────────┘
         ↓
┌─────────────────┐
│ EC2 Instance    │ ← Deployed via SSM (no SSH!)
│ (Docker        │
│  Containers)    │
└─────────────────┘
```

## Prerequisites

1. ✅ Terraform deployment completed
2. ✅ GitHub repository for your code
3. ✅ Docker installed on EC2 (will be added to user_data)

## Step 1: Update Terraform Configuration

### 1.1 Add GitHub Repo to terraform.tfvars

```bash
cd terraform/
nano terraform.tfvars
```

Add this line:
```hcl
github_repo = "yourusername/gamifying-education"  # Your actual GitHub repo
```

### 1.2 Apply Terraform Changes

```bash
terraform apply
```

This creates:
- 2 ECR repositories (backend + frontend)
- GitHub OIDC provider
- IAM role for GitHub Actions
- Permissions for ECR and SSM

### 1.3 Get Outputs

```bash
terraform output github_actions_role_arn
terraform output ecr_repository_backend
terraform output ecr_repository_frontend
terraform output instance_id
```

Save these values - you'll need them for GitHub secrets.

## Step 2: Install Docker on EC2

SSH into your EC2 instance and install Docker:

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Install Docker
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2
sudo systemctl enable docker
sudo systemctl start docker

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install SSM agent (if not already installed)
sudo snap install amazon-ssm-agent --classic
sudo systemctl enable snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service

# Verify
docker --version
docker-compose version
```

## Step 3: Configure GitHub Repository

### 3.1 Add GitHub Secrets

Go to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

Add these secrets:

| Secret Name | Value | Where to Get It |
|------------|-------|-----------------|
| `AWS_ROLE_ARN` | `arn:aws:iam::...` | `terraform output github_actions_role_arn` |
| `EC2_INSTANCE_ID` | `i-xxxxx` | `terraform output instance_id` |

**Note**: AWS credentials are NOT needed - OIDC handles authentication!

### 3.2 Enable GitHub Actions

1. Go to **Settings → Actions → General**
2. Under "Workflow permissions", select:
   - ✅ **Read and write permissions**
3. Click **Save**

## Step 4: Update Nginx Configuration

Update the Nginx config on EC2 to proxy to Docker containers:

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

sudo nano /etc/nginx/sites-available/gamifying-education
```

Update the backend proxy section:
```nginx
# Backend API (proxying to Docker container)
location /api/ {
    proxy_pass http://127.0.0.1:8000;
    # ... rest of config stays same
}
```

Update the frontend section:
```nginx
# Frontend (proxying to Docker container)
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

Restart Nginx:
```bash
sudo systemctl restart nginx
```

## Step 5: Create Environment File on EC2

Create environment file for Docker Compose:

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

cd /opt/gamifying-education

# Create .env for docker-compose
cat > .env << EOF
ECR_REGISTRY=<YOUR_ACCOUNT_ID>.dkr.ecr.us-east-1.amazonaws.com
ECR_REPOSITORY_BACKEND=gamifying-education-backend
ECR_REPOSITORY_FRONTEND=gamifying-education-frontend

# Database (from your RDS)
DB_HOST=<RDS_ENDPOINT>
DB_NAME=gamifying_education
DB_USER=app_user
DB_PASSWORD=<YOUR_DB_PASSWORD>
EOF
```

## Step 6: Test Deployment

### 6.1 Push to Main Branch

```bash
git add .
git commit -m "Add CI/CD pipeline"
git push origin main
```

### 6.2 Monitor GitHub Actions

1. Go to your repo → **Actions** tab
2. Click on the running workflow
3. Watch the build and deployment progress

### 6.3 Verify Deployment

```bash
# Check containers are running
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
docker ps

# Check logs
docker logs gamifying-education-backend
docker logs gamifying-education-frontend

# Test application
curl https://devops-assignment.today
```

## Workflow Breakdown

The GitHub Actions workflow (`.github/workflows/deploy.yml`) does:

1. **Checkout Code** - Gets latest code
2. **Configure AWS** - Authenticates via OIDC (no keys!)
3. **Login to ECR** - Gets Docker registry credentials
4. **Build Backend** - Creates Docker image with FastAPI
5. **Build Frontend** - Creates Docker image with Nginx + React build
6. **Push to ECR** - Uploads images to private registry
7. **Deploy to EC2** - Uses SSM to pull images and restart containers

## Cost Impact

**ECR Storage**:
- Free Tier: 500MB for 12 months
- After: $0.10/GB/month
- Estimated: ~$1-2/month (with lifecycle policy keeping only 5 images)

**Data Transfer**:
- Pulling images from ECR to EC2: Free (same region)
- Pushing from GitHub Actions: ~$0.01-0.05 per deployment

**Total Additional Cost**: ~$1-3/month

## Rollback

If a deployment fails, rollback to previous version:

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

cd /opt/gamifying-education

# List available images
docker images

# Use specific version
export IMAGE_TAG=<PREVIOUS_COMMIT_SHA>
docker-compose down
docker-compose up -d
```

## Troubleshooting

### "Unable to locate credentials"
**Problem**: OIDC not configured correctly

**Solution**:
1. Check `github_repo` in `terraform.tfvars` matches exactly
2. Verify `AWS_ROLE_ARN` secret in GitHub
3. Re-run `terraform apply`

### "Instance not found" in SSM
**Problem**: SSM agent not running on EC2

**Solution**:
```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
sudo systemctl status snap.amazon-ssm-agent.amazon-ssm-agent.service
sudo systemctl start snap.amazon-ssm-agent.amazon-ssm-agent.service
```

### "Cannot connect to Docker daemon"
**Problem**: Docker not running or permissions issue

**Solution**:
```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
sudo systemctl restart docker
sudo usermod -aG docker ubuntu
# Log out and back in for group changes
```

### Deployment succeeds but app not working
**Problem**: Environment variables or networking

**Solution**:
```bash
# Check container logs
docker logs gamifying-education-backend
docker logs gamifying-education-frontend

# Check container networking
docker network inspect gamifying-education_app-network

# Verify environment variables
docker exec gamifying-education-backend env | grep POSTGRES
```

## Advanced: Manual Deployment

To deploy manually without GitHub Actions:

```bash
# On your local machine
cd backend
docker build -t gamifying-education-backend .

cd ../frontend
docker build -f Dockerfile.prod -t gamifying-education-frontend .

# Tag and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REGISTRY>
docker tag gamifying-education-backend:latest <ECR_REGISTRY>/gamifying-education-backend:latest
docker tag gamifying-education-frontend:latest <ECR_REGISTRY>/gamifying-education-frontend:latest
docker push <ECR_REGISTRY>/gamifying-education-backend:latest
docker push <ECR_REGISTRY>/gamifying-education-frontend:latest

# On EC2
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
cd /opt/gamifying-education
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <ECR_REGISTRY>
docker-compose pull
docker-compose up -d
```

## Monitoring

### View GitHub Actions History

GitHub repo → **Actions** tab → Shows all deployment runs

### View ECR Images

```bash
aws ecr list-images --repository-name gamifying-education-backend
aws ecr list-images --repository-name gamifying-education-frontend
```

### Container Metrics

```bash
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Resource usage
docker stats

# Container logs (follow)
docker logs -f gamifying-education-backend
docker logs -f gamifying-education-frontend
```

## Security Best Practices

✅ **OIDC Authentication** - No long-lived AWS credentials
✅ **Private ECR** - Images not publicly accessible
✅ **Image Scanning** - Automatic vulnerability scanning enabled
✅ **Lifecycle Policy** - Old images automatically deleted
✅ **SSM Session Manager** - No SSH key management needed
✅ **Least Privilege** - IAM roles with minimal permissions

## Next Steps

1. **Add Tests** - Run tests in GitHub Actions before deployment
2. **Staging Environment** - Deploy to staging first, then production
3. **Blue-Green Deployment** - Zero-downtime deployments
4. **CloudWatch Logs** - Send container logs to CloudWatch
5. **Slack/Discord Notifications** - Get notified of deployments

## Alternative: Direct Deployment (No Docker)

If you prefer NOT to use Docker, see `CI_CD_DIRECT.md` for SSH-based deployment.

## Summary

You now have:
- ✅ Automated deployments on git push
- ✅ Secure OIDC authentication (no keys!)
- ✅ Docker containerization
- ✅ Private ECR registry
- ✅ SSM-based deployment (no SSH!)
- ✅ Health checks and rollback capability

**Deploy by pushing to main**:
```bash
git push origin main
```

That's it! 🚀
