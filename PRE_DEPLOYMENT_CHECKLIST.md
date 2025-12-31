# Pre-Deployment Checklist

Test everything locally before deploying to AWS. Catch issues early!

---

## 1. Development Environment Setup

### 1.1 Required Tools
- [x] Node.js 24 installed
  ```bash
  nvm use  # Should use Node 24 from .nvmrc
  node --version  # Should show v24.x.x
  ```

- [x] Python 3.10+ and uv installed
  ```bash
  python3 --version  # Should be 3.10+
  uv --version
  ```

- [x] Docker installed and running
  ```bash
  docker --version
  docker ps  # Should not error
  ```

- [x] Terraform installed
  ```bash
  terraform --version  # Should be >= 1.0
  ```

- [x] AWS CLI installed
  ```bash
  aws --version
  ```

### 1.2 Git Repository
- [x] Repository cloned
  ```bash
  cd ~/IBA/fyp/gamifying-education
  git status  # Should show clean working tree or your changes
  ```

- [x] On correct branch
  ```bash
  git branch  # Should be on dev or your feature branch
  ```

---

## 2. AWS Credentials Setup

### 2.1 Configure AWS Profile
- [x] Configure `personal-terraform` profile
  ```bash
  aws configure --profile personal-terraform
  # Enter your AWS Access Key ID
  # Enter your AWS Secret Access Key
  # Default region: us-east-1
  # Default output format: json
  ```

### 2.2 Verify AWS Access
- [x] Test AWS credentials work
  ```bash
  aws sts get-caller-identity --profile personal-terraform
  # Should show your AWS account details
  ```

- [x] Verify Route53 access
  ```bash
  aws route53 list-hosted-zones --profile personal-terraform
  # Should list your hosted zones (yousha.click should be there)
  ```

---

## 3. Local Docker Build Tests

### 3.1 Test Backend Build
- [x] Build backend Docker image
  ```bash
  cd backend
  docker build -t gamifying-education-backend:test .
  ```

- [x] Verify image created
  ```bash
  docker images | grep gamifying-education-backend
  ```

- [x] Test run backend container (optional)
  ```bash
  # Create minimal .env first
  cat > .env.test << EOF
  POSTGRES_SERVER=localhost
  POSTGRES_DB=test
  POSTGRES_USER=test
  POSTGRES_PASSWORD=test
  SECRET_KEY=test-secret-key-minimum-32-chars-long
  OPENAI_API_KEY=sk-test
  EOF

  docker run --rm gamifying-education-backend:test python -c "print('Backend container works!')"

  # Cleanup
  rm .env.test
  ```

### 3.2 Test Frontend Build
- [x] Build frontend Docker image
  ```bash
  cd frontend
  docker build -f Dockerfile.prod -t gamifying-education-frontend:test .
  ```

- [x] Verify image created
  ```bash
  docker images | grep gamifying-education-frontend
  ```

- [x] Test run frontend container (optional)
  ```bash
  docker run --rm -p 8080:80 -d --name test-frontend gamifying-education-frontend:test
  # Wait a few seconds
  curl -I http://localhost:8080
  # Should return HTTP/1.1 200 OK

  # Cleanup
  docker stop test-frontend
  ```

### 3.3 Cleanup Test Images
- [x] Remove test images
  ```bash
  docker rmi gamifying-education-backend:test gamifying-education-frontend:test
  ```

---

## 4. Terraform Test Project

### 4.1 Setup terraform-test
- [x] Navigate to terraform-test
  ```bash
  cd terraform-test
  ```

- [x] Create terraform.tfvars
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  vim terraform.tfvars
  ```

- [x] Fill in values:
  - `aws_region` = "us-east-1"
  - `aws_profile` = "personal-terraform"
  - `ssh_key_name` = "gamifying-education-key" (or your key name)
  - `instance_type` = "t2.micro" (free tier)

### 4.2 Verify SSH Key Exists
- [ ] Check if SSH key exists in AWS
  ```bash
  aws ec2 describe-key-pairs --key-names gamifying-education-key --region us-east-1 --profile personal-terraform
  ```

- [x] If not found, create it:
  ```bash
  # Option A: Create new key pair
  aws ec2 create-key-pair \
    --key-name gamifying-education-key \
    --query 'KeyMaterial' \
    --output text \
    --region us-east-1 \
    --profile personal-terraform \
    > ~/.ssh/gamifying-education-key.pem

  chmod 400 ~/.ssh/gamifying-education-key.pem

  # Option B: Import existing public key
  ssh-keygen -t rsa -b 4096 -f ~/.ssh/gamifying-education-key -C "EC2 key"
  aws ec2 import-key-pair \
    --key-name gamifying-education-key \
    --public-key-material fileb://~/.ssh/gamifying-education-key.pub \
    --region us-east-1 \
    --profile personal-terraform
  ```

### 4.3 Test Terraform Commands
- [x] Initialize terraform
  ```bash
  terraform init
  # Should download AWS provider successfully
  ```

- [x] Validate configuration
  ```bash
  terraform validate
  # Should return: Success! The configuration is valid.
  ```

- [x] Format check
  ```bash
  terraform fmt -check
  # Should return nothing (all files formatted)
  ```

- [x] Plan deployment (dry run)
  ```bash
  terraform plan
  # Review the plan - should show resources to create
  ```

### 4.4 Deploy Test Instance (Optional but Recommended)
- [x] Apply terraform to create test instance
  ```bash
  terraform apply
  # Type: yes
  ```

- [x] Wait for completion (~2-3 minutes)

- [x] Get instance IP
  ```bash
  terraform output instance_public_ip
  ```

- [x] Wait for instance to initialize (~1-2 minutes)

- [x] Test SSH connection
  ```bash
  ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
  # Should connect successfully
  # Type 'exit' to disconnect
  ```

- [x] Test web server
  ```bash
  curl http://$(terraform output -raw instance_public_ip)
  # Should return HTML with "Hello from Terraform!"
  ```

- [x] Open in browser (optional)
  ```bash
  # On Mac:
  open http://$(terraform output -raw instance_public_ip)

  # Should show a nice styled page
  ```

### 4.5 Cleanup Test Instance
- [x] Destroy test resources
  ```bash
  terraform destroy
  # Type: yes
  ```

- [x] Verify everything cleaned up
  ```bash
  terraform show
  # Should show empty state
  ```

---

## 5. ECR Terraform Project (Deploy First - One Time Only)

**IMPORTANT**: ECR repositories must be created BEFORE the main infrastructure so Docker images persist across destroy/apply cycles.

### 5.1 Navigate to ECR Terraform
- [ ] Go to terraform-ecr directory
  ```bash
  cd terraform-ecr
  ```

### 5.2 Setup ECR Configuration
- [ ] Copy example file
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  ```

- [ ] Fill in values (same as main terraform):
  ```bash
  vim terraform.tfvars
  ```

  Required:
  - `aws_region` = "us-east-1"
  - `aws_profile` = "personal-terraform"
  - `project_name` = "gamifying-education"

### 5.3 Initialize and Validate
- [x] Initialize terraform
  ```bash
  terraform init
  ```

- [x] Validate configuration
  ```bash
  terraform validate
  # Should succeed
  ```

- [x] Format check
  ```bash
  terraform fmt -check
  ```

### 5.4 Deploy ECR Repositories
- [x] Run terraform plan
  ```bash
  terraform plan
  # Should show 2 ECR repos + 2 lifecycle policies to create
  ```

- [x] Apply to create ECR repositories
  ```bash
  terraform apply
  # Type: yes
  ```

- [x] Verify repositories created
  ```bash
  terraform output
  # Should show backend and frontend repository URLs
  ```

**Note**: These ECR repos will persist even when you destroy the main infrastructure. Only destroy them when completely done with the project.

---

## 6. Main Terraform Project Validation

### 6.1 Navigate to Main Terraform
- [x] Go to main terraform directory
  ```bash
  cd ../terraform
  ```

### 6.2 Validate Configuration
- [x] Initialize (if not already done)
  ```bash
  terraform init
  ```

- [x] Validate syntax
  ```bash
  terraform validate
  # Should succeed
  ```

- [x] Format check
  ```bash
  terraform fmt -check -recursive
  ```

### 6.3 Create terraform.tfvars
- [x] Copy example file
  ```bash
  cp terraform.tfvars.example terraform.tfvars
  ```

- [x] Fill in REQUIRED values (don't deploy yet, just prepare):
  ```bash
  vim terraform.tfvars
  ```

  Minimum required:
  - `aws_region` = "us-east-1"
  - `aws_profile` = "personal-terraform"
  - `domain_name` = "yousha.click"
  - `route53_zone_id` = "Z..." (get from Route53)
  - `ssh_key_name` = "gamifying-education-key"
  - `db_password` = "secure-password"
  - `first_superuser_email` = "yousha234@gmail.com"
  - `first_superuser_password` = "secure-password"
  - `openai_api_key` = "sk-..."
  - `github_token` = "ghp_..." (only if repository is private)

### 6.4 Get Route53 Zone ID
- [x] List hosted zones
  ```bash
  aws route53 list-hosted-zones --profile personal-terraform
  ```

- [x] Copy zone ID for yousha.click
  ```bash
  # Zone ID looks like: /hostedzone/Z1234567890ABC
  # Use only the ID part: Z1234567890ABC
  ```

- [x] Update terraform.tfvars with zone ID

### 6.5 Dry Run (Plan Only - Don't Apply Yet!)
- [x] Run terraform plan
  ```bash
  terraform plan
  # Review what will be created
  # DO NOT run 'terraform apply' yet!
  ```

- [x] Verify plan looks correct:
  - [x] EC2 instance will be created
  - [x] RDS database will be created
  - [x] Route53 A records will be created
  - [x] Security groups look correct
  - [x] No errors in plan

---

## 7. Local Development Stack Test

### 7.1 Test Full Stack Locally
- [x] Navigate to project root
  ```bash
  cd ~/IBA/fyp/gamifying-education
  ```

- [x] Create backend .env if missing
  ```bash
  cd backend
  cp .env.example .env 2>/dev/null || echo ".env exists"
  ```

- [x] Start local stack with docker compose
  ```bash
  cd ..
  docker compose up -d
  ```

- [ ] Wait for services to start (~30 seconds)

- [ ] Check all containers running
  ```bash
  docker compose ps
  # Should show: db, backend, frontend all running
  ```

- [ ] Test backend health
  ```bash
  curl http://localhost:8000/api/v1/health
  # Should return: {"status":"healthy"}
  ```

- [ ] Test frontend
  ```bash
  curl -I http://localhost:5173
  # Should return: HTTP/1.1 200 OK
  ```

- [ ] Open in browser
  ```bash
  open http://localhost:5173
  # Should load the app
  ```

### 7.2 Cleanup Local Stack
- [ ] Stop and remove containers
  ```bash
  docker compose down
  ```

- [ ] Optional: Remove volumes (clean slate)
  ```bash
  docker compose down -v
  ```

---

## 8. Deployment Scripts Test

### 8.1 Verify Scripts Exist
- [ ] Check deploy script
  ```bash
  ls -l scripts/deploy.sh
  # Should exist and be executable
  ```

- [ ] Check destroy script
  ```bash
  ls -l scripts/destroy.sh
  # Should exist and be executable
  ```

### 8.2 Test Scripts (Dry Run)
- [ ] Run deploy script in dry-run mode
  ```bash
  cd terraform
  terraform init
  terraform plan -out=tfplan
  # Script would do this automatically, we're just testing
  rm tfplan  # Clean up
  ```

---

## 9. Final Pre-Deployment Checks

### 9.1 Documentation Review
- [ ] Read SIMPLE_DEPLOYMENT.md
  ```bash
  cat SIMPLE_DEPLOYMENT.md
  ```

- [ ] Read DEPLOYMENT_CHECKLIST.md
  ```bash
  cat DEPLOYMENT_CHECKLIST.md
  ```

- [ ] Skim TERRAFORM_DEBUGGING.md (for when things go wrong)

### 9.2 Cost Awareness
- [ ] Understand monthly costs:
  - EC2 (t3.medium): ~$30/month
  - RDS (db.t3.micro): ~$15/month
  - Route53: $0.50/month (already paying)
  - Total: ~$45-50/month

- [ ] Confirm you're OK with these costs

### 9.3 Backup Plan
- [ ] Confirm you can destroy infrastructure if needed
  ```bash
  # Just verify command, don't run!
  echo "terraform destroy"
  ```

- [ ] Know how to check AWS costs
  ```bash
  # AWS Console → Billing Dashboard
  open https://console.aws.amazon.com/billing/
  ```

---

## 10. Ready to Deploy?

### Final Checklist
- [ ] All tests above passed ✓
- [ ] terraform-test worked successfully ✓
- [ ] Docker builds work ✓
- [ ] AWS credentials configured ✓
- [ ] **ECR repositories deployed** (terraform-ecr) ✓
- [ ] terraform.tfvars filled out ✓
- [ ] Route53 zone ID obtained ✓
- [ ] SSH key exists in AWS ✓
- [ ] terraform plan looks good ✓
- [ ] You understand the costs ✓
- [ ] You're ready to commit! ✓

### If All Checked:
**Proceed to `DEPLOYMENT_CHECKLIST.md`** and start the actual deployment!

---

## Troubleshooting Common Issues

### Issue: Docker build fails
**Solution**: Check Docker is running, try `docker system prune` to clean up

### Issue: terraform plan fails with "credentials not found"
**Solution**: Run `aws configure --profile personal-terraform` again

### Issue: SSH key not found in AWS
**Solution**: Create or import key (see section 4.2)

### Issue: terraform-test instance can't connect
**Solution**: Wait 2-3 minutes for instance to initialize, check security group allows SSH from your IP

### Issue: Route53 hosted zone not found
**Solution**: Zone might not exist yet. It's created when you buy domain from AWS. List all zones: `aws route53 list-hosted-zones --profile personal-terraform`

---

## Summary

**What This Checklist Tests:**
- ✅ Local environment setup
- ✅ AWS credentials work
- ✅ Docker builds work
- ✅ Terraform commands work
- ✅ terraform-test deploys successfully
- ✅ Main terraform config is valid
- ✅ All prerequisites met

**Time Required:** ~30-45 minutes

**Next Step:** If all tests pass → `DEPLOYMENT_CHECKLIST.md`

**If Tests Fail:** Fix issues before deploying to production!
