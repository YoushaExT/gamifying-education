# RDS Subnet Group (requires at least 2 AZs)
resource "aws_db_subnet_group" "main" {
  name       = "${var.project_name}-db-subnet-group"
  subnet_ids = [aws_subnet.private_a.id, aws_subnet.private_b.id]

  tags = {
    Name = "${var.project_name}-db-subnet-group"
  }
}

# Security group for RDS
resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  # Allow PostgreSQL from EC2 security group only
  ingress {
    description     = "PostgreSQL from EC2"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.main.id]
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# RDS PostgreSQL Instance
resource "aws_db_instance" "main" {
  identifier     = "${var.project_name}-db"
  engine         = "postgres"
  engine_version = "16.11"

  # Instance configuration
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  max_allocated_storage = 100 # Enable storage autoscaling up to 100GB

  # Database configuration
  db_name  = "gamifying_education"
  username = "app_user"
  password = var.db_password
  port     = 5432

  # Network configuration
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false # Not accessible from internet

  # Backup configuration
  backup_retention_period         = 7             # Keep backups for 7 days
  backup_window                   = "03:00-04:00" # UTC time
  maintenance_window              = "Mon:04:00-Mon:05:00"
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  # Performance and monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # Free tier: 7 days

  # High availability (optional - costs more)
  multi_az = var.db_multi_az # Set to false for cost savings

  # Deletion protection
  deletion_protection       = var.db_deletion_protection
  skip_final_snapshot       = var.db_skip_final_snapshot
  final_snapshot_identifier = var.db_skip_final_snapshot ? null : "${var.project_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Automatic minor version upgrades
  auto_minor_version_upgrade = true

  # Parameter group (for custom configurations if needed)
  parameter_group_name = aws_db_parameter_group.main.name

  tags = {
    Name = "${var.project_name}-db"
  }
}

# DB Parameter Group for custom settings
resource "aws_db_parameter_group" "main" {
  name   = "${var.project_name}-postgres16"
  family = "postgres16"

  # Use AWS defaults for db.t4g.micro (1GB RAM)
  # Custom memory settings don't work well with small instances
  parameter {
    name         = "max_connections"
    value        = "50"             # Reduced for small instance
    apply_method = "pending-reboot" # Static parameter, requires reboot
  }

  tags = {
    Name = "${var.project_name}-parameter-group"
  }
}
