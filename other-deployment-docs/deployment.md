# Deployment Guide

## Prerequisites

1. AWS account with configured credentials
2. Terraform installed
3. Docker installed locally
4. AWS CLI configured

## Initial Setup: Building and Pushing Docker Images to ECR

**IMPORTANT**: Before running `terraform apply`, you must build and push Docker images to ECR. The EC2 instance expects these images to exist.

### Step 1: Authenticate with ECR

```bash
# Get your AWS account ID
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION="us-east-1"  # Change to your region

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | \
  docker login --username AWS --password-stdin \
  $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
```

### Step 2: Build Docker Images Locally

```bash
cd /path/to/gamifying-education

# Build backend image
docker build -t gamifying-education-backend:latest ./backend

# Build frontend image
docker build -t gamifying-education-frontend:latest ./frontend
```

### Step 3: Tag Images for ECR

```bash
# Set ECR repository URLs
ECR_BACKEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gamifying-education-backend"
ECR_FRONTEND="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/gamifying-education-frontend"

# Tag images
docker tag gamifying-education-backend:latest $ECR_BACKEND:latest
docker tag gamifying-education-frontend:latest $ECR_FRONTEND:latest
```

### Step 4: Push Images to ECR

```bash
# Push backend
docker push $ECR_BACKEND:latest

# Push frontend
docker push $ECR_FRONTEND:latest
```

**Expected output**:
```
The push refers to repository [123456789012.dkr.ecr.us-east-1.amazonaws.com/gamifying-education-backend]
abc123def456: Pushed
latest: digest: sha256:... size: 1234
```

### Step 5: Verify Images in ECR

```bash
# List backend images
aws ecr describe-images \
  --repository-name gamifying-education-backend \
  --region $AWS_REGION

# List frontend images
aws ecr describe-images \
  --repository-name gamifying-education-frontend \
  --region $AWS_REGION
```

You should see images with `latest` tag.

## Deploying Infrastructure

Now that images are in ECR, you can deploy the main infrastructure:

```bash
cd terraform
terraform init
terraform apply
```

The EC2 instance will automatically:
1. ✅ Authenticate with ECR using IAM role
2. ✅ Check that images exist (will fail gracefully if not)
3. ✅ Pull images with `docker compose pull`
4. ✅ Start services with `docker compose up -d`
5. ✅ Backend container runs migrations automatically

### What Happens During Deployment

```
EC2 Instance Initialization:
├─ Install Docker & AWS CLI
├─ Clone repository
├─ Create .env file
├─ Authenticate with ECR
├─ Check images exist in ECR
│  ├─ ✓ Found → Continue
│  └─ ✗ Not found → Pause with instructions
├─ Pull images from ECR
├─ Start services with docker compose
│  ├─ Traefik (reverse proxy + SSL)
│  ├─ Backend (FastAPI)
│  │  └─ Runs migrations automatically
│  └─ Frontend (React + Nginx)
└─ Wait for services to be healthy
```

## Troubleshooting

### "ECR images not found" Error

If you see this error in `/var/log/user-data.log`:

**Cause**: Images weren't pushed to ECR before terraform apply.

**Fix**: Follow Steps 1-4 above, then:

```bash
# SSH into instance
ssh -i ~/.ssh/your-key.pem ubuntu@<instance-ip>

# Pull images and start services
cd /opt/gamifying-education
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

### Backend Container Fails to Start

**Check logs**:
```bash
docker compose -f docker-compose.prod.yml logs backend
```

**Common issues**:
- **Database not ready**: Wait 5-10 minutes for RDS initialization
- **Migration failure**: Check database credentials in `.env`
- **Missing environment variables**: Verify all required vars in `.env`

### Images Fail to Pull

**Cause**: IAM permissions issue.

**Check IAM role**:
```bash
# Verify IAM role has ECR permissions
aws sts get-caller-identity

# Test ECR access
aws ecr describe-repositories --region us-east-1
```

**Fix**: Ensure EC2 instance IAM role has ECR read permissions (should be in `terraform/iam.tf`).

### Traefik SSL Certificate Issues

**Check Traefik logs**:
```bash
docker compose -f docker-compose.prod.yml logs traefik
```

**Common issues**:
- **Route 53 DNS challenge fails**: Verify IAM role has Route 53 permissions
- **Domain not resolving**: Check Route 53 A record points to EC2 instance
- **Rate limit**: Let's Encrypt has rate limits; wait before retrying

## Architecture: What Runs Where

### On EC2 Host (Minimal)
- Docker Engine
- AWS CLI
- Git
- **That's it!**

### Inside Docker Containers
- **Backend** (Python + FastAPI + alembic)
  - Runs migrations automatically on startup
  - All Python dependencies installed in container
  - No Python needed on host
- **Frontend** (React + Nginx)
  - Built during Docker build process
  - Served by Nginx
- **Traefik** (Reverse proxy)
  - SSL/TLS termination with Let's Encrypt
  - Routes requests to backend/frontend
- **Database** (PostgreSQL on RDS)
  - Managed by AWS
  - No PostgreSQL client on host

### Why This Approach?

**Advantages**:
- ✅ Clean separation: Host only runs Docker
- ✅ No Python/Node on host = simpler security patching
- ✅ Identical environments (dev/staging/prod)
- ✅ Easy rollbacks: just pull previous image tag
- ✅ Migrations run automatically in container
- ✅ No version conflicts between host and containers

**Previous Issues** (now fixed):
- ❌ Had to install Python on host AND in container
- ❌ Ran migrations on host AND in container (race conditions)
- ❌ Had to keep host Python version in sync with container
- ❌ More packages to patch and maintain on host

## CI/CD: Automated Deployments

Once initial setup is complete, use GitHub Actions for automated deployments:

### Workflow
1. Push code to GitHub
2. GitHub Actions builds Docker images
3. Push images to ECR
4. Trigger deployment on EC2 (via SSH or webhook)

### Deployment Command

On EC2, use the helper script:

```bash
app-deploy
```

This will:
1. Pull latest code from GitHub
2. Authenticate with ECR
3. Pull latest Docker images
4. Restart services with `docker compose up -d`

### Manual Deployment

If you need to deploy manually:

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ubuntu@<instance-ip>

# Navigate to project
cd /opt/gamifying-education

# Pull latest code
git pull

# Authenticate with ECR
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin <ecr-registry>

# Pull and restart
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

## Helper Commands

The EC2 instance has several helper commands installed:

### app-status
Check application status (containers, logs, resources):
```bash
app-status
```

### app-deploy
Deploy latest changes from ECR:
```bash
app-deploy
```

### app-restart
Restart all services:
```bash
app-restart
```

### app-logs
View logs (optionally specify service):
```bash
app-logs              # All services
app-logs backend      # Backend only
app-logs frontend     # Frontend only
app-logs traefik      # Traefik only
```

## Deployment Workflow Diagram

### Initial Deployment
```
Local Machine                  AWS ECR                      EC2 Instance
─────────────                  ───────                      ────────────
1. docker build     ──────>    2. docker push    ──────>   3. docker compose pull
   (backend + frontend)           (store images)               (fetch images)

                                                           4. docker compose up -d
                                                              ├─ DB health check
                                                              ├─ Run migrations (auto)
                                                              ├─ Start backend
                                                              └─ Start frontend
```

### Subsequent Deployments
```
GitHub Actions                 AWS ECR                      EC2 Instance
──────────────                 ───────                      ────────────
1. Build on push    ──────>    2. Push to ECR    ──────>   3. app-deploy command
   (CI pipeline)                  (update images)              ├─ docker compose pull
                                                              └─ docker compose up -d
```

## Accessing Your Application

Once deployment completes:

- **Application URL**: `https://your-domain.com`
- **API Docs**: `https://your-domain.com/docs`
- **Health Check**: `https://your-domain.com/api/v1/utils/health-check/`

Default credentials are set in `terraform.tfvars`:
- **Email**: Value of `first_superuser_email`
- **Password**: Value of `first_superuser_password`

## Monitoring

### Check Service Status
```bash
docker compose -f docker-compose.prod.yml ps
```

### View Logs
```bash
# All services
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f backend
```

### Check Resources
```bash
docker stats
```

### EC2 System Logs
```bash
# User data script logs
tail -f /var/log/user-data.log

# Cloud-init logs
tail -f /var/log/cloud-init-output.log
```

## Rollback

To rollback to a previous version:

```bash
# SSH into EC2
ssh -i ~/.ssh/your-key.pem ubuntu@<instance-ip>

cd /opt/gamifying-education

# Pull specific image tag
docker pull <ecr-registry>/gamifying-education-backend:v1.0.0
docker pull <ecr-registry>/gamifying-education-frontend:v1.0.0

# Update docker-compose to use specific tags (or use tag in .env)
docker compose -f docker-compose.prod.yml up -d

# Check status
docker compose -f docker-compose.prod.yml ps
```

## Security Notes

1. **Secrets Management**: Sensitive values are stored in `terraform.tfvars` (gitignored)
2. **SSL/TLS**: Automatic with Let's Encrypt + Traefik
3. **Firewall**: UFW configured to allow only 22, 80, 443
4. **IAM Roles**: EC2 uses IAM roles (no AWS credentials on instance)
5. **Security Updates**: Unattended upgrades configured automatically

## Cost Optimization

- **Free Tier**: t4g.micro EC2, 30GB storage, 20GB RDS storage
- **ECR**: First 500 MB/month free, then $0.10/GB
- **Data Transfer**: First 100 GB/month free

After free tier:
- **EC2 t4g.micro**: ~$7/month
- **RDS db.t4g.micro**: ~$12/month
- **ECR Storage**: ~$0.50/month (for ~5GB images)
- **Total**: ~$20/month

## Next Steps

1. ✅ Configure custom domain in Route 53
2. ✅ Set up GitHub Actions for CI/CD
3. ✅ Configure monitoring/alerting (CloudWatch)
4. ✅ Set up database backups (RDS automated backups)
5. ✅ Configure log aggregation (CloudWatch Logs)

For more details, see:
- **Development Setup**: `development.md`
- **Project Structure**: `PROJECT_STRUCTURE.md`
- **CLAUDE.md**: AI assistant guidelines
