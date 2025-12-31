# Terraform Test - Hello World

Simple Terraform setup to verify your AWS configuration is working correctly.

## What This Creates

- ✅ Single EC2 instance (t2.micro - Free Tier)
- ✅ Security group (SSH + HTTP access)
- ✅ Nginx web server with "Hello from Terraform!" page
- ✅ Uses default VPC (no complex networking)

**Cost**: FREE (t2.micro is Free Tier eligible - 750 hours/month)

## Prerequisites

1. **AWS Account** with Free Tier
2. **AWS CLI** configured:
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your AWS Secret Access Key
   # Default region: us-east-1
   # Default output format: json
   ```

3. **Terraform** installed:
   ```bash
   terraform --version
   # Should show version >= 1.0
   ```

4. **SSH Key** created in AWS:
   ```bash
   # Option 1: AWS Console
   # Go to EC2 → Key Pairs → Create key pair
   # Name: gamifying-education-key
   # Download and save to ~/.ssh/

   # Option 2: AWS CLI
   aws ec2 create-key-pair \
       --key-name gamifying-education-key \
       --query 'KeyMaterial' \
       --output text \
       --region us-east-1 \
       > ~/.ssh/gamifying-education-key.pem

   chmod 400 ~/.ssh/gamifying-education-key.pem
   ```

## Quick Start (5 minutes)

### 1. Configure Variables

```bash
cd terraform-test/

# Copy example
cp terraform.tfvars.example terraform.tfvars

# Edit with your SSH key name
nano terraform.tfvars
```

Update `terraform.tfvars`:
```hcl
aws_region    = "us-east-1"
ssh_key_name  = "gamifying-education-key"  # Your SSH key name
instance_type = "t2.micro"
```

### 2. Initialize Terraform

```bash
terraform init
```

Expected output:
```
Terraform has been successfully initialized!
```

### 3. Preview Changes

```bash
terraform plan
```

This shows what will be created. You should see:
- 1 aws_instance
- 1 aws_security_group

### 4. Deploy

```bash
terraform apply
```

Type `yes` when prompted.

**Wait time**: 2-3 minutes

### 5. Test It Works

After deployment, Terraform will show you:
- Instance ID
- Public IP address
- SSH command
- Web URL

**Test SSH**:
```bash
# Use the SSH command from output
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<PUBLIC_IP>

# Inside the instance:
curl localhost  # Should show HTML
exit
```

**Test Web Server** (wait 2-3 minutes for nginx to install):
```bash
# Command line
curl http://<PUBLIC_IP>

# Or open in browser
open http://<PUBLIC_IP>
```

You should see a purple gradient page with "🚀 Hello from Terraform!"

### 6. Clean Up

**Important**: Destroy resources when done to avoid charges!

```bash
terraform destroy
```

Type `yes` when prompted.

This removes everything:
- ✅ EC2 instance deleted
- ✅ Security group deleted
- ✅ No charges

## What You're Testing

✅ **AWS Credentials**: Can Terraform authenticate with AWS?
✅ **EC2 Permissions**: Can you create EC2 instances?
✅ **SSH Key**: Can you connect to instances?
✅ **Networking**: Can instance access internet?
✅ **User Data**: Does initialization script run?

## Troubleshooting

### "Error: No valid credential sources found"
**Problem**: AWS credentials not configured

**Solution**:
```bash
aws configure
# Enter your credentials

# Verify
aws sts get-caller-identity
```

### "InvalidKeyPair.NotFound"
**Problem**: SSH key name doesn't exist in AWS

**Solution**:
```bash
# List your keys
aws ec2 describe-key-pairs --region us-east-1

# Update terraform.tfvars with correct key name
# Or create new key (see Prerequisites)
```

### "Can't SSH to instance"
**Problem**: Instance still booting, or wrong permissions

**Solution**:
```bash
# Wait 1-2 minutes for instance to boot
sleep 60

# Check SSH key permissions
ls -l ~/.ssh/gamifying-education-key.pem
# Should show: -r-------- (400)

# If not:
chmod 400 ~/.ssh/gamifying-education-key.pem

# Try again
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<PUBLIC_IP>
```

### "Web page not loading"
**Problem**: Nginx still installing, or security group issue

**Solution**:
```bash
# Wait 3 minutes for user_data to complete
sleep 180

# Check if nginx installed
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<PUBLIC_IP>
sudo systemctl status nginx
exit

# If not installed, check user data logs:
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<PUBLIC_IP>
sudo tail -f /var/log/cloud-init-output.log
```

## Commands Reference

```bash
# Initialize (first time only)
terraform init

# Preview changes
terraform plan

# Apply changes
terraform apply

# Show current state
terraform show

# List resources
terraform state list

# Get outputs again
terraform output

# Destroy everything
terraform destroy
```

## What's Different from Main Deployment?

| Feature | Test Setup | Main Deployment |
|---------|-----------|-----------------|
| Instance | t2.micro (x86) | t4g.micro (ARM64) |
| VPC | Default VPC | New VPC |
| Application | Simple Nginx | Full app stack |
| SSL | No | Yes (Let's Encrypt) |
| Database | No | PostgreSQL |
| Backups | No | S3 automated |
| Domain | IP only | yousha.click |
| Cost | FREE | ~$5-8/month |

## Cost

**This test costs NOTHING** if you:
- ✅ Use t2.micro (Free Tier: 750 hours/month)
- ✅ Destroy after testing (< 1 hour usage)
- ✅ Are within first 12 months of AWS account

Even outside Free Tier, cost is ~$0.01/hour (1 cent per hour).

## Success Criteria

✅ **Terraform initialized successfully**
✅ **Instance created (terraform apply worked)**
✅ **Can SSH to instance**
✅ **Web page shows "Hello from Terraform!"**
✅ **Can destroy resources (terraform destroy worked)**

**If all pass**: You're ready for the main deployment!

## Next Steps

Once this test works:

1. **Destroy test resources**:
   ```bash
   terraform destroy
   ```

2. **Proceed to main deployment**:
   ```bash
   cd ../terraform/
   # Follow QUICK_START.md or DEPLOYMENT_README.md
   ```

## Files

```
terraform-test/
├── main.tf                    - Main configuration
├── variables.tf               - Input variables
├── outputs.tf                 - Outputs (IP, SSH command)
├── terraform.tfvars.example   - Example config
├── .gitignore                 - Ignore sensitive files
└── README.md                  - This file
```

## Tips

1. **Always run `terraform destroy`** when done testing
2. **Check AWS console** to verify resources are deleted
3. **Free Tier limits**: 750 hours/month per instance type
4. **Region matters**: Make sure terraform.tfvars matches your key's region

## Get Help

- AWS Free Tier: https://aws.amazon.com/free/
- Terraform Docs: https://registry.terraform.io/providers/hashicorp/aws/latest/docs
- EC2 Pricing: https://aws.amazon.com/ec2/pricing/

## Ready to Test?

```bash
cd terraform-test/
cp terraform.tfvars.example terraform.tfvars
nano terraform.tfvars  # Update with your key name
terraform init
terraform plan
terraform apply
```

🚀 Your test instance will be ready in 3 minutes!
