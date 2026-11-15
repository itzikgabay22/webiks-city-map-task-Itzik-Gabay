output "cluster_name" {
  value = aws_eks_cluster.main.name
}

output "database_endpoint" {
  value = aws_db_instance.main.address
}

output "cache_endpoint" {
  value = aws_elasticache_replication_group.cache.primary_endpoint_address
}

output "cdn_domain_name" {
  value = aws_cloudfront_distribution.main.domain_name
}
