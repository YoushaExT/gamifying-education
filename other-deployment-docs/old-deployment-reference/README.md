# Deployment Reference (Not In Use)

This directory contains the **original FastAPI template deployment setup** for reference only.

⚠️ **These files are NOT used in the current deployment setup!**

## What's Here

These are the deployment files from the original FastAPI full-stack template:

- `deployment.md` - Original deployment guide (Traefik + SSH-based)
- `deploy-production.yml` - Original production deployment workflow (SSH)
- `deploy-staging.yml` - Original staging deployment workflow (SSH)

## Current Deployment Method

**We use a modern AWS deployment with OIDC authentication.**

See the active deployment documentation in the project root:

- **Quick Start**: `/CI_CD_README.md`
- **Complete Guide**: `/terraform/CI_CD_SETUP.md`
- **Architecture Plan**: `/my-deployment.md`
- **Summary**: `/DEPLOYMENT_SUMMARY.md`

## Key Differences

| Feature | Template (This Directory) | Current Setup (Active) |
|---------|---------------------------|------------------------|
| Platform | Any server with Docker | AWS (EC2 + RDS) |
| Reverse Proxy | Traefik | Traefik |
| Authentication | SSH keys | **OIDC (no keys!)** |
| Database | PostgreSQL in Docker | **RDS PostgreSQL** |
| Registry | Manual Docker images | **Amazon ECR** |
| Deployment | SSH from GitHub Actions | **SSM Session Manager** |
| SSL | Traefik + Let's Encrypt | Nginx + Let's Encrypt |
| Infrastructure | Manual setup | **Terraform** |

## Why We Switched

✅ **Better Security**: OIDC authentication, no long-lived credentials
✅ **Managed Database**: RDS with automated backups
✅ **Infrastructure as Code**: Terraform for reproducible deployments
✅ **AWS Integration**: Native AWS services with proper IAM roles
✅ **No SSH Key Management**: SSM Session Manager
✅ **Cost Optimized**: Uses AWS Free Tier where possible

## If You Want to Use Template Deployment

If you prefer the original template deployment (Traefik-based):

1. This works on any server with Docker (not AWS-specific)
2. Follow `deployment.md` in this directory
3. You'll need to:
   - Set up Traefik manually
   - Configure wildcard DNS
   - Use SSH-based deployment
   - Run PostgreSQL in Docker (no RDS)

## Current Active Files

Active deployment files (in project root and terraform/):

```
.github/workflows/
└── deploy.yml                 # ✅ ACTIVE - OIDC + ECR deployment

terraform/
├── *.tf files                # ✅ ACTIVE - Infrastructure
├── CI_CD_SETUP.md           # ✅ ACTIVE - Complete setup guide
└── user_data.sh             # ✅ ACTIVE - Auto-configuration

Root directory:
├── CI_CD_README.md          # ✅ ACTIVE - Quick reference
├── DEPLOYMENT_SUMMARY.md    # ✅ ACTIVE - Overview
├── my-deployment.md         # ✅ ACTIVE - Architecture plan
├── docker-compose.prod.yml  # ✅ ACTIVE - Production compose
├── backend/Dockerfile       # ✅ ACTIVE - Backend image
└── frontend/Dockerfile.prod # ✅ ACTIVE - Frontend image

deployment-reference/
├── README.md (this file)    # Reference only
└── deployment.md            # ⚠️ NOT USED - Template guide
```

## Need Help?

For the current deployment:
- See `/terraform/CI_CD_SETUP.md` for complete instructions
- See `/CI_CD_README.md` for quick commands
- Check `/DEPLOYMENT_SUMMARY.md` for overview

---

**Remember**: Files in this directory are for **reference only** and are **not used** in the current deployment!
