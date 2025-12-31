# Deployment Learnings: From Local to AWS Production

This document captures key lessons learned while deploying the Gamifying Education application to AWS using Terraform, Docker, and ECR.

## Table of Contents
- [Architecture Decisions](#architecture-decisions)
- [Problems Encountered and Solutions](#problems-encountered-and-solutions)
- [Best Practices](#best-practices)
- [Quick Reference](#quick-reference)

---

## Architecture Decisions

### Container-First Approach

**Decision**: Run everything inside Docker containers, minimize host-level dependencies.

**Why**:
- ✅ Clean separation of concerns
- ✅ Identical environments (dev/staging/prod)
- ✅ No version conflicts between host and containers
- ✅ Easy rollbacks (just pull previous image tag)
- ✅ Simpler security patching (patch Docker images, not host)

**What runs where**:
```
EC2 Host (minimal):
├─ Docker Engine
├─ AWS CLI
└─ Git

Docker Containers:
├─ Backend (Python + FastAPI)
│  └─ Runs migrations automatically via prestart.sh
├─ Frontend (React + Nginx)
│  └─ Serves pre-built static files
├─ Traefik (Reverse proxy)
│  └─ Automatic SSL via Let's Encrypt + Route 53
└─ Database (PostgreSQL on RDS)
   └─ Managed by AWS
```

### ECR-Based Deployment

**Decision**: Build images locally/CI, push to ECR, EC2 pulls and runs.

**Why**:
- ✅ Faster deployments (no build time on EC2)
- ✅ Consistent builds (same image across environments)
- ✅ No build tools needed on EC2
- ✅ Easy rollbacks (pull specific image tags)

---

## Problems Encountered and Solutions

### 1. Redundant Host-Level Setup

**Problem**: Original user_data.sh installed Python, created venv, ran migrations on host - but containers already do all this.

**Root Cause**: Script was designed for host-based deployment, not containers.

**Solution**: Removed redundant operations from user_data.sh:
- ❌ Removed: `build-essential`, `libpq-dev`, `postgresql-client`, `python3.12-venv`
- ❌ Removed: Host Python venv setup (uv installation, venv creation)
- ❌ Removed: Host database migrations (`alembic upgrade head` on host)
- ✅ Kept: Docker, AWS CLI, Git only

**Lesson**: In container-based deployments, the host should only run Docker. Everything else happens inside containers.

---

### 2. Missing ECR Integration

**Problem**: user_data.sh had no ECR authentication or image pulling logic.

**Root Cause**: Script assumed images would be built on EC2.

**Solution**: Added ECR workflow to user_data.sh:
```bash
# 1. Authenticate with ECR using IAM role
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY

# 2. Check if images exist (fail gracefully with instructions if not)
check_ecr_image() {
    aws ecr describe-images --repository-name $REPO_NAME --image-ids imageTag=$TAG
}

# 3. Pull images
docker compose pull

# 4. Start services
docker compose up -d
```

**Lesson**: Automate the full deployment flow in user_data.sh, including ECR authentication and graceful failure handling.

---

### 3. Environment Variables Not Loading

**Problem**: docker-compose showed warnings about undefined variables (`DOMAIN_NAME`, `DB_HOST`, etc.)

**Root Cause**: Two issues:
1. docker-compose.prod.yml had `env_file: - ./backend/.env` but .env was at project root
2. Backend service had incorrect environment variable overrides mapping non-existent variables

**Solution**:
```yaml
# Fixed: Use .env at project root
services:
  backend:
    env_file:
      - .env  # Not ./backend/.env
    # Removed incorrect environment overrides
    # environment:
    #   - POSTGRES_SERVER=${DB_HOST}  # DB_HOST doesn't exist!
```

**Lesson**:
- Keep .env at project root, reference it consistently
- Don't override env vars with undefined variables
- Use `docker exec <container> env` to debug what variables containers actually see

---

### 4. Frontend Health Check Failure

**Problem**: Frontend container perpetually "unhealthy", Traefik filtered it out and couldn't discover routes.

**Root Cause**: Health check used `wget` but frontend container only had `curl`.

**Evidence**:
```bash
# Traefik debug logs showed:
"Filtering unhealthy or starting container" container=frontend
```

**Solution**:
```yaml
# Changed from:
healthcheck:
  test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "http://localhost/health"]

# To:
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/health"]
```

**Lesson**:
- Match health check commands to what's actually in the container
- Unhealthy containers are invisible to Traefik (and other service discovery systems)
- Use debug logs to understand why Traefik isn't discovering containers

---

### 5. Traefik Not Discovering Containers

**Problem**: Traefik started but showed 404 for all requests, no router creation logs.

**Root Cause**: Traefik started before frontend became healthy, never re-scanned.

**Evidence**:
```bash
# No logs like:
# "Creating router frontend@docker"
# "Creating service backend@docker"
```

**Solution**: Restart Traefik after other services are healthy:
```bash
docker compose up -d backend frontend  # Start these first
sleep 10  # Wait for health checks
docker compose up -d traefik  # Then start Traefik
```

**Lesson**:
- Traefik's Docker provider watches for container changes, but may miss initial state
- Always check `docker network inspect` to verify containers are on the correct network
- Use `docker exec traefik curl --unix-socket /var/run/docker.sock http://localhost/containers/json` to verify Docker API access

---

### 6. Duplicate API Path (`/api/v1/api/v1/...`)

**Problem**: Frontend made requests to `/api/v1/api/v1/login/access-token` (doubled prefix).

**Root Cause**:
- Generated API client already includes `/api/v1` in all paths
- But `VITE_API_URL` was also set to `/api/v1`
- Frontend code: `${VITE_API_URL}${clientPath}` = `/api/v1` + `/api/v1/login` = doubled!

**Solution**:
```dockerfile
# frontend/Dockerfile
ARG VITE_API_URL=""  # Empty string, not "/api/v1"
ENV VITE_API_URL=${VITE_API_URL}
```

```gitignore
# frontend/.dockerignore
.env  # Prevent local .env from being copied into Docker image
```

**Lesson**:
- Vite environment variables are baked into JavaScript at **build time**, not runtime
- Always check what the generated API client includes vs. what you're prepending
- Use `.dockerignore` to prevent local `.env` files from contaminating production builds

---

### 7. Missing Superuser Creation

**Problem**: Could access login page, but credentials didn't work. No superuser in database.

**Root Cause**: Backend Dockerfile CMD skipped `prestart.sh` script that creates initial data.

**Original Dockerfile**:
```dockerfile
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app ..."]
# ❌ Only runs migrations, doesn't create superuser
```

**Fixed Dockerfile**:
```dockerfile
RUN chmod +x /app/scripts/prestart.sh
CMD ["sh", "-c", "/app/scripts/prestart.sh && uvicorn app.main:app ..."]
# ✅ Runs: DB wait → migrations → initial data → start server
```

**What prestart.sh does**:
```bash
python app/backend_pre_start.py  # Wait for DB to be ready
alembic upgrade head              # Run migrations
python app/initial_data.py        # Create superuser + initial data
```

**Lesson**:
- Don't assume initialization scripts run automatically
- Check container logs for superuser creation messages
- Verify Dockerfile CMD includes all necessary startup steps
- Use `docker exec <container> python app/initial_data.py` to manually create data if needed

---

### 8. Route 53 SSL Certificate Generation Failed

**Problem**: Traefik couldn't obtain Let's Encrypt certificates via Route 53 DNS challenge.

**Error**:
```
AccessDenied: User is not authorized to perform: route53:ListResourceRecordSets
```

**Root Cause**: IAM role missing required Route 53 permission.

**Solution**: Added missing permission to `terraform/iam.tf`:
```hcl
Statement = [
  {
    Effect = "Allow"
    Action = [
      "route53:ListHostedZones",
      "route53:GetChange",
      "route53:ListResourceRecordSets"  # ← Added this
    ]
    Resource = "*"
  }
]
```

**Lesson**:
- Route 53 DNS challenge requires multiple permissions (list, get, change)
- IAM policy updates apply immediately to existing instances (no restart needed)
- Check Traefik logs for specific AWS permission errors

---

### 9. IMDSv2 Access for Docker Containers

**Problem**: Traefik container couldn't access EC2 instance metadata (for IAM credentials).

**Root Cause**: IMDS hop limit was 1, but Docker containers need 2 hops (host → Docker bridge → container).

**Solution**:
```hcl
# terraform/ec2.tf
metadata_options {
  http_tokens                 = "required"  # IMDSv2
  http_put_response_hop_limit = 2           # Changed from 1 to 2
}
```

**Lesson**:
- Docker containers need `http_put_response_hop_limit = 2` to access IMDS
- This affects IAM role credential access for AWS services (ECR, Route 53, etc.)
- Symptom: "no EC2 IMDS role found" errors in container logs

---

## Best Practices

### 1. Environment Variable Management

**Development (.env.example)**:
```bash
VITE_API_URL=http://localhost:8000
POSTGRES_SERVER=localhost
```

**Production (.env on EC2)**:
```bash
VITE_API_URL=                              # Empty for same-domain API
POSTGRES_SERVER=rds-endpoint.aws.com       # RDS endpoint
DOMAIN=yousha.click                        # Not DOMAIN_NAME
```

**Docker Build**:
- Use `.dockerignore` to exclude local `.env` files
- Set production defaults in Dockerfile with `ARG` and `ENV`
- Remember: Vite vars are build-time, not runtime

---

### 2. Health Checks

**Requirements**:
- Command must exist in container (check with `docker exec <container> which curl`)
- Endpoint must actually exist and return 2xx
- Traefik ignores unhealthy containers

**Best Practice**:
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s  # Give migrations time to run
```

---

### 3. Docker Compose Service Startup Order

**Problem**: Traefik needs to discover healthy containers.

**Solution**:
```yaml
# Option 1: Use depends_on with service_healthy
frontend:
  depends_on:
    backend:
      condition: service_healthy

# Option 2: Start manually in correct order
docker compose up -d backend frontend
sleep 10
docker compose up -d traefik
```

---

### 4. Debugging Traefik Discovery Issues

**Step 1**: Verify containers are healthy
```bash
docker compose ps
# All should show "Up X minutes (healthy)"
```

**Step 2**: Check network connectivity
```bash
docker network inspect traefik-public
# Verify all containers appear in "Containers" section
```

**Step 3**: Verify Traefik can access Docker
```bash
docker exec traefik curl --unix-socket /var/run/docker.sock http://localhost/containers/json
# Should return JSON with container details
```

**Step 4**: Check Traefik logs for discovery
```bash
docker compose logs traefik | grep -i "creating\|router\|service"
# Should see: "Creating router backend@docker", etc.
```

**Step 5**: Enable debug logging
```bash
# Add to docker-compose traefik command:
--log.level=DEBUG
```

---

### 5. ECR Image Management

**Initial Setup** (one-time):
```bash
# Build locally
docker build -t backend:latest ./backend
docker build -t frontend:latest ./frontend

# Tag for ECR
docker tag backend:latest $ECR_REGISTRY/backend:latest
docker tag frontend:latest $ECR_REGISTRY/frontend:latest

# Push
docker push $ECR_REGISTRY/backend:latest
docker push $ECR_REGISTRY/frontend:latest
```

**Deployment** (automated):
```bash
# On EC2 (triggered by user_data.sh or manually)
aws ecr get-login-password | docker login --username AWS --password-stdin $ECR_REGISTRY
docker compose pull
docker compose up -d
```

**CI/CD** (GitHub Actions):
```yaml
- Build images in CI
- Push to ECR with git SHA tag
- SSH to EC2 and run deployment script
```

---

### 6. Terraform State Management

**What Changed**:
- user_data.sh modifications require instance replacement
- IAM policy changes apply immediately (no replacement)
- Security group changes apply immediately (no replacement)

**Safe Updates**:
```bash
# Preview changes
terraform plan

# Apply specific resource (if safe)
terraform apply -target=aws_iam_role_policy.route53_policy

# Replace instance with new user_data
terraform apply -replace=aws_instance.main
```

---

## Quick Reference

### Container Status Commands

```bash
# Check all services
docker compose -f docker-compose.prod.yml ps

# Check specific service health
docker inspect --format='{{.State.Health.Status}}' gamifying-education-backend

# View logs
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml logs backend | grep -i error

# Restart specific service
docker compose -f docker-compose.prod.yml restart traefik

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build backend
```

---

### Debugging Commands

```bash
# Check environment variables in container
docker exec <container> env | grep VITE

# Test API from inside container
docker exec backend curl -f http://localhost:8000/api/v1/utils/health-check/

# Check what files are in container
docker exec frontend ls -la /usr/share/nginx/html/

# Verify Docker socket access (from Traefik)
docker exec traefik ls -la /var/run/docker.sock

# Check Traefik discovered containers
docker exec traefik wget -qO- --unix-socket=/var/run/docker.sock http://localhost/containers/json
```

---

### AWS Commands

```bash
# Check current AWS account
aws sts get-caller-identity

# List ECR images
aws ecr describe-images --repository-name gamifying-education-backend

# Get ECR login
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin $ECR_REGISTRY

# Check IAM role policies
aws iam list-role-policies --role-name gamifying-education-ec2-role
aws iam get-role-policy --role-name gamifying-education-ec2-role --policy-name gamifying-education-route53-policy
```

---

### EC2 User Data Debugging

```bash
# SSH to instance
ssh -i ~/.ssh/key.pem ubuntu@<instance-ip>

# Check user_data execution logs
tail -f /var/log/user-data.log

# Check cloud-init logs
tail -f /var/log/cloud-init-output.log

# Check if deployment completed
ls -la /opt/.deployment-complete

# Check if images were missing
cat /opt/.ecr-images-missing
```

---

## Common Gotchas

### 1. Build-time vs Runtime Configuration

**Vite (Frontend)**:
- ❌ `.env` on EC2 doesn't affect running frontend
- ✅ Variables must be set during `docker build`
- ✅ Use `.dockerignore` to prevent local `.env` contamination

**Backend**:
- ✅ `.env` file read at runtime
- ✅ Can change variables and restart container

---

### 2. Traefik Service Discovery

**Traefik discovers containers when**:
- Container starts with `traefik.enable=true` label
- Container is on the configured Docker network
- Container is healthy (if health check defined)

**Traefik DOESN'T discover when**:
- Container is unhealthy
- Traefik started before container existed
- Container not on `traefik-public` network
- Labels malformed or missing

**Fix**: Restart Traefik after containers are healthy

---

### 3. AWS Profile Confusion

**Symptom**: ECR push fails with "not authorized" even though you have credentials.

**Cause**: Using wrong AWS profile (different account).

**Fix**:
```bash
# Set correct profile
export AWS_PROFILE=personal-terraform

# Verify account matches
aws sts get-caller-identity
# Account ID should match ECR registry in error message
```

---

### 4. Docker Image Caching

**Symptom**: Code changes not reflected after rebuild.

**Cause**: Docker using cached layers.

**Fix**:
```bash
docker build --no-cache -t app:latest .
```

---

### 5. SSH Host Key Verification

**Symptom**: "Host key verification failed" after recreating EC2 instance.

**Cause**: New instance has different SSH host key but same IP.

**Fix**:
```bash
ssh-keygen -R <instance-ip>
```

---

## Files Modified Summary

### Terraform
- ✅ `terraform/user_data.sh` - Cleaned up, added ECR automation
- ✅ `terraform/iam.tf` - Added Route 53 permissions
- ✅ `terraform/ec2.tf` - Fixed IMDS hop limit

### Docker Compose
- ✅ `docker-compose.prod.yml` - Fixed env_file paths, removed bad overrides, fixed health check

### Dockerfiles
- ✅ `backend/Dockerfile` - Added prestart.sh execution
- ✅ `frontend/Dockerfile` - Set VITE_API_URL default to empty

### Configuration
- ✅ `frontend/.dockerignore` - Added .env to prevent local config in builds

### Documentation
- ✅ `deployment.md` - Comprehensive deployment guide
- ✅ `deployment_learnings.md` - This document

---

## Deployment Checklist

### Pre-Deployment
- [ ] Build Docker images locally
- [ ] Test images locally with docker-compose
- [ ] Push images to ECR
- [ ] Verify images exist in ECR (`aws ecr describe-images`)
- [ ] Update terraform.tfvars with correct values

### Terraform Deployment
- [ ] Run `terraform plan` and review changes
- [ ] Run `terraform apply`
- [ ] Note EC2 instance public IP from output
- [ ] Wait 5-10 minutes for user_data.sh to complete

### Verification
- [ ] SSH to instance: `ssh -i key.pem ubuntu@<ip>`
- [ ] Check user_data logs: `tail -f /var/log/user-data.log`
- [ ] Verify containers running: `docker compose ps`
- [ ] Check Traefik discovered routes: `docker compose logs traefik | grep "Creating router"`
- [ ] Test health endpoints
- [ ] Verify SSL certificate obtained
- [ ] Test login with superuser credentials

### Post-Deployment
- [ ] Test all major features
- [ ] Verify database migrations applied
- [ ] Check application logs for errors
- [ ] Monitor CloudWatch metrics
- [ ] Update DNS if needed
- [ ] Document any issues encountered

---

## Cost Summary

This deployment session:
- **Total cost**: $12.40
- **Duration**: 3h 22m
- **Code changes**: 1102 lines added, 100 lines removed
- **Infrastructure cost**: ~$20/month (EC2 + RDS + ECR)

---

## Conclusion

The key to successful container-based AWS deployment:

1. **Keep it simple**: Host runs Docker, everything else in containers
2. **Automate everything**: From ECR auth to initial data creation
3. **Debug systematically**: Logs → container status → network → discovery
4. **Build-time vs runtime**: Know which configs need rebuild vs restart
5. **Health checks matter**: Unhealthy = invisible to Traefik
6. **IAM permissions**: More than you think (Route 53 needs multiple permissions)

Most issues came from assumptions about what "just works" - always verify each layer independently.
