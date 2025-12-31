# Differences: Template vs Current Deployment

This document explains the differences between the original FastAPI template deployment and our current AWS deployment.

## Quick Comparison

| Aspect | Original Template | Current AWS Setup |
|--------|------------------|-------------------|
| **Platform** | Any Linux server | AWS (EC2 + RDS) |
| **Setup** | Manual | **Terraform (IaC)** |
| **Reverse Proxy** | Traefik | **Traefik** |
| **Database** | PostgreSQL container | **RDS PostgreSQL** |
| **SSL/HTTPS** | Traefik + Let's Encrypt | **Traefik + Let's Encrypt** |
| **Authentication** | SSH keys | **OIDC (no keys!)** |
| **Docker Registry** | Build on server | **Amazon ECR** |
| **Deployment** | SSH + rsync | **SSM Session Manager** |
| **Cost** | Server cost only | **AWS services (~$21/mo)** |
| **Environments** | staging + production | **Single production** (can add staging) |
| **Infrastructure** | Manual setup | **Automated (Terraform)** |

## Detailed Differences

### 1. Platform & Infrastructure

**Template**:
- Any Linux server (VPS, bare metal, etc.)
- Manual server setup
- Manual Docker installation
- No infrastructure as code

**Current**:
- AWS EC2 + RDS + ECR + VPC
- Terraform manages everything
- Reproducible infrastructure
- Version-controlled setup

### 2. Reverse Proxy & SSL

**Template**:
```
Traefik (Docker container)
├── Automatic HTTPS (Let's Encrypt)
├── Dynamic routing
├── Wildcard domains (*.example.com)
└── Dashboard UI
```

**Current**:
```
Traefik (Docker container)
├── Automatic HTTPS (Let's Encrypt)
├── Dynamic routing via Docker labels
├── Single domain (devops-assignment.today)
└── Dashboard UI (optional)
```

**Why same**: Traefik provides automatic HTTPS, dynamic routing, and integrates perfectly with Docker.

### 3. Database

**Template**:
```yaml
# PostgreSQL in Docker
services:
  db:
    image: postgres:16
    volumes:
      - app-db-data:/var/lib/postgresql/data
```

**Current**:
```
RDS PostgreSQL db.t3.micro
├── Managed by AWS
├── Automated backups (7 days)
├── Point-in-time recovery
├── Automatic updates
└── Better isolation
```

**Why changed**: Managed service, automated backups, better separation of concerns.

### 4. Authentication & Deployment

**Template**:
```yaml
# GitHub Actions with SSH
- name: Deploy
  uses: appleboy/ssh-action@master
  with:
    host: ${{ secrets.PRODUCTION_HOST }}
    username: ${{ secrets.PRODUCTION_USER }}
    key: ${{ secrets.PRODUCTION_SSH_KEY }}
```

**Current**:
```yaml
# GitHub Actions with OIDC
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    role-to-assume: ${{ secrets.AWS_ROLE_ARN }}  # OIDC, no keys!
    aws-region: us-east-1

- name: Deploy via SSM
  run: aws ssm send-command ...
```

**Why changed**:
- No long-lived credentials
- No SSH key rotation needed
- More secure (temporary tokens)
- AWS best practices

### 5. Docker Images

**Template**:
- Build images during deployment
- No registry (images built on server)
- Or use Docker Hub

**Current**:
- Build on GitHub Actions
- Push to private Amazon ECR
- Pull on EC2 for deployment
- Image vulnerability scanning

**Why changed**: Faster deployments, better security, image history.

### 6. Multi-Environment Setup

**Template**:
```
Traefik (traefik-public network)
├── Production
│   ├── api.example.com
│   ├── dashboard.example.com
│   └── adminer.example.com
└── Staging
    ├── api.staging.example.com
    ├── dashboard.staging.example.com
    └── adminer.staging.example.com
```

**Current**:
```
Single Production
└── devops-assignment.today
    ├── Frontend served by Nginx
    └── Backend proxied to FastAPI
```

**Can add staging**: Deploy another EC2 + RDS with Terraform workspace.

### 7. Cost Comparison

**Template** (Example: DigitalOcean):
- Droplet (2GB): $12/month
- Managed PostgreSQL: $15/month
- **Total**: ~$27/month

**Current** (AWS):
- EC2 t4g.micro: Free (12 months), then $3.50/month
- RDS db.t3.micro: Free (12 months), then $15/month
- RDS storage: ~$2.30/month
- ECR: ~$1-2/month
- **Total Year 1**: ~$6-10/month (with Free Tier)
- **Total After**: ~$21-22/month

### 8. Setup Complexity

**Template**:
```bash
# Manual setup required:
1. Provision server
2. Install Docker manually
3. Create Traefik setup
4. Configure DNS (wildcards)
5. Set up environment variables
6. Deploy with docker-compose
```

**Current**:
```bash
# Automated with Terraform:
1. Update terraform.tfvars
2. terraform apply
3. Wait 12-15 minutes
4. Done! (including SSL)
```

### 9. Security Features

**Template**:
- SSH keys (need rotation)
- Traefik Basic Auth
- Docker network isolation
- Let's Encrypt SSL

**Current**:
- **OIDC** (temporary tokens)
- **RDS** in private subnet
- **Security groups** (firewall)
- **SSM Session Manager** (no SSH keys)
- **IAM roles** (least privilege)
- Let's Encrypt SSL
- Image scanning (ECR)

### 10. Monitoring & Logs

**Template**:
```bash
# Manual on server
ssh user@server
docker compose logs -f backend
```

**Current**:
```bash
# Multiple options:
1. SSH with SSM (no keys): aws ssm start-session
2. CloudWatch Logs (optional)
3. Standard journalctl: journalctl -u backend -f
4. Docker logs (with CI/CD): docker logs -f backend
```

## When to Use Each Approach

### Use Template Approach If:
- ✅ You have your own non-AWS server
- ✅ You want multi-domain setup (*.example.com)
- ✅ You prefer Traefik's features
- ✅ You don't want AWS dependency
- ✅ You need multiple environments on same server

### Use Current Approach If:
- ✅ You want AWS-native deployment
- ✅ You prefer managed database (RDS)
- ✅ You want infrastructure as code
- ✅ You want OIDC security
- ✅ You're okay with AWS costs
- ✅ You want automated setup

## Migration Path

### From Template to Current (AWS):
1. Already done! ✅
2. Infrastructure defined in Terraform
3. CI/CD with OIDC
4. Just need to deploy

### From Current to Template:
If you want to move away from AWS:
1. Use files in `deployment-reference/`
2. Provision any Linux server
3. Follow `deployment.md`
4. Export RDS data to PostgreSQL container
5. Update DNS to point to new server

## Files Location

**Template Files** (Reference only):
```
deployment-reference/
├── README.md (overview)
├── DIFFERENCES.md (this file)
└── deployment.md (original guide)
```

**Current Files** (Active):
```
.github/workflows/deploy.yml
terraform/*.tf
terraform/CI_CD_SETUP.md
CI_CD_README.md
DEPLOYMENT.md
```

## Summary

The current AWS deployment is **more modern and secure**, with:
- Infrastructure as code
- OIDC authentication
- Managed database
- Better security

The template approach is **simpler and platform-agnostic**, with:
- Works on any server
- Traefik's powerful features
- Multi-environment on single server
- No AWS dependency

Both are valid! We chose AWS for better security and management.

---

**Active**: AWS deployment with OIDC
**Reference**: Template deployment in this directory
