locals {
  required_tags = {
    Project           = "CityMap"
    Owner             = "velorian-digital-services"
    DataClassification = "public"
    Environment       = var.environment
  }
}

provider "aws" {
  region = var.region
  default_tags {
    tags = local.required_tags
  }
}
