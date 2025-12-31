output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.test.id
}

output "instance_public_ip" {
  description = "Public IP address"
  value       = aws_instance.test.public_ip
}

output "instance_public_dns" {
  description = "Public DNS name"
  value       = aws_instance.test.public_dns
}

output "ssh_command" {
  description = "SSH command to connect"
  value       = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_instance.test.public_ip}"
}

output "web_url" {
  description = "Web URL to test"
  value       = "http://${aws_instance.test.public_ip}"
}

output "next_steps" {
  description = "What to do next"
  value = <<-EOT

  ╔══════════════════════════════════════════════════════════════════╗
  ║                    TEST DEPLOYMENT SUCCESSFUL! ✅                ║
  ╚══════════════════════════════════════════════════════════════════╝

  1. Wait 2-3 minutes for instance to fully boot and install nginx

  2. Test SSH connection:
     ${join("\n     ", [
  "ssh -i ~/.ssh/${var.ssh_key_name} ubuntu@${aws_instance.test.public_ip}"
  ])}

  3. Test web server (wait 2-3 minutes after instance launch):
     ${join("\n     ", [
  "Open in browser: http://${aws_instance.test.public_ip}",
  "Or command line: curl http://${aws_instance.test.public_ip}"
])}

  4. When done testing, destroy resources:
     terraform destroy

  5. If everything works, proceed to main deployment:
     cd ../terraform/
     # Follow QUICK_START.md

  ╔══════════════════════════════════════════════════════════════════╗
  ║ Instance ID: ${aws_instance.test.id}
  ║ Public IP:   ${aws_instance.test.public_ip}
  ║ Region:      ${var.aws_region}
  ╚══════════════════════════════════════════════════════════════════╝
  EOT
}
