# Traefik Setup Guide

This document explains the Traefik configuration for automatic HTTPS with Let's Encrypt.

## Overview

We use Traefik v3.2 as a reverse proxy and load balancer that:
- Routes traffic to backend and frontend services
- Automatically manages HTTPS certificates via Let's Encrypt
- Uses Route53 DNS challenge for certificate validation
- Automatically redirects HTTP to HTTPS

## Architecture

```
Internet → Traefik (443/80) → Backend (8000) or Frontend (80)
                ↓
         Let's Encrypt (via Route53 DNS)
```

## How It Works

### 1. Traefik Service
- Runs as a Docker container on EC2
- Listens on ports 80 (HTTP) and 443 (HTTPS)
- Reads Docker labels from other containers to configure routing
- Uses EC2 instance IAM role for Route53 access (no hardcoded credentials!)

### 2. Let's Encrypt Certificate Management
- **Method**: DNS-01 challenge via AWS Route53
- **Why DNS challenge?** Works even if ports 80/443 are blocked, and allows wildcard certificates
- **Automatic renewal**: Traefik handles this automatically
- **Storage**: Certificates stored in `/letsencrypt/acme.json` (persisted via Docker volume)

### 3. Route53 DNS Challenge Flow
1. Traefik requests a certificate from Let's Encrypt
2. Let's Encrypt asks Traefik to prove domain ownership
3. Traefik creates a TXT record in Route53: `_acme-challenge.yousha.click`
4. Let's Encrypt verifies the TXT record exists
5. Certificate issued and stored
6. Traefik automatically cleans up the TXT record

## Required AWS Resources (Managed by Terraform)

### EC2 IAM Role Permissions
The EC2 instance has an IAM role with:
- `route53:ListHostedZones` - List all hosted zones
- `route53:GetChange` - Check status of DNS changes
- `route53:ChangeResourceRecordSets` - Create/delete DNS records for ACME challenge

See `terraform/iam.tf` for details.

### Route53 Hosted Zone
- Domain: `yousha.click`
- Managed in: `terraform/vpc.tf`
- Hosted Zone ID is passed to Traefik via environment variable

## Configuration Files

### docker-compose.prod.yml
Defines the Traefik service with:
- **Ports**: 80, 443
- **Command**: Traefik configuration flags
- **Labels**: Service routing rules
- **Environment**: AWS region and hosted zone ID (credentials via IAM role)

### Traefik Labels on Services

**Backend (FastAPI):**
```yaml
labels:
  - "traefik.http.routers.backend.rule=Host(`yousha.click`) && PathPrefix(`/api/v1`, `/docs`, `/redoc`, `/openapi.json`)"
  - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
```

**Frontend (React/nginx):**
```yaml
labels:
  - "traefik.http.routers.frontend.rule=Host(`yousha.click`)"
  - "traefik.http.routers.frontend.priority=1"  # Lower priority = catch-all
  - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
```

## Environment Variables

These are set by `terraform/user_data.sh` during instance initialization:

```bash
DOMAIN_NAME=yousha.click        # Your domain
ADMIN_EMAIL=yousha234@gmail.com            # For Let's Encrypt notifications
AWS_REGION=us-east-1                       # Your AWS region
AWS_HOSTED_ZONE_ID=Z1234567890ABC          # Route53 hosted zone ID
```

**Note**: AWS credentials are NOT needed - Traefik uses the EC2 instance's IAM role automatically.

## Deployment Flow

1. **Terraform provisions infrastructure:**
   - EC2 instance with IAM role
   - Route53 hosted zone
   - Security groups (allow 80, 443)
   - ECR repositories
   - RDS database

2. **user_data.sh runs on instance startup:**
   - Installs Docker
   - Clones repository
   - Creates `.env` file with terraform outputs
   - Runs database migrations
   - Starts Docker Compose

3. **Docker Compose starts services:**
   - Traefik starts first
   - Backend and frontend start with Traefik labels
   - Traefik reads labels and configures routes

4. **Traefik requests certificates:**
   - Detects `tls.certresolver=letsencrypt` label
   - Initiates DNS-01 challenge via Route53
   - Stores certificates in volume
   - Serves HTTPS traffic

## Testing & Verification

### Check Traefik is running:
```bash
docker ps | grep traefik
```

### View Traefik logs:
```bash
docker logs gamifying-education-traefik -f
```

### Check certificate acquisition:
```bash
# Look for "Certificate obtained successfully"
docker logs gamifying-education-traefik | grep -i certificate
```

### Access Traefik dashboard:
```
https://yousha.click/dashboard/
```
(Note: Requires basic auth if uncommented in docker-compose.prod.yml)

### Verify HTTPS:
```bash
curl -I https://yousha.click
# Should return: HTTP/2 200
```

### Check Route53 TXT records during challenge:
```bash
aws route53 list-resource-record-sets \
  --hosted-zone-id $AWS_HOSTED_ZONE_ID \
  --query "ResourceRecordSets[?contains(Name, '_acme-challenge')]"
```

## Common Issues

### Issue: Certificate not obtained
**Symptoms**: "Unable to obtain ACME certificate" in logs

**Solutions:**
1. Verify Route53 hosted zone ID is correct:
   ```bash
   aws route53 list-hosted-zones
   ```

2. Check IAM role permissions:
   ```bash
   aws sts get-caller-identity  # Verify instance role
   ```

3. Verify domain nameservers:
   ```bash
   dig yousha.click NS
   # Should return AWS Route53 nameservers
   ```

4. Check Traefik logs for detailed error:
   ```bash
   docker logs gamifying-education-traefik 2>&1 | grep -i error
   ```

### Issue: HTTP works but HTTPS doesn't
**Symptoms**: Site accessible on http://yousha.click but not https://

**Solutions:**
1. Check security group allows port 443
2. Check Traefik is listening on 443: `netstat -tlnp | grep 443`
3. Review Traefik logs for certificate errors

### Issue: Certificate expired
**Symptoms**: Browser shows certificate error

**Solution**: Traefik auto-renews 30 days before expiry. If expired:
```bash
# Delete old certificates
docker compose down
docker volume rm traefik-letsencrypt
docker compose up -d
# Traefik will request new certificates
```

### Issue: 404 on API routes
**Symptoms**: Frontend works but /api/v1/* returns 404

**Solutions:**
1. Verify backend is running: `docker ps`
2. Check backend health: `curl http://localhost:8000/api/v1/health`
3. Verify Traefik labels on backend container: `docker inspect gamifying-education-backend`

## Security Considerations

### ✅ Good Practices (Already Implemented)
- IAM role for AWS access (no hardcoded credentials)
- Automatic HTTP to HTTPS redirect
- TLS 1.2+ only
- Rate limiting via Let's Encrypt (50 certs per domain/week)
- Certificates stored in Docker volume (persisted across restarts)

### 🔒 Optional Enhancements
1. **Enable dashboard authentication:**
   ```yaml
   # In docker-compose.prod.yml, uncomment:
   - "traefik.http.routers.dashboard.middlewares=dashboard-auth"
   - "traefik.http.middlewares.dashboard-auth.basicauth.users=admin:$$apr1$$..."
   ```

   Generate password hash:
   ```bash
   sudo apt-get install apache2-utils
   htpasswd -nb admin yourpassword
   ```

2. **Add security headers middleware:**
   ```yaml
   - "traefik.http.middlewares.security-headers.headers.stsSeconds=31536000"
   - "traefik.http.middlewares.security-headers.headers.stsIncludeSubdomains=true"
   - "traefik.http.routers.backend.middlewares=security-headers"
   ```

3. **Enable access logs:**
   ```yaml
   command:
     - --accesslog.filepath=/var/log/traefik/access.log
     - --accesslog.format=json
   ```

## Nginx vs Traefik - Clarification

You might notice nginx is still in `frontend/Dockerfile.prod`:

**Traefik (Edge Router):**
- Runs at the network edge
- Handles HTTPS/TLS termination
- Routes requests to services
- Manages Let's Encrypt certificates

**Nginx (Static File Server):**
- Runs inside frontend container
- Serves React build files efficiently
- Handles SPA routing (fallback to index.html)
- Caches static assets
- Enables gzip compression

This is a **standard pattern**:
```
Internet → Traefik (HTTPS) → Frontend Container (Nginx) → React static files
```

## Useful Commands

```bash
# View all services and their URLs
docker inspect $(docker ps -q) | jq -r '.[] | .Config.Labels'

# Test backend routing
curl -k https://yousha.click/api/v1/health

# Test frontend routing
curl -k https://yousha.click/

# Check certificate expiry
echo | openssl s_client -servername yousha.click \
  -connect yousha.click:443 2>/dev/null | \
  openssl x509 -noout -dates

# Force certificate renewal (for testing)
docker exec gamifying-education-traefik \
  rm /letsencrypt/acme.json && docker restart gamifying-education-traefik
```

## Further Reading

- [Traefik Documentation](https://doc.traefik.io/traefik/)
- [Let's Encrypt DNS Challenge](https://letsencrypt.org/docs/challenge-types/#dns-01-challenge)
- [AWS Route53 for Let's Encrypt](https://go-acme.github.io/lego/dns/route53/)
- [Traefik + Docker](https://doc.traefik.io/traefik/providers/docker/)
