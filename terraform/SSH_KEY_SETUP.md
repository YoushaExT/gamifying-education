# SSH Key Setup Guide

This guide will help you create an SSH key pair for accessing your EC2 instance.

## Option 1: Create Key Pair in AWS Console (Easiest)

1. **Go to AWS EC2 Console**
   - Navigate to: https://console.aws.amazon.com/ec2/
   - Select region: **us-east-1**

2. **Create Key Pair**
   - In the left sidebar, click **"Key Pairs"** (under "Network & Security")
   - Click **"Create key pair"** button
   - **Name**: `gamifying-education-key` (or any name you prefer)
   - **Key pair type**: RSA
   - **Private key file format**: `.pem` (for OpenSSH)
   - Click **"Create key pair"**

3. **Download and Save**
   - The `.pem` file will automatically download
   - Move it to your SSH directory:
     ```bash
     mkdir -p ~/.ssh
     mv ~/Downloads/gamifying-education-key.pem ~/.ssh/
     chmod 400 ~/.ssh/gamifying-education-key.pem
     ```

4. **Use in Terraform**
   - In `terraform.tfvars`, set:
     ```hcl
     ssh_key_name = "gamifying-education-key"
     ```

## Option 2: Create Key Pair with AWS CLI

```bash
# Create key pair and save private key
aws ec2 create-key-pair \
    --key-name gamifying-education-key \
    --query 'KeyMaterial' \
    --output text \
    --region us-east-1 \
    > ~/.ssh/gamifying-education-key.pem

# Set correct permissions
chmod 400 ~/.ssh/gamifying-education-key.pem

# Verify it was created
aws ec2 describe-key-pairs --key-names gamifying-education-key --region us-east-1
```

## Option 3: Import Existing SSH Key

If you already have an SSH key pair:

```bash
# Generate new key pair locally (if you don't have one)
ssh-keygen -t rsa -b 4096 -f ~/.ssh/gamifying-education-key -C "your-email@example.com"

# Import public key to AWS
aws ec2 import-key-pair \
    --key-name gamifying-education-key \
    --public-key-material fileb://~/.ssh/gamifying-education-key.pub \
    --region us-east-1
```

## Testing SSH Connection

After Terraform deployment completes:

```bash
# Get the instance IP from Terraform output
terraform output instance_public_ip

# Connect to instance
ssh -i ~/.ssh/gamifying-education-key.pem ubuntu@<INSTANCE_IP>

# If you get "connection refused", wait a minute for the instance to fully boot
# If you get "permission denied", check the file permissions (should be 400)
```

## SSH Configuration (Optional but Convenient)

Add to `~/.ssh/config` for easier access:

```ssh-config
Host gamifying-edu
    HostName <INSTANCE_IP_FROM_TERRAFORM_OUTPUT>
    User ubuntu
    IdentityFile ~/.ssh/gamifying-education-key.pem
    ServerAliveInterval 60
```

Then connect with just:
```bash
ssh gamifying-edu
```

## Troubleshooting

### "Permission denied (publickey)"
- Check file permissions: `chmod 400 ~/.ssh/gamifying-education-key.pem`
- Verify you're using the correct key name in terraform.tfvars
- Make sure you're connecting as user `ubuntu` (not `root` or `ec2-user`)

### "Connection refused"
- Instance is still booting (wait 1-2 minutes)
- Security group not allowing your IP (check `allowed_ssh_cidr` in terraform.tfvars)

### "Host key verification failed"
- If you destroyed and recreated the instance:
  ```bash
  ssh-keygen -R <INSTANCE_IP>
  ```

## Security Best Practices

1. **Protect your private key**:
   - Never commit `.pem` files to git
   - Keep backups in a secure location
   - Set permissions to 400 (read-only for owner)

2. **Restrict SSH access**:
   - In `terraform.tfvars`, set `allowed_ssh_cidr` to your specific IP:
     ```hcl
     allowed_ssh_cidr = "YOUR_IP_ADDRESS/32"
     ```
   - Find your IP: `curl ifconfig.me`

3. **Rotate keys periodically**:
   - Generate new key pair every 6-12 months
   - Update instance to use new key
   - Delete old key from AWS

## What to Do Next

Once you have your SSH key set up:

1. Update `terraform.tfvars` with the key name
2. Proceed with the deployment (see `DEPLOYMENT_README.md`)
3. After deployment, test SSH connection
4. Check application logs: `sudo journalctl -u gamifying-education-backend -f`
