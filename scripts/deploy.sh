#!/bin/bash
# Simple deployment script
# Just runs terraform apply with some helpful output

cd "$(dirname "$0")/../terraform" || exit 1

echo "=== Deploying Gamifying Education ==="
echo ""

# Check terraform.tfvars exists
if [ ! -f "terraform.tfvars" ]; then
    echo "ERROR: terraform.tfvars not found"
    echo "Run: cp terraform.tfvars.example terraform.tfvars"
    echo "Then fill in your values"
    exit 1
fi

# Init and apply
terraform init
terraform apply

# Save outputs
if [ $? -eq 0 ]; then
    terraform output > ../deployment-outputs.txt
    echo ""
    echo "=== Deployment Complete ==="
    echo ""
    echo "Application URL: $(terraform output -raw application_url 2>/dev/null)"
    echo "Instance IP:     $(terraform output -raw instance_public_ip 2>/dev/null)"
    echo ""
    echo "Wait 10-15 minutes for initialization to complete."
    echo "Then access your app at the URL above."
fi
