# Low-Cost AWS Deployment Plan

## Overview

This deployment plan prioritizes **minimal cost** while maintaining functionality. The architecture uses AWS Free Tier resources where possible and consolidates services to reduce expenses.

**Fully automated deployment** - just run `terraform apply` and everything is configured automatically!

**Your Configuration**:
- Domain: `yousha.click` (already in Route 53)
- Region: `us-east-1`
- SSL: Automatic with Let's Encrypt + Route 53 DNS challenge
- No manual steps required

**Estimated Monthly Cost**: $5-15/month (after Free Tier benefits)

## Architecture

### Selected Option: RDS PostgreSQL ✅

**Separate EC2 and RDS** for better management:
- EC2 `t4g.micro` for backend + frontend + Nginx
- RDS PostgreSQL `db.t4g.micro` (managed database)

**Cost**: ~$12-18/month
- EC2: Free Tier (750 hours/month for 12 months), then ~$3.50/month
- RDS: ~$12-15/month (db.t4g.micro)
- EBS: 30GB Free Tier
- RDS Storage: 20GB included
- Data transfer: 100GB Free Tier
- Elastic IP: Free while instance is running

**Benefits**:
- ✅ Automated backups (7 days retention)
- ✅ Point-in-time recovery
- ✅ Automatic minor version upgrades
- ✅ Better performance isolation
- ✅ Easier scaling
- ✅ RDS manages updates and patches

## Detailed Architecture (Option A)

```
┌─────────────────────────────────────────────────┐
│  Route 53                                       │
│  yousha.click → Elastic IP           │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  EC2 t4g.micro (ARM64) - Public Subnet          │
│  ┌───────────────────────────────────────────┐  │
│  │  Nginx (Port 80/443)                      │  │
│  │  - Serves static React build              │  │
│  │  - Reverse proxy to FastAPI               │  │
│  │  - SSL with Let's Encrypt (Certbot)      │  │
│  └───────────────────────────────────────────┘  │
│                                                  │
│  ┌───────────────────────────────────────────┐  │
│  │  FastAPI (Port 8000)                      │  │
│  │  - Uvicorn workers                        │  │
│  │  - Managed by systemd                     │  │
│  │  - Connects to RDS                        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  RDS PostgreSQL db.t4g.micro - Private Subnet   │
│  - Automated backups (7 days)                   │
│  - Point-in-time recovery                       │
│  - Multi-AZ optional                            │
│  - Not publicly accessible                      │
└─────────────────────────────────────────────────┘
                      ↓
┌─────────────────────────────────────────────────┐
│  S3 Bucket (Manual Backups)                     │
│  - Daily pg_dump backups                        │
│  - 30 day retention                             │
└─────────────────────────────────────────────────┘
```

## AWS Resources Needed

### 1. VPC & Networking
- **VPC**: 1 VPC with public subnet
- **Internet Gateway**: For internet access
- **Security Group**:
  - Inbound: 80 (HTTP), 443 (HTTPS), 22 (SSH - restricted to your IP)
  - Outbound: All (for package updates, OpenAI API)
- **Elastic IP**: Static IP address

### 2. Compute
- **EC2 Instance**: `t4g.micro` (2 vCPU, 1GB RAM) - ARM64
  - AMI: Ubuntu 24.04 LTS ARM64
  - EBS: 30GB gp3 volume (Free Tier: 30GB)
  - Free Tier: 750 hours/month for 12 months
  - Deployed in public subnet

### 3. Database
- **RDS PostgreSQL**: `db.t4g.micro` (2 vCPU, 1GB RAM) - ARM64
  - Engine: PostgreSQL 16.4
  - Storage: 20GB gp3 (auto-scaling up to 100GB)
  - Backups: 7 days retention
  - Deployed in private subnets (2 AZs required)
  - Not publicly accessible
  - Performance Insights enabled (7 day retention)

### 4. Storage
- **S3 Bucket**: For backups, static assets if needed
  - Free Tier: 5GB storage, 20,000 GET, 2,000 PUT requests/month

### 5. DNS
- **Route 53**: ~$0.50/month per hosted zone
  - Or use external DNS provider (Cloudflare free tier)

## Cost-Saving Decisions

### What We're Using
- ✅ RDS PostgreSQL - Better management, automated backups
- ✅ Single EC2 instance - No load balancer needed yet
- ✅ ARM64 instances (t4g) - Cheaper than x86 (t3)

### What We're Skipping (Can Add Later)
- ✂️ Email service (MailCatcher/SendGrid) - not critical for MVP
- ✂️ Load balancer ($16/month) - single instance is fine
- ✂️ Multi-AZ RDS - single AZ sufficient for now
- ✂️ CloudWatch detailed monitoring - use basic monitoring
- ✂️ S3 + CloudFront for frontend - serve from EC2
- ✂️ ElastiCache - no caching layer
- ✂️ Separate staging environment - single production instance
- ✂️ Auto-scaling - single instance

### What We're Keeping
- ✅ HTTPS with free Let's Encrypt SSL
- ✅ WebSocket support (for card game)
- ✅ RDS PostgreSQL database (managed)
- ✅ OpenAI API integration
- ✅ RDS automated backups (7 days)
- ✅ Additional S3 backups (manual pg_dump)

## Terraform Structure

```
terraform/
├── main.tf                 # Main configuration
├── variables.tf            # Input variables
├── outputs.tf              # Outputs (IP, DNS, RDS endpoint)
├── vpc.tf                  # VPC, subnets (public + private), gateway
├── security_groups.tf      # Security groups (EC2, RDS)
├── ec2.tf                  # EC2 instance
├── rds.tf                  # RDS PostgreSQL instance
├── iam.tf                  # IAM roles (Route 53, S3)
├── s3.tf                   # S3 bucket for additional backups
├── terraform.tfvars        # Your values (gitignored)
└── user_data.sh            # EC2 initialization script
```

## Deployment Steps

### Phase 1: Infrastructure Setup (Terraform)

```bash
cd terraform/

# Initialize Terraform
terraform init

# Review plan
terraform plan

# Apply (creates AWS resources)
terraform apply

# Save outputs
terraform output > ../deployment-info.txt
```

**Outputs**:
- EC2 public IP
- Elastic IP
- S3 backup bucket name

### Phase 2: Server Configuration (Ansible/Scripts)

SSH into the EC2 instance and run setup scripts:

```bash
# 1. Install system packages
sudo apt update && sudo apt upgrade -y
sudo apt install -y postgresql nginx python3-pip python3-venv nodejs npm certbot python3-certbot-nginx

# 2. Setup PostgreSQL
sudo -u postgres createdb gamifying_education
sudo -u postgres psql -c "CREATE USER app_user WITH PASSWORD 'secure_password';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gamifying_education TO app_user;"

# 3. Deploy backend
cd /opt/
sudo git clone https://github.com/yourusername/gamifying-education.git
cd gamifying-education/backend
sudo python3 -m venv .venv
sudo .venv/bin/pip install uv
sudo .venv/bin/uv sync

# 4. Run migrations
sudo .venv/bin/alembic upgrade head

# 5. Setup systemd service for FastAPI
sudo systemctl enable gamifying-education-backend
sudo systemctl start gamifying-education-backend

# 6. Build and deploy frontend
cd /opt/gamifying-education/frontend
npm install
npm run build
sudo cp -r dist/* /var/www/html/

# 7. Configure Nginx
sudo systemctl enable nginx
sudo systemctl restart nginx

# 8. Setup SSL (after DNS is configured)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

### Phase 3: Configuration Files

We'll need to create:
- `/etc/systemd/system/gamifying-education-backend.service` - systemd service
- `/etc/nginx/sites-available/gamifying-education` - Nginx config
- `.env` file for backend environment variables
- Backup cron job (daily PostgreSQL dump to S3)

## Environment Variables

Update `.env` on the EC2 instance:

```env
# Database (local PostgreSQL)
POSTGRES_SERVER=localhost
POSTGRES_DB=gamifying_education
POSTGRES_USER=app_user
POSTGRES_PASSWORD=<generate-secure-password>

# Security
SECRET_KEY=<generate-with-openssl-rand-base64-32>
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=<generate-secure-password>

# OpenAI
OPENAI_API_KEY=sk-...

# CORS (frontend domain)
BACKEND_CORS_ORIGINS=["https://yourdomain.com","https://www.yourdomain.com"]

# Feature Flags
FEATURE_AI_QUESTION_GENERATION=true
FEATURE_QUIZ_SYSTEM=true
FEATURE_QUIZ_TIMER=false

# Email (disabled for now)
SMTP_HOST=""
EMAILS_ENABLED=false
```

## Backup Strategy

### Automated PostgreSQL Backups

Create `/opt/scripts/backup-db.sh`:

```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/db_backup_$TIMESTAMP.sql.gz"
S3_BUCKET="your-backup-bucket"

# Dump database
pg_dump -U app_user gamifying_education | gzip > $BACKUP_FILE

# Upload to S3
aws s3 cp $BACKUP_FILE s3://$S3_BUCKET/backups/

# Keep only last 7 days locally
find /tmp/db_backup_*.sql.gz -mtime +7 -delete

# S3 lifecycle policy will handle retention
```

Cron job (daily at 2 AM):
```cron
0 2 * * * /opt/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

## Monitoring (Free Tier)

### Basic Monitoring
- AWS CloudWatch basic metrics (free)
- EC2 instance status checks
- Disk space monitoring script

### Log Management
- Backend logs: `/var/log/gamifying-education/`
- Nginx logs: `/var/log/nginx/`
- PostgreSQL logs: `/var/log/postgresql/`

Simple log rotation with `logrotate`.

## Security Considerations

1. **SSH Access**: Use SSH key authentication, disable password login
2. **Security Group**: Restrict SSH (port 22) to your IP only
3. **Database**: PostgreSQL only accessible locally (no external exposure)
4. **Secrets**: Store sensitive values in AWS Secrets Manager or Parameter Store (free tier: 30 days)
5. **Updates**: Enable unattended-upgrades for security patches
6. **Firewall**: Use `ufw` in addition to security groups

## Scaling Path (Future)

When you need to scale (>1000 concurrent users):

1. **Database**: Migrate to RDS for managed backups/HA
2. **Compute**: Add second EC2 instance + ALB
3. **Static Assets**: Move frontend to S3 + CloudFront
4. **Caching**: Add Redis (ElastiCache or local)
5. **Monitoring**: Upgrade to CloudWatch detailed monitoring

## Domain Setup

### Option 1: Route 53 (~$12/year + $0.50/month)
- Register domain in Route 53
- Create A record pointing to Elastic IP

### Option 2: External DNS (Cloudflare - Free)
- Register domain elsewhere (Namecheap ~$10/year)
- Use Cloudflare free DNS + proxy
- Point A record to Elastic IP
- Bonus: Free CDN and DDoS protection

**Recommendation**: Use Cloudflare free tier for maximum cost savings.

## Initial Costs Breakdown

### First Year (with Free Tier)
- EC2 t4g.micro: Free (750 hours/month × 12 months)
- EBS 30GB: Free
- **RDS db.t4g.micro**: ~$12/month (no Free Tier for ARM)
  - OR use db.t3.micro: Free for 12 months (750 hours), then ~$15/month
- RDS Storage 20GB: Free (20GB included)
- Data transfer: Free (first 100GB/month)
- Elastic IP: Free (while instance running)
- S3 backups: ~$0.50/month (supplemental backups)

**Total Year 1 with db.t4g.micro**: ~$12-15/month (~$150-180/year)
**Total Year 1 with db.t3.micro**: ~$6-10/month (first year), then ~$15-18/month

### After Free Tier (Month 13+)
- EC2 t4g.micro: ~$3.50/month
- EBS 30GB: ~$2.40/month
- RDS db.t4g.micro: ~$12/month
- RDS Storage 20GB: ~$2.30/month
- Data transfer: Free (first 100GB)
- Elastic IP: Free
- S3 backups: ~$0.50/month

**Total Ongoing**: ~$20-22/month (~$240-260/year)

### Cost Optimization Options

**For lowest cost (Year 1)**:
- Use `db.t3.micro` (Free Tier x86) instead of `db.t4g.micro`
- Total: ~$6-10/month first year

**For lowest long-term cost**:
- Use `db.t4g.micro` (ARM64, cheaper than t3 after Free Tier)
- Total: ~$20/month ongoing

## Deployment Checklist

- [ ] AWS account ready
- [ ] Domain registered (optional but recommended)
- [ ] OpenAI API key obtained
- [ ] Terraform installed locally
- [ ] AWS CLI configured (`aws configure`)
- [ ] SSH key pair created
- [ ] Git repository updated with production settings
- [ ] Environment variables prepared
- [ ] Backup bucket name decided

## Next Steps

1. **Review and approve this plan**
2. **Set up Terraform configurations** (I can generate all files)
3. **Create deployment scripts** (systemd, Nginx, backup scripts)
4. **Test deployment in AWS**
5. **Document rollback procedures**

## Rollback Plan

If deployment fails:
1. SSH into instance, check logs
2. Restart services: `sudo systemctl restart gamifying-education-backend nginx`
3. Rollback database: `psql < backup.sql`
4. Full rollback: `terraform destroy` and redeploy

## Your Configuration Answers ✅

1. **Domain name**: `yousha.click` (existing in Route 53 - not managed by Terraform)
2. **Region**: `us-east-1`
3. **SSH key**: Create new AWS key pair (see SSH_KEY_SETUP.md)
4. **OpenAI API key**: ✅ Have it (add to terraform.tfvars)
5. **HTTPS**: ✅ Required - automatic setup with Let's Encrypt + Route 53 DNS challenge

## Deployment is Fully Automatic

**No manual steps needed!** Just run:
```bash
terraform apply
```

The user_data script automatically:
- ✅ Installs all dependencies
- ✅ Configures PostgreSQL
- ✅ Clones and builds application
- ✅ Sets up Nginx
- ✅ Configures SSL with Let's Encrypt (using Route 53 DNS challenge)
- ✅ Starts all services
- ✅ Configures automated backups

Wait 8-12 minutes, then access: **https://yousha.click**

## Alternative SSL Options (Not Recommended for Single EC2)

You mentioned "another way" for SSL in AWS:

1. **AWS Certificate Manager (ACM)** - Free SSL certificates
   - ❌ Requires Application Load Balancer ($16/month) or CloudFront
   - ❌ Not cost-effective for single EC2 instance

2. **Current approach: Let's Encrypt + Certbot** ✅
   - ✅ Free SSL certificates
   - ✅ Automatic renewal
   - ✅ Route 53 DNS challenge (no HTTP needed for verification)
   - ✅ Works perfectly for single EC2 instances
   - ✅ AWS-recommended for EC2

**Recommendation**: Stick with Let's Encrypt + Certbot (current setup)
