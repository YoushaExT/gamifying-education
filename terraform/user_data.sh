#!/bin/bash
# Don't use 'set -e' to make script more idempotent - handle errors per command

# Log all output
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "=== Starting instance initialization at $(date) ==="

# Prevent re-running if already completed
if [ -f /opt/.deployment-complete ]; then
    echo "=== Deployment already completed, skipping initialization ==="
    exit 0
fi

# Update system
echo "=== Updating system packages ==="
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y || true

# Install essential packages
echo "=== Installing essential packages ==="
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    git \
    curl \
    wget \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release \
    unzip

# Install AWS CLI v2 (not available in apt for ARM64)
echo "=== Installing AWS CLI v2 ==="
if ! command -v aws &> /dev/null; then
    cd /tmp
    curl "https://awscli.amazonaws.com/awscli-exe-linux-aarch64.zip" -o "awscliv2.zip"
    unzip -q awscliv2.zip
    ./aws/install
    rm -rf aws awscliv2.zip
fi

# Install Docker
echo "=== Installing Docker ==="
if ! command -v docker &> /dev/null; then
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc

    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      tee /etc/apt/sources.list.d/docker.list > /dev/null

    # Install Docker Engine
    apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        docker-ce \
        docker-ce-cli \
        containerd.io \
        docker-buildx-plugin \
        docker-compose-plugin

    # Start Docker
    systemctl enable docker
    systemctl start docker

    # Add ubuntu user to docker group
    usermod -aG docker ubuntu
    echo "Ubuntu user added to docker group"
else
    echo "Docker already installed"
fi

# Configure firewall
echo "=== Configuring firewall ==="
ufw --force enable || true
ufw default deny incoming || true
ufw default allow outgoing || true
ufw allow 22/tcp || true   # SSH
ufw allow 80/tcp || true   # HTTP
ufw allow 443/tcp || true  # HTTPS

# Clone repository
echo "=== Cloning repository ==="
cd /opt
if [ ! -d "gamifying-education" ]; then
    # Construct repository URL with authentication if token provided
    if [ -n "${github_token}" ]; then
        # Private repo: inject token into URL
        REPO_URL=$(echo "${github_repo_url}" | sed "s|https://|https://${github_token}@|")
    else
        # Public repo: use URL as-is
        REPO_URL="${github_repo_url}"
    fi

    git clone $REPO_URL || {
        echo "ERROR: Failed to clone repository from ${github_repo_url}"
        mkdir -p gamifying-education
    }

    # Fix ownership (cloned as root, need ubuntu user to own it)
    chown -R ubuntu:ubuntu /opt/gamifying-education
else
    echo "Repository already exists, pulling latest changes"
    cd /opt/gamifying-education
    git pull || true
fi

cd /opt/gamifying-education

# Create .env file at project root (where .env.example is)
echo "=== Creating .env file ==="
DB_HOST=$(echo "${db_endpoint}" | cut -d: -f1)
cat > /opt/gamifying-education/.env << EOF
# Project
PROJECT_NAME=gamifying-education

# Database (RDS)
POSTGRES_SERVER=$DB_HOST
POSTGRES_PORT=5432
POSTGRES_DB=gamifying_education
POSTGRES_USER=app_user
POSTGRES_PASSWORD=${db_password}

# Security
SECRET_KEY=${django_secret_key}
FIRST_SUPERUSER=${first_superuser_email}
FIRST_SUPERUSER_PASSWORD=${first_superuser_password}

# OpenAI
OPENAI_API_KEY=${openai_api_key}
OPENAI_MODEL=gpt-5-mini-2025-08-07
GENERATION_TEMPERATURE=0.7

# CORS (allow your domain)
BACKEND_CORS_ORIGINS=["https://${domain_name}","https://www.${domain_name}"]

# Feature Flags
FEATURE_AI_QUESTION_GENERATION=true
FEATURE_QUIZ_SYSTEM=true
FEATURE_QUIZ_TIMER=false

# Email (disabled)
SMTP_HOST=""
EMAILS_ENABLED=false

# Docker/Deployment specific
DOMAIN=${domain_name}
EOF

# Fix ownership
chown ubuntu:ubuntu /opt/gamifying-education/.env

# Add docker-compose specific variables to existing .env
echo "=== Adding docker-compose configuration to .env ==="
cat >> /opt/gamifying-education/.env << EOF

# Docker image configuration
ECR_REGISTRY=${ecr_registry}
ECR_REPOSITORY_BACKEND=${ecr_repository_backend}
ECR_REPOSITORY_FRONTEND=${ecr_repository_frontend}

# Traefik configuration
ADMIN_EMAIL=${admin_email}

# AWS configuration for Traefik Route 53 DNS challenge
# Credentials automatically provided by EC2 instance IAM role
AWS_REGION=${aws_region}
AWS_HOSTED_ZONE_ID=${hosted_zone_id}
EOF

# Fix ownership again
chown ubuntu:ubuntu /opt/gamifying-education/.env

# ============================================================
# ECR AUTHENTICATION AND IMAGE DEPLOYMENT
# ============================================================

echo "=== Authenticating with AWS ECR ==="
AWS_REGION="${aws_region}"
ECR_REGISTRY="${ecr_registry}"

# Login to ECR using instance IAM role
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REGISTRY

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to authenticate with ECR"
    echo "Please check IAM permissions for ECR access"
    exit 1
fi

echo "✓ ECR authentication successful"

# ============================================================
# CHECK ECR IMAGES EXIST
# ============================================================

echo "=== Checking for required Docker images in ECR ==="

# Function to check if image exists in ECR
check_ecr_image() {
    local REPO_NAME=$1
    local IMAGE_TAG=$2

    aws ecr describe-images \
        --repository-name $REPO_NAME \
        --image-ids imageTag=$IMAGE_TAG \
        --region $AWS_REGION \
        --output json > /dev/null 2>&1

    return $?
}

# Extract repository names
BACKEND_REPO="${ecr_repository_backend}"
FRONTEND_REPO="${ecr_repository_frontend}"

# Check both images
BACKEND_EXISTS=false
FRONTEND_EXISTS=false

if check_ecr_image "$BACKEND_REPO" "latest"; then
    echo "✓ Backend image found: $BACKEND_REPO:latest"
    BACKEND_EXISTS=true
else
    echo "✗ Backend image NOT found: $BACKEND_REPO:latest"
fi

if check_ecr_image "$FRONTEND_REPO" "latest"; then
    echo "✓ Frontend image found: $FRONTEND_REPO:latest"
    FRONTEND_EXISTS=true
else
    echo "✗ Frontend image NOT found: $FRONTEND_REPO:latest"
fi

# If images don't exist, provide clear instructions
if [ "$BACKEND_EXISTS" = false ] || [ "$FRONTEND_EXISTS" = false ]; then
    cat > /opt/.ecr-images-missing << EOF
========================================
ERROR: Required Docker images not found in ECR
========================================

REQUIRED ACTION: Push images to ECR before services can start

Step 1: On your LOCAL machine, build the images:
  cd /path/to/gamifying-education
  docker build -t $BACKEND_REPO:latest ./backend
  docker build -t $FRONTEND_REPO:latest ./frontend

Step 2: Authenticate with ECR (LOCAL machine):
  aws ecr get-login-password --region $AWS_REGION | \\
    docker login --username AWS --password-stdin $ECR_REGISTRY

Step 3: Tag images for ECR (LOCAL machine):
  docker tag $BACKEND_REPO:latest $ECR_REGISTRY/$BACKEND_REPO:latest
  docker tag $FRONTEND_REPO:latest $ECR_REGISTRY/$FRONTEND_REPO:latest

Step 4: Push images to ECR (LOCAL machine):
  docker push $ECR_REGISTRY/$BACKEND_REPO:latest
  docker push $ECR_REGISTRY/$FRONTEND_REPO:latest

Step 5: Deploy on THIS instance:
  ssh ubuntu@$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
  cd /opt/gamifying-education
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d

For detailed instructions, see: deployment.md
========================================
EOF

    cat /opt/.ecr-images-missing
    # Mark deployment as complete to prevent re-run, but note images missing
    touch /opt/.deployment-complete
    echo "Instance initialization PAUSED: Waiting for ECR images"
    echo "The instance is ready. Push Docker images to ECR and run docker compose manually."
    exit 0
fi

echo "✓ All required ECR images are available"

# ============================================================
# PULL IMAGES AND START SERVICES
# ============================================================

echo "=== Pulling Docker images from ECR ==="
cd /opt/gamifying-education

docker compose -f docker-compose.prod.yml pull

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to pull Docker images from ECR"
    echo "Check logs and ECR permissions"
    touch /opt/.docker-pull-failed
    exit 1
fi

echo "✓ Docker images pulled successfully"

# ============================================================
# START APPLICATION SERVICES
# ============================================================

echo "=== Starting application services with docker-compose ==="

docker compose -f docker-compose.prod.yml up -d

if [ $? -ne 0 ]; then
    echo "ERROR: Failed to start Docker services"
    echo "Check logs: docker compose -f docker-compose.prod.yml logs"
    touch /opt/.docker-compose-failed
    exit 1
fi

echo "✓ Docker services started"

# Wait for services to be healthy
echo "Waiting for backend service to be healthy (max 5 minutes)..."
HEALTHY=false

for i in {1..60}; do
    if docker compose -f docker-compose.prod.yml ps backend 2>/dev/null | grep -q "healthy"; then
        echo "✓ Backend service is healthy!"
        HEALTHY=true
        break
    fi

    # Check if container is running at all
    if ! docker compose -f docker-compose.prod.yml ps backend 2>/dev/null | grep -q "Up"; then
        echo "⚠ Backend container is not running. Checking logs..."
        docker compose -f docker-compose.prod.yml logs backend | tail -20
        echo "Container failed to start. Check full logs: docker compose -f docker-compose.prod.yml logs backend"
        break
    fi

    echo "Waiting for backend health check... ($i/60)"
    sleep 5
done

if [ "$HEALTHY" = true ]; then
    echo "✓ Application deployment successful - all services healthy"
else
    echo "⚠ Backend service started but not yet healthy"
    echo "This is normal if migrations are still running"
    echo "Check status with: docker compose -f docker-compose.prod.yml ps"
    echo "Check logs with: docker compose -f docker-compose.prod.yml logs backend"
fi

# Setup automatic security updates
echo "=== Configuring automatic security updates ==="
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades
DEBIAN_FRONTEND=noninteractive dpkg-reconfigure -plow unattended-upgrades

# Create helper scripts
echo "=== Creating helper scripts ==="

# App status script
cat > /usr/local/bin/app-status << 'STATUS_SCRIPT'
#!/bin/bash
echo "=== Gamifying Education Status ==="
echo ""
echo "Docker Services:"
cd /opt/gamifying-education
docker compose ps
echo ""
echo "Traefik Logs (last 20 lines):"
docker logs gamifying-education-traefik --tail 20
echo ""
echo "Backend Logs (last 20 lines):"
docker logs gamifying-education-backend --tail 20
echo ""
echo "Frontend Logs (last 20 lines):"
docker logs gamifying-education-frontend --tail 20
echo ""
echo "Disk Usage:"
df -h / | tail -1
echo ""
echo "Memory Usage:"
free -h | grep Mem
echo ""
echo "Docker Stats:"
docker stats --no-stream
STATUS_SCRIPT

chmod +x /usr/local/bin/app-status

# Deploy script (for manual updates)
cat > /usr/local/bin/app-deploy << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "=== Deploying Gamifying Education ==="
cd /opt/gamifying-education

# Pull latest changes
echo "Pulling latest code..."
git pull

# Pull Docker images (if using ECR)
if [ ! -z "$ECR_REGISTRY" ]; then
    echo "Pulling Docker images from ECR..."
    aws ecr get-login-password --region ${aws_region} | docker login --username AWS --password-stdin $ECR_REGISTRY
    docker compose pull
fi

# Restart services
echo "Restarting services..."
docker compose up -d

echo "Deployment complete!"
echo "Check status with: app-status"
DEPLOY_SCRIPT

chmod +x /usr/local/bin/app-deploy

# Restart script
cat > /usr/local/bin/app-restart << 'RESTART_SCRIPT'
#!/bin/bash
cd /opt/gamifying-education
docker compose restart
echo "Services restarted!"
RESTART_SCRIPT

chmod +x /usr/local/bin/app-restart

# Logs script
cat > /usr/local/bin/app-logs << 'LOGS_SCRIPT'
#!/bin/bash
cd /opt/gamifying-education
if [ -z "$1" ]; then
    docker compose logs -f
else
    docker compose logs -f "$1"
fi
LOGS_SCRIPT

chmod +x /usr/local/bin/app-logs

# Mark deployment as complete
touch /opt/.deployment-complete

echo "=== Instance initialization completed at $(date) ==="
echo "=== Application Status ==="
echo "✓ Docker and AWS CLI installed"
echo "✓ Repository cloned"
echo "✓ Environment configured"
echo "✓ ECR authenticated"
echo "✓ Docker images pulled from ECR"
echo "✓ Application services started"
echo ""
echo "=== Access Your Application ==="
echo "URL: https://${domain_name}"
echo "Login: ${first_superuser_email}"
echo ""
echo "=== Quick Commands ==="
echo "app-status   - Check application status"
echo "app-deploy   - Deploy latest changes from ECR"
echo "app-restart  - Restart all services"
echo "app-logs     - View logs (app-logs backend/frontend/traefik)"
echo ""
echo "=== Docker Commands ==="
echo "cd /opt/gamifying-education"
echo "docker compose -f docker-compose.prod.yml ps           - List containers"
echo "docker compose -f docker-compose.prod.yml logs -f      - View logs"
echo "docker compose -f docker-compose.prod.yml pull         - Pull latest images"
echo "docker compose -f docker-compose.prod.yml up -d        - Restart services"
echo "docker compose -f docker-compose.prod.yml down         - Stop services"
