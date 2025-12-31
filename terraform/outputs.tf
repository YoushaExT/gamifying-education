output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.main.id
}

output "instance_public_ip" {
  description = "EC2 instance public IP (Elastic IP)"
  value       = aws_eip.main.public_ip
}

output "domain_name" {
  description = "Domain name"
  value       = var.domain_name
}

output "application_url" {
  description = "Application URL"
  value       = "https://${var.domain_name}"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.main.public_ip}"
}

output "s3_backup_bucket" {
  description = "S3 bucket for backups"
  value       = aws_s3_bucket.backups.id
}

output "route53_nameservers" {
  description = "Route 53 nameservers (verify these are set in your domain registrar)"
  value       = data.aws_route53_zone.main.name_servers
}

output "rds_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_database_name" {
  description = "RDS database name"
  value       = aws_db_instance.main.db_name
}

output "rds_username" {
  description = "RDS master username"
  value       = aws_db_instance.main.username
  sensitive   = true
}

output "ecr_repository_backend" {
  description = "ECR repository URL for backend"
  value       = aws_ecr_repository.backend.repository_url
}

output "ecr_repository_frontend" {
  description = "ECR repository URL for frontend"
  value       = aws_ecr_repository.frontend.repository_url
}

output "github_actions_role_arn" {
  description = "IAM Role ARN for GitHub Actions (add to GitHub secrets as AWS_ROLE_ARN)"
  value       = aws_iam_role.github_actions.arn
}

output "next_steps" {
  description = "Next steps after deployment"
  value       = <<-EOT
    Deployment initiated! Follow these steps:

    1. Wait 10-15 minutes for:
       - RDS instance to initialize (5-10 minutes)
       - EC2 instance initialization (5-10 minutes)

    2. SSH into the instance:
       ${join("\n       ", [
         "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.main.public_ip}"
       ])}

    3. Check initialization logs:
       sudo tail -f /var/log/cloud-init-output.log

    4. Once complete, access your application:
       https://${var.domain_name}

    5. Login with superuser credentials:
       Email: ${var.first_superuser_email}
       Password: (the one you set in terraform.tfvars)

    6. Monitor the instance:
       - Check systemd services: sudo systemctl status gamifying-education-backend nginx
       - View application logs: sudo journalctl -u gamifying-education-backend -f
       - View Nginx logs: sudo tail -f /var/log/nginx/error.log

    7. RDS Database:
       - Endpoint: ${aws_db_instance.main.endpoint}
       - Database: ${aws_db_instance.main.db_name}
       - Automated backups: 7 days retention

    8. Backups are stored in S3 bucket: ${aws_s3_bucket.backups.id}
  EOT
}
