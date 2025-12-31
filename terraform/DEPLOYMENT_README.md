# Terraform Deployment Guide

Complete guide to deploy the Gamifying Education application to AWS.

## Prerequisites

- AWS account with billing enabled
- AWS CLI installed and configured (`aws configure`)
- Terraform installed (version >= 1.0)
- Domain `devops-assignment.today` already configured in Route 53
- OpenAI API key

## Quick Start

### 1. Setup SSH Key

Follow the **SSH_KEY_SETUP.md** guide to create an EC2 key pair.

Quick option (AWS Console):
- Go to EC2 Console → Key Pairs → Create key pair
- Name: `gamifying-education-key`
- Download and save to `~/.ssh/`
- Set permissions: `chmod 400 ~/.ssh/gamifying-education-key.pem`

### 2. Find Your Route 53 Hosted Zone ID

```bash
# List all hosted zones
aws route53 list-hosted-zones

# Find your zone ID for devops-assignment.today
# It looks like: Z0123456789ABC
```

Or in AWS Console: Route 53 → Hosted zones → Click on your domain → Copy the "Hosted zone ID"

### 3. Configure Variables

```bash
cd terraform/

# Copy example file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Required values to update**:

```hcl
# Route 53 Configuration
route53_zone_id = "Z0123456789ABC"  # YOUR ACTUAL ZONE ID

# SSH Configuration
ssh_key_name     = "gamifying-education-key"  # Name of your AWS key pair
allowed_ssh_cidr = "203.0.113.5/32"           # YOUR IP ADDRESS (get with: curl ifconfig.me)

# Generate secure passwords
db_password              = "GENERATE_RANDOM_PASSWORD"
django_secret_key        = "GENERATE_RANDOM_SECRET"
first_superuser_password = "GENERATE_RANDOM_PASSWORD"

# OpenAI Configuration
openai_api_key = "sk-proj-..."  # YOUR OPENAI API KEY

# Your email for SSL certificate notifications
admin_email = "your-email@example.com"
```

**Generate secure passwords**:
```bash
# Run these commands to generate secure values
openssl rand -base64 32  # For db_password
openssl rand -base64 32  # For django_secret_key
openssl rand -base64 32  # For first_superuser_password
```

### 4. Deploy Infrastructure

```bash
cd terraform/

# Initialize Terraform
terraform init

# Review the deployment plan
terraform plan

# Apply (create resources)
terraform apply

# Type 'yes' when prompted
```

**Deployment takes about 8-12 minutes**:
- 1-2 minutes: Create VPC, security groups, S3 bucket
- 1 minute: Launch EC2 instance
- 5-8 minutes: Instance initialization (install packages, setup SSL, deploy app)

### 5. Verify Deployment

```bash
# Get deployment info
terraform output

# The output will show:
# - instance_public_ip: Your server's IP address
# - application_url: https://devops-assignment.today
# - ssh_command: Command to connect via SSH
```

**Check if initialization is complete**:
```bash
# SSH into instance (use the ssh_command from output)
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Watch initialization logs
sudo tail -f /var/log/cloud-init-output.log

# When you see "Instance initialization completed", it's ready!
```

### 6. Access Your Application

Open in browser: **https://devops-assignment.today**

**Default admin credentials**:
- Email: `admin@example.com` (or what you set in terraform.tfvars)
- Password: The `first_superuser_password` from terraform.tfvars

## Post-Deployment

### Check Service Status

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Quick status check
app-status

# Or check individual services
sudo systemctl status gamifying-education-backend
sudo systemctl status nginx
sudo systemctl status postgresql
```

### View Logs

```bash
# Backend logs (live)
sudo journalctl -u gamifying-education-backend -f

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log

# PostgreSQL logs
sudo tail -f /var/log/postgresql/postgresql-16-main.log

# Initialization logs
sudo cat /var/log/cloud-init-output.log
```

### Test Database Connection

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Connect to PostgreSQL
sudo -u postgres psql gamifying_education

# Run test query
SELECT * FROM users LIMIT 5;

# Exit
\q
```

### Manual Backup

```bash
# SSH into instance
sudo /opt/scripts/backup-db.sh

# Verify backup in S3
aws s3 ls s3://gamifying-education-backups-<YOUR_ACCOUNT_ID>/backups/
```

## Updating the Application

### Code Updates

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Pull latest code
cd /opt/gamifying-education
sudo git pull

# Update backend
cd backend
sudo -u root bash -c 'source .venv/bin/activate && uv sync && alembic upgrade head'
sudo systemctl restart gamifying-education-backend

# Update frontend
cd ../frontend
sudo npm install
sudo npm run build
sudo cp -r dist/* /var/www/html/
```

### Environment Variable Updates

```bash
# SSH into instance
sudo nano /opt/gamifying-education/backend/.env

# After editing, restart backend
sudo systemctl restart gamifying-education-backend
```

## Scaling and Optimization

### Monitoring Costs

```bash
# Check current month costs
aws ce get-cost-and-usage \
    --time-period Start=2025-12-01,End=2025-12-31 \
    --granularity MONTHLY \
    --metrics UnblendedCost

# Set up billing alerts in AWS Console
# Billing & Cost Management → Budgets → Create budget
```

### If You Need More Resources

Edit `terraform.tfvars` and change instance type:
```hcl
instance_type = "t4g.small"  # 2 vCPU, 2GB RAM (~$6/month)
# or
instance_type = "t4g.medium"  # 2 vCPU, 4GB RAM (~$12/month)
```

Then apply:
```bash
terraform apply
```

**Note**: Changing instance type requires a restart (downtime ~2 minutes).

## Troubleshooting

### Application not accessible

1. **Check if DNS is propagated**:
   ```bash
   dig devops-assignment.today
   nslookup devops-assignment.today
   ```

2. **Check security group**:
   ```bash
   terraform state show aws_security_group.main
   ```

3. **Check Nginx**:
   ```bash
   ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>
   sudo systemctl status nginx
   sudo nginx -t
   ```

4. **Check SSL certificate**:
   ```bash
   sudo certbot certificates
   ```

### Backend errors

```bash
# Check logs
sudo journalctl -u gamifying-education-backend -n 100

# Restart service
sudo systemctl restart gamifying-education-backend

# Check if it's running
curl http://localhost:8000/api/v1/health || echo "Backend not responding"
```

### Database connection issues

```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check connections
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### SSL/HTTPS issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates

# Test Nginx configuration
sudo nginx -t
sudo systemctl reload nginx
```

## Backup and Restore

### Manual Backup

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Run backup script
sudo /opt/scripts/backup-db.sh

# Download backup locally
aws s3 cp s3://gamifying-education-backups-<ACCOUNT_ID>/backups/db_backup_TIMESTAMP.sql.gz ./
```

### Restore from Backup

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# Download specific backup from S3
aws s3 cp s3://gamifying-education-backups-<ACCOUNT_ID>/backups/db_backup_20250401_020000.sql.gz /tmp/

# Decompress
gunzip /tmp/db_backup_20250401_020000.sql.gz

# Stop backend
sudo systemctl stop gamifying-education-backend

# Restore database
sudo -u postgres psql -c "DROP DATABASE gamifying_education;"
sudo -u postgres psql -c "CREATE DATABASE gamifying_education;"
sudo -u postgres psql gamifying_education < /tmp/db_backup_20250401_020000.sql

# Fix permissions
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE gamifying_education TO app_user;"

# Start backend
sudo systemctl start gamifying-education-backend
```

## Destroying Resources

**WARNING**: This will delete everything (except Route 53 zone)!

```bash
# Preview what will be destroyed
terraform plan -destroy

# Destroy all resources
terraform destroy

# Type 'yes' when prompted
```

**Backup checklist before destroying**:
- [ ] Download database backups from S3
- [ ] Save any important logs
- [ ] Export environment variables if needed
- [ ] Document any manual configuration changes

## Cost Optimization Tips

1. **Use Free Tier**:
   - First 12 months: t4g.micro is free (750 hours/month)
   - 30GB EBS storage is free
   - 100GB data transfer is free

2. **Stop instance when not in use** (for testing):
   ```bash
   aws ec2 stop-instances --instance-ids $(terraform output -raw instance_id)
   # Start again:
   aws ec2 start-instances --instance-ids $(terraform output -raw instance_id)
   ```
   **Note**: Elastic IP charges apply when instance is stopped (~$3.60/month)

3. **Use CloudFlare for DNS** (optional):
   - Free tier includes DNS and CDN
   - Would save $0.50/month (Route 53 hosted zone cost)

4. **Monitor S3 backup costs**:
   ```bash
   aws s3 ls s3://gamifying-education-backups-<ACCOUNT_ID>/backups/ --summarize --human-readable --recursive
   ```

## Security Checklist

- [ ] Change `allowed_ssh_cidr` to your specific IP
- [ ] Rotate passwords every 90 days
- [ ] Enable CloudWatch alarms for high CPU/memory
- [ ] Set up AWS Budget alerts
- [ ] Review S3 backup retention policy
- [ ] Enable MFA on AWS account
- [ ] Regularly update system packages: `sudo apt update && sudo apt upgrade`

## Support

If you encounter issues:

1. Check the logs (see "View Logs" section above)
2. Review Terraform plan: `terraform plan`
3. Verify AWS credentials: `aws sts get-caller-identity`
4. Check AWS service health: https://status.aws.amazon.com/

## Useful Commands

```bash
# Get current Terraform state
terraform show

# List all resources
terraform state list

# Get specific resource details
terraform state show aws_instance.main

# Refresh state (sync with AWS)
terraform refresh

# Format Terraform files
terraform fmt

# Validate configuration
terraform validate

# View outputs again
terraform output

# Update specific resource
terraform apply -target=aws_instance.main

# Import existing resource (if needed)
terraform import aws_eip.main <ALLOCATION_ID>
```

## Next Steps

1. **Set up monitoring**:
   - CloudWatch dashboard
   - AWS SNS alerts for backend errors

2. **Configure CI/CD** (optional):
   - GitHub Actions for automatic deployments
   - Deploy on push to `main` branch

3. **Add staging environment** (optional):
   - Duplicate Terraform config for staging
   - Use different domain: `staging.devops-assignment.today`

4. **Improve backup strategy**:
   - Test restore procedure
   - Set up automated restore testing
   - Consider cross-region backup replication

5. **Performance optimization**:
   - Add Redis caching (ElastiCache or local)
   - Configure CloudFront CDN for static assets
   - Optimize database queries

## Resources

- [AWS EC2 Documentation](https://docs.aws.amazon.com/ec2/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)
- [FastAPI Deployment Guide](https://fastapi.tiangolo.com/deployment/)
- [Nginx Configuration Guide](https://nginx.org/en/docs/)
