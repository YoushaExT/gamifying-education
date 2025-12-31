#!/bin/bash
# Simple destroy script
# Just runs terraform destroy with confirmation

cd "$(dirname "$0")/../terraform" || exit 1

echo "=== Destroying Infrastructure ==="
echo ""
echo "This will destroy:"
echo "  - EC2 instance"
echo "  - RDS database"
echo "  - ECR repositories"
echo "  - S3 backups"
echo ""
echo "This will NOT destroy:"
echo "  - Route53 hosted zone (keeps costing \$0.50/month)"
echo ""

terraform destroy
