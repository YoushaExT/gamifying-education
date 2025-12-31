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
    awscli \
    build-essential \
    libpq-dev \
    postgresql-client \
    python3.12-venv \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release

# Note: postgresql-client only (for connecting to RDS), not full postgresql server

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

# Note: PostgreSQL is NOT installed locally - we're using RDS
echo "=== Using RDS PostgreSQL (not local PostgreSQL) ==="
echo "RDS endpoint: ${db_endpoint}"

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

# Setup backend environment for initial migrations
echo "=== Setting up backend environment for migrations ==="
cd /opt/gamifying-education/backend

# Install uv for Python package management (as ubuntu user)
echo "=== Installing uv ==="
sudo -u ubuntu bash -c 'curl -LsSf https://astral.sh/uv/install.sh | sh'

# Create virtual environment and install dependencies (as ubuntu user)
sudo -u ubuntu bash << 'SETUP_VENV'
cd /opt/gamifying-education/backend
export PATH="$HOME/.local/bin:$PATH"

# Create virtual environment
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi

# Activate and install dependencies
source .venv/bin/activate
pip install uv
uv sync
SETUP_VENV

# Create .env file for backend
echo "=== Creating backend .env file ==="
cat > /opt/gamifying-education/backend/.env << 'EOF'
# Database (RDS)
POSTGRES_SERVER=${db_endpoint}
POSTGRES_DB=gamifying_education
POSTGRES_USER=app_user
POSTGRES_PASSWORD=${db_password}

# Security
SECRET_KEY=${django_secret_key}
FIRST_SUPERUSER=${first_superuser_email}
FIRST_SUPERUSER_PASSWORD=${first_superuser_password}

# OpenAI
OPENAI_API_KEY=${openai_api_key}
OPENAI_MODEL=gpt-4o-mini
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
EOF

# Wait for RDS to be ready
echo "=== Waiting for RDS database to be ready ==="
DB_HOST=$(echo "${db_endpoint}" | cut -d: -f1)
for i in {1..60}; do
    if pg_isready -h $DB_HOST -U app_user > /dev/null 2>&1; then
        echo "RDS database is ready!"
        break
    fi
    echo "Waiting for RDS database... ($i/60)"
    sleep 5
done

# Run database migrations (as ubuntu user)
echo "=== Running database migrations ==="
sudo -u ubuntu bash << 'RUN_MIGRATIONS'
cd /opt/gamifying-education/backend
source .venv/bin/activate
alembic upgrade head || {
    echo "WARNING: Migration failed, trying to initialize database"
    alembic revision --autogenerate -m "Initial migration" || true
    alembic upgrade head || true
}
RUN_MIGRATIONS

# Create environment file for docker-compose
echo "=== Creating docker-compose environment file ==="
cat > /opt/gamifying-education/.env << 'ENV_FILE'
# Docker image configuration
ECR_REGISTRY=${ecr_registry}
ECR_REPOSITORY_BACKEND=${ecr_repository_backend}
ECR_REPOSITORY_FRONTEND=${ecr_repository_frontend}

# Database configuration
DB_HOST=${db_endpoint}
DB_NAME=gamifying_education
DB_USER=app_user
DB_PASSWORD=${db_password}

# Traefik configuration
DOMAIN_NAME=${domain_name}
ADMIN_EMAIL=${admin_email}

# AWS configuration for Traefik Route 53 DNS challenge
# Credentials automatically provided by EC2 instance IAM role
AWS_REGION=${aws_region}
AWS_HOSTED_ZONE_ID=${hosted_zone_id}
ENV_FILE

# Note: For initial deployment without ECR images, we need to build locally
# This will be replaced by ECR images during CI/CD deployments

# Setup automatic security updates
echo "=== Configuring automatic security updates ==="
DEBIAN_FRONTEND=noninteractive apt-get install -y unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

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
echo "=== Next Steps ==="
echo "1. Configure ECR and push Docker images"
echo "2. Update .env file with ECR image URLs"
echo "3. Run: cd /opt/gamifying-education && docker compose up -d"
echo ""
echo "=== Quick Commands ==="
echo "app-status  - Check application status"
echo "app-deploy  - Deploy latest changes"
echo "app-restart - Restart all services"
echo "app-logs    - View logs (app-logs backend/frontend/traefik)"
echo ""
echo "=== Manual Docker Commands ==="
echo "cd /opt/gamifying-education"
echo "docker compose up -d        - Start services"
echo "docker compose down         - Stop services"
echo "docker compose logs -f      - View logs"
echo "docker compose ps           - List containers"
