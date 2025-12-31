# ECR Terraform (Long-lived Resources)

This terraform project manages **ECR repositories only**. These are long-lived resources that persist even when you destroy the main infrastructure.

## Why Separate?

- **Preserve Docker images** when destroying/recreating EC2, RDS, etc.
- **Faster iteration** - destroy main infra without losing images
- **Cost effective** - ECR storage is cheap (~$0.10/GB/month)
- **Deploy once, rarely change** - ECR repos don't change often

## Setup

```bash
cd terraform-ecr
cp terraform.tfvars.example terraform.tfvars
vim terraform.tfvars  # Fill in values (same as main terraform)

terraform init
terraform apply
```

## Outputs

After applying, note these outputs:
- `backend_repository_url`
- `backend_repository_name`
- `frontend_repository_url`
- `frontend_repository_name`
- `ecr_registry`

You'll use these when deploying the main infrastructure.

## Usage

**First time:**
1. Deploy ECR repos (this project): `terraform apply`
2. Deploy main infrastructure (`../terraform`): `terraform apply`

**When testing:**
- Destroy main infrastructure: `cd ../terraform && terraform destroy`
- ECR repos remain intact with your images
- Redeploy: `cd ../terraform && terraform apply`

**Only destroy ECR if:**
- You're completely done with the project
- You want to start fresh (will lose all Docker images!)

## Cost

ECR repositories themselves are free. You only pay for:
- Storage: ~$0.10/GB/month
- Data transfer (pulling images): varies

With lifecycle policy keeping last 5 images only, cost is minimal (~$0.50/month).
