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
}
