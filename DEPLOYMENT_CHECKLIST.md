# Deployment Checklist - Gamifying Education

Complete this checklist step-by-step. Check off each item as you complete it.

---

## Phase 1: Pre-Deployment Setup

### 1.1 AWS Account Setup
- [ ] AWS account created and accessible
- [ ] AWS CLI installed on local machine
  ```bash
  aws --version
  # If not installed: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html
  ```

### 1.2 AWS IAM User for Terraform
- [ ] Create IAM user for terraform (or use existing)
  - Go to: AWS Console → IAM → Users → Create user
  - Username: `terraform-admin` (or similar)
  - Attach policy: `AdministratorAccess` (or specific: EC2, RDS, Route53, S3, IAM, ECR)

- [ ] Create access keys for the IAM user
  - Click user → Security credentials → Create access key
  - Choose: "Command Line Interface (CLI)"
  - **SAVE THESE SECURELY** (can't view secret again!)

- [ ] Configure AWS CLI with credentials
  ```bash
  aws configure
  # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output (json)
  ```

- [ ] Verify AWS CLI works
  ```bash
  aws sts get-caller-identity
  # Should show your user ARN and account ID
  ```

### 1.3 Domain Setup
- [ ] Domain registered: `devops-assignment.today` ✓ (you have this)
- [ ] Access to domain registrar (Namecheap, GoDaddy, etc.)
- [ ] Note: You'll update nameservers later after terraform creates Route53 zone

### 1.4 Generate SSH Key for EC2
- [ ] Generate SSH key pair for EC2 access
  ```bash
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/gamifying-education-key -C "EC2 access key"
  # Press Enter for no passphrase (or set one if you prefer)
  ```

- [ ] Verify key created
  ```bash
  ls -l ~/.ssh/gamifying-education-key*
  # Should see: gamifying-education-key and gamifying-education-key.pub
  ```

- [ ] Set correct permissions
  ```bash
  chmod 400 ~/.ssh/gamifying-education-key
  ```

### 1.5 Gather Required Credentials
- [ ] OpenAI API key ready
  - Get from: https://platform.openai.com/api-keys
  - Format: `sk-...`

- [ ] Admin email: `yousha234@gmail.com` ✓

- [ ] Choose secure passwords (save these securely):
  - [ ] Database password (PostgreSQL RDS)
  - [ ] First superuser password (app admin)
  - [ ] Django secret key (can generate below)

- [ ] Generate Django secret key
  ```bash
  python3 -c "import secrets; print(secrets.token_urlsafe(32))"
  # Save this output
  ```

---

## Phase 2: Terraform Configuration

### 2.1 Prepare Terraform Variables
- [ ] Navigate to terraform directory
  ```bash
  cd ~/IBA/fyp/gamifying-education/terraform
  ```

- [ ] Copy example variables file
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  ```

- [ ] Edit `terraform.tfvars` with your values:
  ```bash
  # Use your favorite editor
  code terraform.tfvars  # or vim, nano, etc.
  ```

- [ ] Fill in all required variables:
  - [ ] `aws_region` = "us-east-1" (or your preferred region)
  - [ ] `project_name` = "gamifying-education"
  - [ ] `domain_name` = "devops-assignment.today"
  - [ ] `ssh_key_name` = "gamifying-education-key"
  - [ ] `db_password` = "YOUR_SECURE_DB_PASSWORD"
  - [ ] `first_superuser_email` = "yousha234@gmail.com"
  - [ ] `first_superuser_password` = "YOUR_ADMIN_PASSWORD"
  - [ ] `openai_api_key` = "sk-..."
  - [ ] `admin_email` = "yousha234@gmail.com"
  - [ ] `github_repo_owner` = "your-github-username"
  - [ ] `github_repo_name` = "gamifying-education"

- [ ] **IMPORTANT**: Add terraform.tfvars to .gitignore (should already be there)
  ```bash
  # Verify it's ignored
  git check-ignore terraform.tfvars
  # Should output: terraform.tfvars
  ```

### 2.2 Initialize Terraform
- [ ] Initialize terraform (downloads providers)
  ```bash
  terraform init
  ```

- [ ] Expected output: "Terraform has been successfully initialized!"

### 2.3 Review Terraform Plan
- [ ] Run terraform plan to preview changes
  ```bash
  terraform plan
  ```

- [ ] Review the output carefully:
  - [ ] VPC and subnets will be created
  - [ ] EC2 instance (t3.medium)
  - [ ] RDS PostgreSQL instance (db.t3.micro)
  - [ ] Route53 hosted zone
  - [ ] ECR repositories (backend, frontend)
  - [ ] S3 bucket for backups
  - [ ] Security groups
  - [ ] IAM roles

- [ ] Estimated cost: ~$47/month (verify this is acceptable)

---

## Phase 3: Deploy Infrastructure

### 3.1 Apply Terraform
- [ ] Deploy infrastructure
  ```bash
  terraform apply
  ```

- [ ] Type `yes` when prompted

- [ ] Wait for completion (5-10 minutes)

- [ ] **CRITICAL**: Save the outputs immediately
  ```bash
  terraform output > ../deployment-outputs.txt
  cat ../deployment-outputs.txt
  ```

### 3.2 Extract Important Values
- [ ] Save these values (you'll need them):
  ```bash
  # Instance IP
  terraform output instance_public_ip

  # Route53 nameservers
  terraform output route53_nameservers

  # ECR repositories
  terraform output ecr_repository_backend
  terraform output ecr_repository_frontend

  # RDS endpoint
  terraform output rds_endpoint

  # GitHub Actions role ARN
  terraform output github_actions_role_arn
  ```

### 3.3 Update Domain Nameservers
- [ ] Get Route53 nameservers from terraform output
  ```bash
  terraform output route53_nameservers
  ```

- [ ] Login to your domain registrar (Namecheap, GoDaddy, etc.)

- [ ] Update nameservers to the 4 AWS Route53 nameservers
  - Example:
    ```
    ns-1234.awsdns-12.org
    ns-5678.awsdns-34.co.uk
    ns-9012.awsdns-56.com
    ns-3456.awsdns-78.net
    ```

- [ ] **Note**: DNS propagation takes 5-60 minutes

- [ ] Verify nameservers updated
  ```bash
  dig devops-assignment.today NS +short
  # Should show AWS nameservers after propagation
  ```

---

## Phase 4: EC2 Instance Setup

### 4.1 Wait for Instance Initialization
- [ ] Wait 10-15 minutes for:
  - RDS database initialization (5-10 min)
  - EC2 instance user_data script (5-10 min)

- [ ] SSH into EC2 instance
  ```bash
  ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(cd terraform && terraform output -raw instance_public_ip)
  ```

- [ ] Check initialization progress
  ```bash
  sudo tail -f /var/log/cloud-init-output.log
  # Press Ctrl+C when you see "Instance initialization completed"
  ```

### 4.2 Verify Instance Setup
- [ ] Check Docker is installed
  ```bash
  docker --version
  sudo systemctl status docker
  ```

- [ ] Check repository cloned
  ```bash
  ls -la /opt/gamifying-education
  ```

- [ ] Check .env file created
  ```bash
  cat /opt/gamifying-education/.env
  cat /opt/gamifying-education/backend/.env
  ```

- [ ] Verify database connectivity
  ```bash
  # Get DB host from .env
  DB_HOST=$(grep POSTGRES_SERVER /opt/gamifying-education/backend/.env | cut -d= -f2)
  echo $DB_HOST

  # Test connection
  pg_isready -h $(echo $DB_HOST | cut -d: -f1)
  # Should show: "accepting connections"
  ```

### 4.3 Initial Deployment (Local Build)
**Note**: First deployment uses locally built images (CI/CD will push to ECR later)

- [ ] Navigate to project directory
  ```bash
  cd /opt/gamifying-education
  ```

- [ ] Verify user_data.sh ran migrations
  ```bash
  cd /opt/gamifying-education/backend
  source .venv/bin/activate
  alembic current
  # Should show current migration
  ```

- [ ] Build and start services with docker compose
  ```bash
  cd /opt/gamifying-education

  # For initial deployment, we'll build locally
  # Comment out ECR image lines in docker-compose.prod.yml temporarily
  sudo docker compose -f docker-compose.prod.yml build
  sudo docker compose -f docker-compose.prod.yml up -d
  ```

- [ ] Check services are running
  ```bash
  docker ps
  # Should see: traefik, backend, frontend containers
  ```

- [ ] Use helper script
  ```bash
  app-status
  ```

### 4.4 Verify Services

- [ ] Check Traefik logs
  ```bash
  docker logs gamifying-education-traefik -f
  # Look for: "Certificate obtained successfully" (takes 2-5 minutes)
  # Press Ctrl+C to exit
  ```

- [ ] Check backend health
  ```bash
  docker logs gamifying-education-backend --tail 50
  # Look for: "Application startup complete"
  ```

- [ ] Check frontend
  ```bash
  docker logs gamifying-education-frontend --tail 20
  ```

---

## Phase 5: Application Verification

### 5.1 Test HTTPS Certificate
- [ ] Wait for Let's Encrypt certificate (2-5 minutes after services start)
  ```bash
  # On EC2
  docker logs gamifying-education-traefik 2>&1 | grep -i certificate
  ```

- [ ] From local machine, test HTTPS
  ```bash
  curl -I https://devops-assignment.today
  # Should return: HTTP/2 200 (if DNS propagated)
  ```

- [ ] If DNS not propagated yet, test directly
  ```bash
  # Get instance IP
  INSTANCE_IP=$(cd terraform && terraform output -raw instance_public_ip)

  # Test HTTP (should redirect to HTTPS)
  curl -I http://$INSTANCE_IP
  ```

### 5.2 Access Application
- [ ] Open browser and visit: https://devops-assignment.today

- [ ] Verify frontend loads

- [ ] Verify no SSL/TLS errors

### 5.3 Test Backend API
- [ ] Access API docs
  - https://devops-assignment.today/docs

- [ ] Test health endpoint
  ```bash
  curl https://devops-assignment.today/api/v1/health
  # Should return: {"status":"healthy"}
  ```

### 5.4 Login as Superuser
- [ ] Login to application
  - Email: `yousha234@gmail.com`
  - Password: (the one you set in terraform.tfvars)

- [ ] Verify admin access (can see admin pages)

- [ ] Test creating a question

- [ ] Test quiz system

---

## Phase 6: GitHub Actions CI/CD Setup

### 6.1 Add GitHub Secrets
- [ ] Navigate to GitHub repository
  - https://github.com/YOUR_USERNAME/gamifying-education

- [ ] Go to: Settings → Secrets and variables → Actions

- [ ] Click "New repository secret" for each:

  **Secret: `AWS_ROLE_ARN`**
  - [ ] Value: (get from terraform)
    ```bash
    cd terraform
    terraform output -raw github_actions_role_arn
    ```

  **Secret: `AWS_REGION`**
  - [ ] Value: `us-east-1` (or your region)

  **Secret: `ECR_BACKEND_REPO`**
  - [ ] Value: (get from terraform)
    ```bash
    terraform output -raw ecr_repository_backend | cut -d/ -f2
    # Example: gamifying-education-backend
    ```

  **Secret: `ECR_FRONTEND_REPO`**
  - [ ] Value: (get from terraform)
    ```bash
    terraform output -raw ecr_repository_frontend | cut -d/ -f2
    # Example: gamifying-education-frontend
    ```

  **Secret: `EC2_INSTANCE_ID`**
  - [ ] Value: (get from terraform)
    ```bash
    terraform output -raw instance_id
    # Example: i-0abc123def456789
    ```

### 6.2 Update GitHub Workflow
- [ ] Check workflow file exists: `.github/workflows/deploy.yml`

- [ ] Verify it has the correct branch (main or dev)

- [ ] Commit and push if changes needed

### 6.3 Test CI/CD Pipeline
- [ ] Make a small change (e.g., add comment to README)
  ```bash
  # On local machine
  echo "# Test deployment" >> README.md
  git add README.md
  git commit -m "Test CI/CD pipeline"
  git push origin dev  # or main
  ```

- [ ] Go to GitHub → Actions tab

- [ ] Watch the workflow run

- [ ] Verify all steps complete successfully:
  - [ ] Build backend image
  - [ ] Build frontend image
  - [ ] Push to ECR
  - [ ] Deploy to EC2

---

## Phase 7: Post-Deployment Configuration

### 7.1 Set Up Automated Backups
- [ ] Verify backup script exists on EC2
  ```bash
  ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(cd terraform && terraform output -raw instance_public_ip)

  cat /opt/scripts/backup-db.sh
  ```

- [ ] Verify cron job scheduled
  ```bash
  crontab -l
  # Should show: 0 2 * * * /opt/scripts/backup-db.sh
  ```

- [ ] Test manual backup
  ```bash
  sudo /opt/scripts/backup-db.sh
  ```

- [ ] Verify backup in S3
  ```bash
  # On local machine
  aws s3 ls s3://$(cd terraform && terraform output -raw s3_backup_bucket)/backups/
  ```

### 7.2 Enable Traefik Dashboard Auth (Optional)
- [ ] Generate password hash
  ```bash
  # On EC2 or local with htpasswd
  sudo apt-get install apache2-utils  # if not installed
  htpasswd -nb admin YourPassword
  # Copy the output: admin:$apr1$...
  ```

- [ ] Edit docker-compose.prod.yml on EC2
  ```bash
  sudo nano /opt/gamifying-education/docker-compose.prod.yml
  ```

- [ ] Uncomment these lines in traefik service:
  ```yaml
  - "traefik.http.routers.dashboard.middlewares=dashboard-auth"
  - "traefik.http.middlewares.dashboard-auth.basicauth.users=admin:$$apr1$$..."
  ```

- [ ] Replace password hash (double $$ symbols!)

- [ ] Restart traefik
  ```bash
  cd /opt/gamifying-education
  sudo docker compose -f docker-compose.prod.yml restart traefik
  ```

- [ ] Test dashboard access: https://devops-assignment.today/dashboard/

### 7.3 Configure Monitoring (Recommended)
- [ ] Set up CloudWatch alarms
  - EC2 instance health
  - RDS connection count
  - Disk space

- [ ] Enable CloudWatch Logs
  - Container logs
  - Application logs

- [ ] Set up billing alerts
  - AWS Console → Billing → Billing Preferences
  - Enable: Receive Billing Alerts
  - Create alarm in CloudWatch

---

## Phase 8: Security Hardening

### 8.1 Review Security Groups
- [ ] Verify only ports 22, 80, 443 are open
  ```bash
  aws ec2 describe-security-groups \
    --group-ids $(cd terraform && terraform output -raw security_group_id) \
    --query 'SecurityGroups[0].IpPermissions'
  ```

### 8.2 Enable MFA on AWS Account
- [ ] AWS Console → IAM → Your user → Security credentials
- [ ] Enable MFA device (virtual or hardware)

### 8.3 Rotate Secrets (Set Reminder)
- [ ] Set calendar reminder to rotate every 90 days:
  - Database password
  - OpenAI API key
  - GitHub secrets
  - Superuser password

### 8.4 Review IAM Permissions
- [ ] Review EC2 instance IAM role
  ```bash
  aws iam list-attached-role-policies \
    --role-name $(cd terraform && terraform output -raw ec2_role_name || echo "gamifying-education-ec2-role")
  ```

- [ ] Verify principle of least privilege

---

## Phase 9: Testing & Validation

### 9.1 Functional Testing
- [ ] Create a test user account
- [ ] Take a quiz
- [ ] Play the card game (multiplayer)
- [ ] Test AI question generation (if enabled)
- [ ] Upload/create questions
- [ ] Test all major features

### 9.2 Performance Testing
- [ ] Test page load times
- [ ] Test API response times
  ```bash
  curl -w "@-" -o /dev/null -s https://devops-assignment.today/api/v1/health <<'EOF'
     time_total: %{time_total}s\n
  EOF
  # Should be < 0.5s
  ```

- [ ] Test WebSocket connection (game)

### 9.3 SSL/TLS Verification
- [ ] Test SSL certificate
  ```bash
  echo | openssl s_client -servername devops-assignment.today \
    -connect devops-assignment.today:443 2>/dev/null | \
    openssl x509 -noout -dates
  ```

- [ ] Verify certificate is from Let's Encrypt

- [ ] Check SSL Labs rating (optional)
  - https://www.ssllabs.com/ssltest/analyze.html?d=devops-assignment.today

### 9.4 Backup & Recovery Test
- [ ] Create a test backup
  ```bash
  ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(cd terraform && terraform output -raw instance_public_ip)
  sudo /opt/scripts/backup-db.sh
  ```

- [ ] Download backup from S3
  ```bash
  # On local machine
  aws s3 cp s3://$(cd terraform && terraform output -raw s3_backup_bucket)/backups/db_backup_TIMESTAMP.sql.gz .
  ```

- [ ] Test restore (optional, on test database)

---

## Phase 10: Documentation & Handoff

### 10.1 Document Credentials
- [ ] Save all credentials securely (password manager):
  - AWS access keys
  - Database password
  - Superuser password
  - SSH private key location
  - OpenAI API key

### 10.2 Create Runbook
- [ ] Document common operations:
  - How to deploy updates
  - How to check logs
  - How to restart services
  - How to restore from backup
  - How to scale resources

### 10.3 Share Access
- [ ] If working with a team, document:
  - SSH key sharing process
  - AWS IAM user creation
  - GitHub access
  - Application admin access

---

## Troubleshooting Checklist

If something goes wrong, check these:

### Application not accessible
- [ ] DNS propagated? `dig devops-assignment.today +short`
- [ ] Services running? `docker ps` on EC2
- [ ] Traefik logs: `docker logs gamifying-education-traefik`
- [ ] Security groups allow 80/443
- [ ] Certificate obtained? Check Traefik logs for "Certificate obtained"

### Database connection errors
- [ ] RDS instance running? AWS Console → RDS
- [ ] Security groups allow EC2 → RDS
- [ ] Credentials correct in .env?
- [ ] Test: `pg_isready -h RDS_HOST`

### GitHub Actions failing
- [ ] Secrets configured correctly?
- [ ] OIDC role has correct permissions?
- [ ] ECR repositories exist?
- [ ] Instance ID correct?

### SSL/Certificate errors
- [ ] DNS propagated? (Required for Let's Encrypt)
- [ ] Route53 hosted zone ID correct?
- [ ] IAM role has Route53 permissions?
- [ ] Check Traefik logs: `docker logs gamifying-education-traefik | grep -i error`

---

## Quick Reference Commands

```bash
# SSH into EC2
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP

# Check application status
app-status

# View logs
app-logs              # All services
app-logs backend      # Backend only
app-logs frontend     # Frontend only
app-logs traefik      # Traefik only

# Restart services
app-restart

# Deploy updates (after git push)
app-deploy

# Manual docker commands
cd /opt/gamifying-education
docker compose -f docker-compose.prod.yml ps
docker compose -f docker-compose.prod.yml logs -f
docker compose -f docker-compose.prod.yml restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d

# Check terraform outputs
cd terraform
terraform output
terraform output instance_public_ip

# Check RDS
aws rds describe-db-instances --query "DBInstances[0].{Endpoint:Endpoint.Address,Status:DBInstanceStatus}"

# Check backups
aws s3 ls s3://BACKUP_BUCKET/backups/
```

---

## Completion Sign-Off

- [ ] All infrastructure deployed
- [ ] Application accessible via HTTPS
- [ ] SSL certificate valid
- [ ] All features tested
- [ ] CI/CD pipeline working
- [ ] Backups configured and tested
- [ ] Monitoring set up
- [ ] Documentation complete
- [ ] Team notified (if applicable)

**Deployment Date**: __________

**Deployed By**: __________

**Application URL**: https://devops-assignment.today

**Notes**:
_________________________________________
_________________________________________
_________________________________________

---

## Next Steps After Deployment

1. Monitor application for 24-48 hours
2. Test auto-renewal of SSL certificate (happens 30 days before expiry)
3. Review CloudWatch metrics
4. Optimize EC2/RDS sizes if needed
5. Set up additional environments (staging) if needed
6. Document any issues encountered
7. Create disaster recovery plan

---

**For help, refer to:**
- `TRAEFIK_SETUP.md` - Traefik architecture and troubleshooting
- `AWS_SETUP_GUIDE.md` - Detailed AWS resource setup
- `DEPLOYMENT_SUMMARY.md` - High-level deployment overview
- `terraform/README.md` - Terraform documentation

**Support Resources:**
- Terraform AWS Provider: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- Traefik Documentation: https://doc.traefik.io/traefik/
- Let's Encrypt: https://letsencrypt.org/docs/
