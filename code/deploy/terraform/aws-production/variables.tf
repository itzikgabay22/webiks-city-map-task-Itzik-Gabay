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

variable "kubernetes_version" {
  description = "EKS control plane version."
  type        = string
  default     = "1.34"
}

variable "node_instance_types" {
  description = "Instance types for the EKS managed node group."
  type        = list(string)
  default     = ["m7g.large"]
}

variable "node_count" {
  description = "Desired, minimum and maximum size of the node group."
  type        = object({ desired = number, min = number, max = number })
  default     = { desired = 3, min = 3, max = 6 }
}

variable "db_instance_class" {
  description = "RDS instance class for the PostGIS database."
  type        = string
  default     = "db.t4g.small"
}

variable "db_allocated_storage_gb" {
  description = "Initial RDS storage in GiB."
  type        = number
  default     = 100
}

variable "origin_domain_name" {
  description = "DNS name of the load balancer created by the cluster ingress controller."
  type        = string
  default     = "citymap-ingress.internal.example"
}
