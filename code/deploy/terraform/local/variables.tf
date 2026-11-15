variable "kubeconfig_path" {
  description = "Path to the kubeconfig used to reach the local cluster."
  type        = string
  default     = "~/.kube/config"
}

variable "kube_context" {
  description = "kubeconfig context of the local cluster (created by `make cluster`)."
  type        = string
  default     = "k3d-citymap"
}

variable "namespace" {
  description = "Namespace for the CityMap release."
  type        = string
  default     = "citymap"
}

variable "ingress_nginx_chart_version" {
  description = "ingress-nginx Helm chart version."
  type        = string
  default     = "4.15.1"
}
