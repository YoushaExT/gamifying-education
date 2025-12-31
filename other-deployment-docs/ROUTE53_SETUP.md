# Route53 Setup Guide

**IMPORTANT**: The Route53 hosted zone is **NOT** managed by terraform to avoid accidental deletion and unnecessary costs during testing.

---

## Understanding Route53 Costs

| Item | Cost | Managed by Terraform? |
|------|------|-----------------------|
| **Hosted Zone** | **$0.50/month** | ❌ No - Manual setup |
| DNS A Records | FREE (up to 1,000) | ✅ Yes |
| DNS Queries | $0.40/million (first 1B free) | N/A |

**Total ongoing cost**: **$0.50/month** (paid once, regardless of terraform apply/destroy cycles)

---

## Why Terraform Doesn't Manage the Hosted Zone

### ✅ Benefits:

1. **No accidental deletion** - `terraform destroy` won't delete your domain's hosted zone
2. **Cost-effective for testing** - Run terraform apply/destroy as many times as you want, still only $0.50/month
3. **Faster operations** - Hosted zone creation takes 2-5 minutes; terraform is faster without it
4. **Safer** - Domain stays working even if terraform state gets messed up

### ❌ If terraform managed it:

```hcl
# DON'T DO THIS (we're not doing this)
resource "aws_route53_zone" "main" {
  name = var.domain_name
}
```

- Every `terraform destroy` would delete the zone ($0.50 charge, then another $0.50 to recreate)
- Risk of accidentally deleting domain
- Slower apply/destroy cycles
- Nameserver changes every time (need to update registrar each time)

---

## Setup Instructions

### Step 1: Create Hosted Zone (One-Time Setup)

#### Option A: AWS Console (Easiest)

1. Go to AWS Console → Route 53
2. Click "Create hosted zone"
3. Enter domain name: `yousha.click`
4. Type: Public hosted zone
5. Click "Create hosted zone"

**Cost**: $0.50/month starts here

#### Option B: AWS CLI

```bash
aws route53 create-hosted-zone \
  --name yousha.click \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="Gamifying Education Production"
```

### Step 2: Get Hosted Zone ID

#### Option A: AWS Console

1. Route 53 → Hosted zones
2. Click on `yousha.click`
3. Copy the **Hosted zone ID** (looks like `Z1234567890ABC`)

#### Option B: AWS CLI

```bash
aws route53 list-hosted-zones \
  --query "HostedZones[?Name=='yousha.click.'].Id" \
  --output text
```

Example output: `/hostedzone/Z1234567890ABC`

**Use only the ID part**: `Z1234567890ABC`

### Step 3: Update Domain Nameservers (One-Time Setup)

Get the nameservers:

```bash
aws route53 get-hosted-zone \
  --id Z1234567890ABC \
  --query "DelegationSet.NameServers"
```

Example output:
```json
[
    "ns-1234.awsdns-12.org",
    "ns-5678.awsdns-34.co.uk",
    "ns-9012.awsdns-56.com",
    "ns-3456.awsdns-78.net"
]
```

**Update your domain registrar** (where you bought yousha.click):
1. Login to registrar (Namecheap, GoDaddy, etc.)
2. Find DNS/Nameserver settings
3. Replace existing nameservers with AWS nameservers above
4. Save changes

**Wait 5-60 minutes for DNS propagation**

Verify:
```bash
dig yousha.click NS +short
# Should show AWS nameservers
```

### Step 4: Add to terraform.tfvars

```hcl
# terraform/terraform.tfvars
domain_name     = "yousha.click"
route53_zone_id = "Z1234567890ABC"  # Your actual hosted zone ID
```

### Step 5: Run Terraform

```bash
cd terraform
terraform init
terraform plan   # Should show it will create A records
terraform apply  # Creates A records pointing to your EC2 IP
```

**Cost**: Still just $0.50/month (A records are free)

---

## What Terraform Actually Manages

### Terraform Creates (when you run `terraform apply`):

1. **A Record** - Points `yousha.click` to EC2 Elastic IP
2. **WWW A Record** - Points `www.yousha.click` to EC2 Elastic IP

These are **FREE** (included in hosted zone cost).

### Terraform Does NOT Touch:

1. **Hosted Zone** - Pre-existing, stays forever
2. **Nameservers** - Set once, never changes
3. **Other DNS records** - You can manually add MX, TXT, etc. records

---

## Testing terraform destroy

Safe to test:

```bash
cd terraform
terraform destroy  # Deletes A records only
```

**What happens**:
- ❌ A records deleted (yousha.click temporarily won't point to your EC2)
- ✅ Hosted zone still exists
- ✅ Nameservers unchanged
- ✅ Still costs $0.50/month

**To restore**:
```bash
terraform apply  # Recreates A records, works immediately
```

**Cost**: Still just $0.50/month (no additional charges)

---

## Verification

After terraform apply, verify DNS is working:

```bash
# Check A record was created
dig yousha.click A +short
# Should show your EC2 Elastic IP

# Check WWW record
dig www.yousha.click A +short
# Should show same IP

# Check nameservers (should be AWS)
dig yousha.click NS +short
```

---

## Cost Breakdown Example

Assuming you test terraform 10 times in a month:

| Scenario | Hosted Zone | A Records | Total |
|----------|-------------|-----------|-------|
| **Current setup (zone manual)** | $0.50 | $0.00 | **$0.50** |
| If zone in terraform | $0.50 × 10 | $0.00 | $5.00 |

**Savings**: $4.50/month by keeping zone manual

---

## Troubleshooting

### Issue: "HostedZoneNotFound"

```bash
terraform plan
# Error: couldn't find Route53 hosted zone
```

**Fix**: Create the hosted zone first (Step 1 above), then add zone ID to terraform.tfvars

### Issue: Domain not resolving

```bash
curl https://yousha.click
# Error: Could not resolve host
```

**Debug**:
```bash
# 1. Check nameservers updated at registrar
dig yousha.click NS +short
# Should show AWS nameservers

# 2. Check A record exists
dig yousha.click A +short
# Should show your EC2 IP

# 3. Check terraform state
terraform state show aws_route53_record.main
```

**Fix**:
- If nameservers wrong: Update at registrar (Step 3)
- If A record missing: Run `terraform apply`
- Wait 5-10 minutes for DNS propagation

### Issue: Terraform wants to delete zone

```bash
terraform plan
# Plan: ... destroy aws_route53_zone.main
```

**This should NEVER happen** because zone is a `data` source, not a `resource`.

If you see this, someone edited the terraform code. Revert changes:
```bash
git diff terraform/main.tf
git checkout terraform/main.tf
```

---

## If You Want Terraform to Manage the Zone (Not Recommended)

If you really want terraform to create/destroy the zone:

**Edit `terraform/main.tf`:**

```hcl
# Replace the data source with a resource
resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = var.domain_name
  }
}
```

**Edit `terraform/vpc.tf`:**

```hcl
# Update references from var.route53_zone_id to:
zone_id = aws_route53_zone.main.zone_id
```

**Remove from `terraform/variables.tf`:**
```hcl
# Delete the route53_zone_id variable
```

**Warning**: Now every `terraform destroy` will delete the zone and you'll pay $0.50 each time you recreate it.

---

## Summary

✅ **Current Setup**: Route53 hosted zone is manual, terraform only manages A records
💰 **Cost**: $0.50/month (one-time, ongoing)
🧪 **Testing**: Run terraform apply/destroy as many times as you want
🔒 **Safety**: Can't accidentally delete domain
⚡ **Speed**: Faster terraform operations

**One-time setup checklist**:
- [ ] Create hosted zone in AWS ($0.50/month starts)
- [ ] Get hosted zone ID
- [ ] Update nameservers at domain registrar
- [ ] Wait for DNS propagation (5-60 min)
- [ ] Add zone ID to terraform.tfvars
- [ ] Run terraform apply (creates free A records)
- [ ] Verify with `dig yousha.click A +short`
- [ ] Done! You can now safely terraform destroy/apply for testing
