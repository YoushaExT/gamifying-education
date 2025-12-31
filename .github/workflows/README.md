# GitHub Actions Workflows

## Active Workflow

**`deploy.yml`** - ✅ **ACTIVE - Modern OIDC Deployment**

This is the **only active workflow** for automated deployments.

**Triggers**: Push to `main` branch

**What it does**:
1. Authenticates with AWS using OIDC (no keys!)
2. Builds Docker images (backend + frontend)
3. Pushes to Amazon ECR
4. Deploys to EC2 via SSM Session Manager
5. Restarts containers

**Setup**: See `/CI_CD_README.md` or `/terraform/CI_CD_SETUP.md`

## About This Workflow

- **Authentication**: GitHub OIDC → AWS (no AWS access keys stored!)
- **Registry**: Amazon ECR (private)
- **Deployment**: SSM Session Manager (no SSH keys!)
- **Infrastructure**: Managed by Terraform

## Required GitHub Secrets

Only 2 secrets needed:
- `AWS_ROLE_ARN` - From `terraform output github_actions_role_arn`
- `EC2_INSTANCE_ID` - From `terraform output instance_id`

**No AWS access keys required!** 🎉

## Original Template Workflows

The FastAPI template had different workflows (`deploy-staging.yml`, `deploy-production.yml`) using:
- SSH-based deployment
- Traefik reverse proxy
- Multiple environments

These have been replaced with our modern AWS setup.

**Old template reference**: See `/deployment-reference/` directory

## Workflow Comparison

| Feature | Template Workflows | Current Workflow (deploy.yml) |
|---------|-------------------|-------------------------------|
| Auth | SSH keys | **OIDC** (no keys!) |
| Registry | Manual | **Amazon ECR** |
| Deploy Method | SSH + rsync | **SSM Session Manager** |
| Proxy | Traefik | **Nginx** (on EC2) |
| Database | PostgreSQL container | **RDS** (managed) |
| Infrastructure | Manual | **Terraform** |
| Secrets Needed | Many (SSH keys, etc) | **Just 2** (role ARN + instance ID) |

## Running Workflows

**Automatic**: Push to `main` branch
```bash
git push origin main
```

**Manual**:
- Go to GitHub → Actions → deploy workflow → Run workflow

## Monitoring

**View logs**: GitHub → Actions tab → Click workflow run

**On server**:
```bash
# With Docker (CI/CD active)
docker logs -f gamifying-education-backend

# View all containers
docker ps
```

## Troubleshooting

**"Unable to locate credentials"**
→ Check `github_repo` in `terraform.tfvars` matches exactly

**"Instance not found"**
→ Ensure SSM agent is running on EC2

**"Cannot connect to Docker daemon"**
→ Restart Docker: `sudo systemctl restart docker`

## More Information

- **Complete CI/CD setup**: `/terraform/CI_CD_SETUP.md`
- **Quick reference**: `/CI_CD_README.md`
- **Overview**: `/DEPLOYMENT_SUMMARY.md`

---

**Status**: ✅ Using modern OIDC deployment
**Template workflows**: ⚠️ Not used (see `/deployment-reference/`)
