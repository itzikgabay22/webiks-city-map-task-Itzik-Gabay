variable "region" {
  description = "AWS region."
  type        = string
  default     = "il-central-1"
}

variable "environment" {
  description = "Environment name, used in resource names."
  type        = string
  default     = "production"
}

variable "availability_zones" {
  description = "Availability zones to spread subnets across."
  type        = list(string)
  default     = ["il-central-1a", "il-central-1b", "il-central-1c"]
}

variable "vpc_cidr" {
  description = "CIDR block of the CityMap VPC."
  type        = string
  default     = "10.40.0.0/16"
}

variable "transit_gateway_id" {
  description = "Shared Transit Gateway ID from the network account."
  type        = string
  default     = "tgw-0123456789abcdef0"
}

variable "transit_gateway_attachment_id" {
  description = "Existing TGW VPC attachment ID when the network account owns the attachment."
  type        = string
  default     = "tgw-attach-0123456789abcdef0"
}

variable "manage_transit_gateway_attachment" {
  description = "When true, create the TGW attachment in this module; otherwise use var.transit_gateway_attachment_id."
  type        = bool
  default     = false
}

variable "kubernetes_version" {
  description = "EKS control plane version."
  type        = string
  default     = "1.34"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group."
  type        = list(string)
  # Reliability over cost: room for API HPA, Martin replicas, and publishers.
  default = ["m7g.2xlarge"]
}

variable "node_count" {
  description = "Desired, minimum and maximum size of the node group."
  type        = object({ desired = number, min = number, max = number })
  # Announcement day + race weekend: keep spare capacity before HPA catches up.
  default = { desired = 6, min = 4, max = 18 }
}

variable "db_instance_class" {
  description = "RDS instance class for the PostGIS database."
  type        = string
  # Local ×10 OOM'd a 2Gi PostGIS stand-in; production gets a large Multi-AZ writer.
  default = "db.r6g.2xlarge"
}

variable "db_allocated_storage_gb" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 1000
}

variable "redis_node_type" {
  description = "ElastiCache node type."
  type        = string
  default     = "cache.r6g.xlarge"
}

variable "origin_domain_name" {
  description = "DNS name of the load balancer created by the cluster ingress controller."
  type        = string
  default     = "citymap-ingress.internal.example"
}

variable "race_week_mode" {
  description = "When true, CDN caches non-announcement content aggressively for race week."
  type        = bool
  default     = false
}
