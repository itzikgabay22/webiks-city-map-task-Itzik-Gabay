resource "aws_security_group" "data" {
  name        = "citymap-${var.environment}-data"
  description = "Database and cache access from the EKS cluster"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from cluster"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  ingress {
    description     = "Redis from cluster"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_eks_cluster.main.vpc_config[0].cluster_security_group_id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }
}

resource "aws_db_subnet_group" "main" {
  name       = "citymap-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "postgis" {
  name   = "citymap-${var.environment}-pg17"
  family = "postgres17"

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  parameter {
    name         = "log_min_duration_statement"
    value        = "250"
    apply_method = "immediate"
  }
}

resource "aws_db_instance" "main" {
  identifier     = "citymap-${var.environment}"
  engine         = "postgres"
  engine_version = "17"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage_gb
  max_allocated_storage = var.db_allocated_storage_gb * 4
  storage_type          = "gp3"
  storage_encrypted     = true
  iops                  = 16000
  storage_throughput    = 1000

  db_name                     = "citymap"
  username                    = "citymap"
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.data.id]
  parameter_group_name   = aws_db_parameter_group.postgis.name

  # Cost vs reliability: Multi-AZ + 14-day backups for announcement-day safety.
  multi_az                = true
  backup_retention_period = 14
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "citymap-${var.environment}-final"

  performance_insights_enabled = true
  auto_minor_version_upgrade   = true
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "citymap-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "cache" {
  replication_group_id = "citymap-${var.environment}"
  description          = "CityMap response cache"
  engine               = "redis"
  engine_version       = "7.1"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  port                       = 6379
  parameter_group_name       = "default.redis7"
  automatic_failover_enabled = true
  multi_az_enabled           = true

  subnet_group_name          = aws_elasticache_subnet_group.main.name
  security_group_ids         = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}
