# Quick Start Deployment Guide

Deploy your application to AWS in 5 steps (15 minutes).

## Prerequisites Checklist

- [ ] AWS account
- [ ] AWS CLI installed: `aws --version`
- [ ] AWS credentials configured: `aws configure`
- [ ] Terraform installed: `terraform --version`
- [ ] Domain `yousha.click` in Route 53
- [ ] OpenAI API key

## Step-by-Step Deployment

### Step 1: Create SSH Key (2 minutes)

**Option A: AWS Console (Easiest)**
```bash
# 1. Go to https://console.aws.amazon.com/ec2/
# 2. Sidebar: Key Pairs → Create key pair
# 3. Name: gamifying-education-key
# 4. Type: RSA, Format: .pem
# 5. Download the file

# Move to SSH directory and set permissions
mv ~/Downloads/gamifying-education-key.pem ~/.ssh/
chmod 400 ~/.ssh/gamifying-education-key.pem
```

**Option B: AWS CLI**
```bash
aws ec2 create-key-pair \
    --key-name gamifying-education-key \
    --query 'KeyMaterial' \
    --output text \
    --region us-east-1 \
    > ~/.ssh/gamifying-education-key.pem

chmod 400 ~/.ssh/gamifying-education-key.pem
```

### Step 2: Get Route 53 Zone ID (1 minute)

```bash
# Find your hosted zone ID
aws route53 list-hosted-zones | grep -A 2 "yousha.click"

# Copy the ID (looks like: Z0123456789ABC)
```

### Step 3: Configure Variables (3 minutes)

```bash
cd terraform/

# Copy example
cp terraform.tfvars.example terraform.tfvars

# Generate secure passwords
echo "db_password: $(openssl rand -base64 32)"
echo "django_secret_key: $(openssl rand -base64 32)"
echo "first_superuser_password: $(openssl rand -base64 32)"

# Get your IP address
echo "Your IP: $(curl -s ifconfig.me)/32"

# Edit terraform.tfvars with your values
nano terraform.tfvars
```

**Update these values in `terraform.tfvars`**:
```hcl
# FROM STEP 2
route53_zone_id = "Z0123456789ABC"  # <-- YOUR ZONE ID

# FROM STEP 1
ssh_key_name = "gamifying-education-key"

# FROM CURL COMMAND ABOVE
allowed_ssh_cidr = "203.0.113.5/32"  # <-- YOUR IP

# FROM OPENSSL COMMANDS ABOVE
db_password = "PASTE_GENERATED_PASSWORD"
django_secret_key = "PASTE_GENERATED_SECRET"
first_superuser_password = "PASTE_GENERATED_PASSWORD"

# YOUR OPENAI KEY
openai_api_key = "sk-proj-..."

# YOUR EMAIL
admin_email = "your-email@example.com"
```

### Step 4: Update Repository URL (1 minute)

**IMPORTANT**: Edit `user_data.sh` line 77 to use your actual repository URL:

```bash
nano user_data.sh

# Find this line:
# git clone https://github.com/yourusername/gamifying-education.git

# Change to your actual repository URL:
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
```

Or if using a private repository, you'll need to set up deploy keys (see below).

### Step 5: Deploy! (8 minutes)

```bash
cd terraform/

# Initialize
terraform init

# Review plan
terraform plan

# Deploy (type 'yes' when prompted)
terraform apply
```

**Wait for completion**: This takes 8-12 minutes.

## Verify Deployment

### Check Status

```bash
# Get deployment info
terraform output

# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Watch initialization progress
sudo tail -f /var/log/cloud-init-output.log

# When you see "Instance initialization completed", it's ready!
```

### Test Application

1. Open browser: **https://yousha.click**
2. Login with:
   - Email: `admin@example.com`
   - Password: `first_superuser_password` from terraform.tfvars

## Quick Service Checks

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Check all services
app-status

# Backend logs
sudo journalctl -u gamifying-education-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/error.log
```

## Troubleshooting

### "Can't connect via SSH"
```bash
# Check instance is running
aws ec2 describe-instances --filters "Name=tag:Name,Values=gamifying-education-instance" --region us-east-1

# Wait 2 minutes for instance to fully boot
sleep 120

# Try again
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
```

### "Website not loading"
```bash
# Check if DNS is ready (may take 1-2 minutes)
dig yousha.click

# Check SSL certificate status
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
sudo certbot certificates
```

### "SSL certificate failed"
```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# Check logs
sudo tail -100 /var/log/cloud-init-output.log | grep -A 10 "Setting up SSL"

# Manually retry SSL setup
sudo certbot --nginx -d yousha.click -d www.yousha.click --non-interactive --agree-tos --email your-email@example.com
```

## Private Repository Setup (Optional)

If your repository is private:

### Method 1: Deploy Token (Recommended)

```bash
# 1. Generate deploy token in GitHub
# Settings → Deploy keys → Add deploy key → Allow read access

# 2. Add to user_data.sh before git clone:
cat >> ~/.ssh/config << 'EOF'
Host github.com
    StrictHostKeyChecking no
    IdentityFile /root/.ssh/deploy_key
EOF

# 3. Store deploy key in AWS Secrets Manager
aws secretsmanager create-secret \
    --name gamifying-education-deploy-key \
    --secret-string file://deploy_key.pem \
    --region us-east-1

# 4. Update user_data.sh to fetch from Secrets Manager
```

### Method 2: HTTPS with Token

In `user_data.sh`, replace git clone line:

```bash
# Use GitHub personal access token
git clone https://<TOKEN>@github.com/YOUR_USERNAME/YOUR_REPO.git
```

Store token in terraform.tfvars as a variable.

## Cost Estimate

**First Year (Free Tier)**:
- EC2 t4g.micro: Free (750 hours/month)
- 30GB EBS: Free
- Data transfer: Free (100GB/month)
- Elastic IP: Free (while instance running)
- S3 backups: ~$0.50/month
- **Total: ~$6/year**

**After Free Tier (Month 13+)**:
- EC2 t4g.micro: ~$3.50/month
- EBS 30GB: ~$2.40/month
- S3 backups: ~$0.50/month
- **Total: ~$6.50/month (~$78/year)**

## Clean Up (Destroy Resources)

**WARNING**: This deletes everything!

```bash
# Backup first!
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
sudo /opt/scripts/backup-db.sh

# Download backups
aws s3 sync s3://$(terraform output -raw s3_backup_bucket)/backups/ ./backups/

# Destroy
terraform destroy  # Type 'yes' when prompted
```

## Next Steps

1. **Test the application**: Create questions, generate with AI, play the card game
2. **Set up monitoring**: AWS CloudWatch, billing alerts
3. **Configure CI/CD**: Auto-deploy on git push
4. **Add more features**: Enable quiz timer, add more card templates

## Full Documentation

- **Detailed Guide**: See `DEPLOYMENT_README.md`
- **SSH Key Setup**: See `SSH_KEY_SETUP.md`
- **Architecture**: See `../my-deployment.md`

## Get Help

Common issues:
1. DNS not propagating → Wait 2-5 minutes
2. SSL failing → Check Route 53 IAM permissions
3. Backend errors → Check logs: `sudo journalctl -u gamifying-education-backend -f`
4. Database errors → Check: `sudo systemctl status postgresql`

Still stuck? Check the full `DEPLOYMENT_README.md` troubleshooting section.
