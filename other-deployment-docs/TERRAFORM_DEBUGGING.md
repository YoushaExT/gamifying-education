# Terraform Debugging & Troubleshooting Guide

Complete guide to debugging terraform issues **without** destroying and recreating everything.

---

## Table of Contents

1. [Understanding Terraform State](#understanding-terraform-state)
2. [Incremental Development Workflow](#incremental-development-workflow)
3. [Debugging Specific Resources](#debugging-specific-resources)
4. [Common Issues & Solutions](#common-issues--solutions)
5. [Testing Changes Safely](#testing-changes-safely)
6. [Recovery Procedures](#recovery-procedures)

---

## Understanding Terraform State

Terraform tracks what it created in a **state file** (`terraform.tfstate`). This is crucial for debugging.

### View Current State

```bash
# List all resources
terraform state list

# Show details of a specific resource
terraform state show aws_instance.main
terraform state show aws_db_instance.main

# View entire state (verbose)
terraform show
```

### Key Concept: Targeted Operations

You can apply/destroy **specific resources** without touching others:

```bash
# Apply changes to only one resource
terraform apply -target=aws_instance.main

# Plan changes for specific resources
terraform plan -target=aws_security_group.backend

# Destroy only one resource
terraform destroy -target=aws_instance.main
```

---

## Incremental Development Workflow

### Step 1: Always Plan First

**NEVER** run `terraform apply` blindly. Always review changes:

```bash
cd terraform

# See what would change
terraform plan

# Save plan to file for review
terraform plan -out=tfplan
terraform show tfplan  # Review saved plan
```

### Step 2: Make Small, Focused Changes

Instead of changing 10 things at once:

1. **Change ONE thing** (e.g., security group rule)
2. **Run terraform plan** to see impact
3. **Apply if safe**: `terraform apply`
4. **Test the change**
5. **Move to next change**

### Step 3: Use terraform-test for Quick Validation

Before touching your main infrastructure:

```bash
cd terraform-test

# Copy your variables
cp terraform.tfvars.example terraform.tfvars
# Edit with your values

# Test a small setup
terraform init
terraform plan
terraform apply

# Verify it works (SSH, curl, etc.)

# Clean up test
terraform destroy
```

**Use terraform-test to:**
- Test user_data script changes
- Test security group rules
- Verify AMI selection
- Test IAM role permissions

---

## Debugging Specific Resources

### EC2 Instance Issues

#### Problem: Instance won't start or is unhealthy

**Debug without destroying:**

```bash
# 1. Check instance status
aws ec2 describe-instance-status --instance-ids $(terraform output -raw instance_id) --profile personal-terraform

# 2. View system logs (console output)
aws ec2 get-console-output --instance-id $(terraform output -raw instance_id) --output text --profile personal-terraform

# 3. SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# 4. Check user_data execution
sudo tail -f /var/log/cloud-init-output.log

# 5. Check what failed
sudo journalctl -xe
```

#### Fix: Update user_data without recreating instance

**Option A: Apply script manually over SSH**

```bash
# SSH into instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP

# Copy-paste your user_data script or pull from git
cd /opt/gamifying-education
git pull

# Run fixes manually
sudo docker compose -f docker-compose.prod.yml restart
```

**Option B: Replace instance (keeps other resources)**

```bash
# Only recreate EC2, keeps RDS, ECR, etc.
terraform apply -replace=aws_instance.main
```

#### Fix: Test user_data changes in terraform-test

```bash
cd terraform-test

# Edit main.tf, update user_data section
# Apply to test instance
terraform apply

# SSH and verify
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)

# If it works, copy changes to main terraform
# Then apply to production
```

### RDS Database Issues

#### Problem: Connection timeout

**Debug:**

```bash
# 1. Check RDS is running
aws rds describe-db-instances --query "DBInstances[0].{Status:DBInstanceStatus,Endpoint:Endpoint.Address}" --profile personal-terraform

# 2. Test connection from EC2
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP
pg_isready -h YOUR_RDS_ENDPOINT -U app_user

# 3. Check security group
terraform state show aws_security_group.rds

# 4. Verify EC2 security group allows outbound to RDS
terraform state show aws_security_group.backend
```

**Fix: Update security group without recreating RDS**

```bash
# Edit terraform/security_groups.tf
# Update ingress rules

# Apply only security group changes
terraform apply -target=aws_security_group.rds -target=aws_security_group.backend

# Test connection again (no downtime!)
```

#### Problem: Wrong database parameters

**Debug:**

```bash
# View current RDS config
aws rds describe-db-instances --db-instance-identifier $(terraform state show aws_db_instance.main | grep "id " | awk '{print $3}' | tr -d '"') --profile personal-terraform

# Check parameter group
terraform state show aws_db_parameter_group.main
```

**Fix: Update parameters**

```bash
# Edit terraform/rds.tf
# Modify db_instance_class, allocated_storage, etc.

# Apply only RDS changes
terraform plan -target=aws_db_instance.main

# Some changes require downtime (instance class)
# Others don't (allocated_storage increase)
terraform apply -target=aws_db_instance.main
```

### Security Group Issues

#### Problem: Can't SSH / Can't access application

**Debug:**

```bash
# 1. Check your current IP
curl -4 ifconfig.me

# 2. Check security group rules
aws ec2 describe-security-groups --group-ids $(terraform output -raw security_group_id) --profile personal-terraform

# 3. Check instance security group associations
aws ec2 describe-instances --instance-ids $(terraform output -raw instance_id) --query "Reservations[0].Instances[0].SecurityGroups" --profile personal-terraform
```

**Fix: Update security group rules**

```bash
# Edit terraform/security_groups.tf
# Update allowed_ssh_cidr or add rules

# Apply only security group changes
terraform apply -target=aws_security_group.main

# Test immediately (no instance restart needed)
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP
```

### Route53 / DNS Issues

#### Problem: Domain not resolving

**Debug:**

```bash
# 1. Check nameservers (should already be AWS since domain bought from AWS)
dig yousha.click NS +short

# 2. Check A record exists
dig yousha.click A +short

# 3. Check Route53 hosted zone
aws route53 list-resource-record-sets --hosted-zone-id YOUR_ZONE_ID --profile personal-terraform

# 4. Verify zone ID matches
terraform state show data.aws_route53_zone.main
```

**Fix: Update DNS records**

```bash
# Edit terraform/vpc.tf (if managing DNS in terraform)
# Or manually add A record in AWS Console

# If zone_id wrong, update variables
# Apply only Route53 changes
terraform apply -target=aws_route53_record.main
```

### ECR Issues

#### Problem: Can't push/pull images

**Debug:**

```bash
# 1. Check ECR repositories exist
aws ecr describe-repositories --profile personal-terraform

# 2. Test authentication
aws ecr get-login-password --region us-east-1 --profile personal-terraform | docker login --username AWS --password-stdin $(terraform output -raw ecr_registry)

# 3. Check IAM permissions
terraform state show aws_iam_role_policy.ecr_policy
```

**Fix: Update ECR or IAM policies**

```bash
# Edit terraform/ecr.tf or terraform/iam.tf

# Apply only affected resources
terraform apply -target=aws_ecr_repository.backend -target=aws_iam_role_policy.ecr_policy
```

---

## Common Issues & Solutions

### Issue 1: "Resource already exists"

**Error**: Resource was created outside terraform or state is out of sync.

**Solution A: Import existing resource**

```bash
# Import into terraform state
terraform import aws_instance.main i-1234567890abcdef

# Verify import worked
terraform plan  # Should show no changes
```

**Solution B: Remove from state and recreate**

```bash
# Remove from state (doesn't delete resource)
terraform state rm aws_instance.main

# Re-import or apply to create new one
```

### Issue 2: "State lock" error

**Error**: Another terraform process is running or crashed.

**Solution:**

```bash
# Check who has the lock
terraform force-unlock LOCK_ID

# Or delete lock manually (if using local state)
rm -f terraform.tfstate.lock.info
```

### Issue 3: "Changes outside of Terraform"

**Warning**: Resource was modified outside terraform (AWS Console, CLI, etc.).

**Solution:**

```bash
# Option A: Accept the changes
terraform apply -refresh-only

# Option B: Revert to terraform config
terraform apply  # Will overwrite manual changes
```

### Issue 4: Dependency errors

**Error**: "Error: resource depends on X which is being destroyed"

**Solution:**

```bash
# View dependency graph
terraform graph | dot -Tpng > graph.png
open graph.png

# Remove/modify dependency in terraform code
# Or apply changes in order:
terraform apply -target=aws_instance.main
terraform apply  # Apply rest
```

### Issue 5: "Invalid index" or "value is null"

**Error**: Usually in data sources or lookups.

**Debug:**

```bash
# Enable verbose logging
export TF_LOG=DEBUG
terraform plan

# Check data source values
terraform console
> data.aws_ami.ubuntu.id
> var.domain_name
```

---

## Testing Changes Safely

### 1. Use terraform-test Directory

```bash
cd terraform-test

# Make experimental changes here first
vim main.tf

# Test without risk
terraform apply

# Verify it works
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@$(terraform output -raw instance_public_ip)
curl http://$(terraform output -raw instance_public_ip)

# Clean up
terraform destroy

# Copy working changes to main terraform
```

### 2. Use terraform plan -out

```bash
cd terraform

# Generate and review plan
terraform plan -out=tfplan

# Review in detail
terraform show tfplan | less

# Apply only if safe
terraform apply tfplan
```

### 3. Use -target for Risky Changes

```bash
# Apply only the resource you changed
terraform apply -target=aws_instance.main

# Verify it works
# Then apply rest
terraform apply
```

### 4. Backup State Before Big Changes

```bash
# Backup state file
cp terraform.tfstate terraform.tfstate.backup.$(date +%Y%m%d_%H%M%S)

# Make changes
terraform apply

# If disaster, restore
# cp terraform.tfstate.backup.TIMESTAMP terraform.tfstate
```

---

## Recovery Procedures

### Scenario 1: Terraform state is corrupted

```bash
# Option A: Restore from backup
cp terraform.tfstate.backup.TIMESTAMP terraform.tfstate

# Option B: Rebuild state from AWS
terraform import aws_instance.main i-INSTANCEID
terraform import aws_db_instance.main db-DBID
# ... import all resources

# Option C: Delete state and start fresh
# WARNING: This will try to recreate everything
rm terraform.tfstate
terraform init
terraform plan  # Review carefully
```

### Scenario 2: Wrong resource was destroyed

```bash
# Recreate only that resource
terraform apply -target=aws_instance.main

# Or modify terraform code to recreate with different name
# Then apply
```

### Scenario 3: Can't connect to instance after changes

```bash
# 1. Check instance is running
aws ec2 describe-instances --instance-ids $(terraform output -raw instance_id) --profile personal-terraform

# 2. Revert security group changes
git log terraform/security_groups.tf  # Find last working commit
git checkout COMMIT_HASH terraform/security_groups.tf
terraform apply -target=aws_security_group.main

# 3. If instance is broken, replace it
terraform apply -replace=aws_instance.main
```

### Scenario 4: RDS connection lost after changes

```bash
# 1. Check RDS is running
aws rds describe-db-instances --profile personal-terraform

# 2. Check security groups allow connection
terraform state show aws_security_group.rds

# 3. Revert RDS security group changes
git checkout HEAD~1 terraform/security_groups.tf
terraform apply -target=aws_security_group.rds

# 4. Test connection from EC2
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@INSTANCE_IP
pg_isready -h RDS_ENDPOINT -U app_user
```

---

## Debugging Workflow Cheat Sheet

### When something breaks:

```bash
# 1. DON'T PANIC - Don't destroy everything!

# 2. Identify what changed
git diff HEAD~1

# 3. Check terraform state
terraform state list
terraform show

# 4. View what terraform wants to do
terraform plan

# 5. Check actual AWS resources
aws ec2 describe-instances --profile personal-terraform
aws rds describe-db-instances --profile personal-terraform
aws ecr describe-repositories --profile personal-terraform

# 6. SSH into EC2 and check logs
ssh -i ~/.ssh/KEY.pem ubuntu@IP
sudo tail -f /var/log/cloud-init-output.log
docker logs CONTAINER_NAME

# 7. Fix incrementally
# - Edit ONE file
# - terraform plan -target=RESOURCE
# - terraform apply -target=RESOURCE
# - Test
# - Repeat

# 8. If instance is broken beyond repair
terraform apply -replace=aws_instance.main
# (Keeps RDS, ECR, everything else)
```

---

## Best Practices to Avoid Issues

### 1. Always use version control

```bash
# Before major changes
git checkout -b terraform-update-security-groups
# Make changes
git commit -m "Update security groups for..."
# If it breaks, revert
git checkout main
terraform apply
```

### 2. Use terraform workspace for staging

```bash
# Create staging workspace
terraform workspace new staging

# Make risky changes in staging
terraform apply

# Test thoroughly
# Switch back to default (production)
terraform workspace select default
```

### 3. Enable terraform backend (S3)

```hcl
# terraform/main.tf
terraform {
  backend "s3" {
    bucket = "your-terraform-state-bucket"
    key    = "gamifying-education/terraform.tfstate"
    region = "us-east-1"

    # State locking
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

Benefits:
- State versioning (can rollback)
- State locking (prevents concurrent changes)
- Team collaboration

### 4. Use terraform modules for reusable components

```hcl
# terraform/modules/ec2/main.tf
# Define EC2 module once
# Reuse in staging, production, testing

# terraform/main.tf
module "production_ec2" {
  source = "./modules/ec2"
  environment = "production"
}

module "staging_ec2" {
  source = "./modules/ec2"
  environment = "staging"
}
```

### 5. Use terraform validate before apply

```bash
# Catch syntax errors early
terraform validate

# Format code
terraform fmt -recursive

# Then plan and apply
terraform plan
terraform apply
```

---

## Useful Debugging Commands

```bash
# View terraform logs
export TF_LOG=DEBUG
export TF_LOG_PATH=./terraform.log
terraform apply
cat terraform.log | grep ERROR

# Interactive console
terraform console
> aws_instance.main.public_ip
> var.domain_name

# Refresh state from AWS
terraform refresh

# Graph dependencies
terraform graph | dot -Tpng > graph.png

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Check for unused variables
terraform fmt -check

# Show resource details
terraform state show RESOURCE_NAME

# List all resources
terraform state list

# Remove resource from state (doesn't delete)
terraform state rm RESOURCE_NAME

# Move resource in state
terraform state mv OLD_NAME NEW_NAME

# Import existing resource
terraform import RESOURCE_NAME RESOURCE_ID

# Taint resource (force recreation)
terraform taint RESOURCE_NAME

# Untaint resource
terraform untaint RESOURCE_NAME

# Replace specific resource
terraform apply -replace=RESOURCE_NAME
```

---

## Quick Reference: Common Fixes

| Problem | Command |
|---------|---------|
| Security group wrong | `terraform apply -target=aws_security_group.main` |
| EC2 script failed | SSH in, manually run script, or `-replace` |
| RDS won't connect | Check security groups, test with `pg_isready` |
| DNS not working | Check nameservers with `dig`, update A record |
| State locked | `terraform force-unlock LOCK_ID` |
| Resource exists | `terraform import RESOURCE_NAME ID` |
| Need to test change | Use `terraform-test/` directory first |
| Wrong region | Update `terraform.tfvars`, `terraform apply` |
| Destroyed wrong thing | `terraform apply -target=DESTROYED_RESOURCE` |
| Total disaster | Restore `terraform.tfstate` from backup |

---

## Emergency Contacts / Resources

- **Terraform Registry**: https://registry.terraform.io/
- **AWS Provider Docs**: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- **Terraform CLI Docs**: https://www.terraform.io/cli/commands
- **Your backups**: `terraform.tfstate.backup.*`
- **Git history**: `git log --oneline terraform/`

---

## Remember

- **Start small**: Test in terraform-test first
- **Target specific resources**: Use `-target` flag
- **Always plan first**: Never blind apply
- **Backup state**: Before major changes
- **Use git**: Commit before risky changes
- **Don't destroy everything**: Fix incrementally
- **SSH is your friend**: Check logs on EC2 directly
- **AWS Console**: Verify actual state vs terraform state

**The key principle**: Terraform tracks state. You can fix individual resources without touching others. Use `-target` flag to be surgical, not destructive.
