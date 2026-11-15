provider "helm" {
  kubernetes = {
    config_path    = pathexpand(var.kubeconfig_path)
    config_context = var.kube_context
  }

  # Keep chart repositories local to this module, independent of the user's helm setup.
  repository_config_path = "${path.module}/.helm/repositories.yaml"
  repository_cache       = "${path.module}/.helm/cache"
}

resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "jwt" {
  length  = 48
  special = false
}

resource "helm_release" "ingress_nginx" {
  name             = "ingress-nginx"
  repository       = "https://kubernetes.github.io/ingress-nginx"
  chart            = "ingress-nginx"
  version          = var.ingress_nginx_chart_version
  namespace        = "ingress-nginx"
  create_namespace = true
  wait             = true
  timeout          = 600

  values = [yamlencode({
    controller = {
      replicaCount = 1
      # Production sits behind a cloud load balancer that sets X-Forwarded-For.
      config = {
        "use-forwarded-headers"      = "true"
        "compute-full-forwarded-for" = "true"
      }
      resources = {
        requests = { cpu = "100m", memory = "128Mi" }
        limits   = { cpu = "1", memory = "512Mi" }
      }
      admissionWebhooks = { enabled = false }
    }
  })]
}

locals {
  chart_dir = "${path.module}/../../helm/citymap"
  # Local chart edits do not change the chart version; hash the files so they are rolled out.
  chart_checksum = sha1(join("", [for f in sort(fileset(local.chart_dir, "**")) : filesha1("${local.chart_dir}/${f}")]))
}

resource "helm_release" "citymap" {
  name             = "citymap"
  chart            = local.chart_dir
  namespace        = var.namespace
  create_namespace = true
  wait             = true
  timeout          = 600

  values = [yamlencode({
    chartChecksum = local.chart_checksum
    martin        = { config = file("${path.module}/../../../tiles/config.yaml") }
  })]

  set_sensitive = [
    { name = "secrets.dbPassword", value = random_password.db.result },
    { name = "secrets.jwtSecret", value = random_password.jwt.result },
  ]

  depends_on = [helm_release.ingress_nginx]
}
