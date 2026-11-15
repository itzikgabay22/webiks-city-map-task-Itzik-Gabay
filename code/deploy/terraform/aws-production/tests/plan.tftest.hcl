# Runs without AWS credentials: every AWS call is answered by the mock provider.
#   terraform init && terraform test

mock_provider "aws" {}

run "plan_core_resources" {
  command = plan

  assert {
    condition     = aws_eks_cluster.main.version == var.kubernetes_version
    error_message = "EKS control plane must run the requested Kubernetes version."
  }

  assert {
    condition     = aws_db_instance.main.engine == "postgres" && aws_db_instance.main.storage_encrypted
    error_message = "The database must be encrypted PostgreSQL."
  }

  assert {
    condition     = length(aws_subnet.private) == length(var.availability_zones)
    error_message = "One private subnet per availability zone."
  }

  assert {
    condition     = aws_eks_cluster.main.vpc_config[0].endpoint_public_access == false
    error_message = "EKS public API endpoint must be disabled in the landing zone."
  }

  assert {
    condition     = aws_db_instance.main.multi_az == true && aws_db_instance.main.backup_retention_period >= 7
    error_message = "Production database must be Multi-AZ with at least 7 days of backups."
  }

  assert {
    condition = alltrue([
      for r in aws_route_table.private.route : r.cidr_block != "0.0.0.0/0" || try(r.transit_gateway_id, null) != null
    ])
    error_message = "Private default route must point at the Transit Gateway (no NAT/IGW)."
  }

  assert {
    condition     = aws_cloudfront_distribution.main.ordered_cache_behavior[0].path_pattern == "/api/announcements/*"
    error_message = "Announcements cache behavior must be first (most specific)."
  }

  assert {
    condition     = aws_cloudfront_distribution.main.ordered_cache_behavior[0].default_ttl <= 60
    error_message = "Announcements must not be CDN-cached for a full day; publish freshness requires short TTL."
  }

  assert {
    condition     = aws_elasticache_replication_group.cache.automatic_failover_enabled == true
    error_message = "Redis must have automatic failover for announcement-day resilience."
  }
}

run "race_week_keeps_announcements_fresh" {
  command = plan

  variables {
    race_week_mode = true
  }

  assert {
    condition     = aws_cloudfront_distribution.main.ordered_cache_behavior[0].default_ttl <= 60
    error_message = "Even in race_week_mode, announcements TTL must stay short."
  }

  assert {
    condition     = aws_cloudfront_distribution.main.ordered_cache_behavior[2].default_ttl == 86400
    error_message = "Race week should cache versioned tiles for a full day to shed origin load."
  }
}
