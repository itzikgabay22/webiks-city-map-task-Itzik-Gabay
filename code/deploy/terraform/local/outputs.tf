output "namespace" {
  value = helm_release.citymap.namespace
}

output "api_url" {
  value = "http://localhost:8080/api"
}

output "tiles_url" {
  value = "http://localhost:8080/tiles"
}
