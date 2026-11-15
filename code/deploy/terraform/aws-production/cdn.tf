locals {
  origin_id = "citymap-ingress"
  # Race week: cache static/tile traffic harder. Announcements stay short-TTL
  # so a publish is visible without waiting for a full-day cache to expire.
  api_default_ttl = var.race_week_mode ? 86400 : 60
  api_max_ttl     = var.race_week_mode ? 86400 : 300
  tile_ttl        = var.race_week_mode ? 86400 : 604800
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  comment             = "CityMap public endpoint"
  price_class         = "PriceClass_100"
  is_ipv6_enabled     = true
  wait_for_deployment = false

  origin {
    origin_id   = local.origin_id
    domain_name = var.origin_domain_name

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
      origin_read_timeout    = 60
    }
  }

  # Official datasets must appear immediately after publish. Origin Cache-Control
  # is 15s; CDN must not override that with a day-long TTL (client race-week plan
  # applies to tiles/basemap pressure relief, not announcements).
  ordered_cache_behavior {
    path_pattern           = "/api/announcements/*"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    min_ttl     = 0
    default_ttl = 0
    max_ttl     = 60

    forwarded_values {
      query_string = false
      headers      = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies {
        forward = "none"
      }
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/api/*"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    min_ttl     = 0
    default_ttl = local.api_default_ttl
    max_ttl     = local.api_max_ttl

    forwarded_values {
      query_string = true
      # Forward auth / partner key so private layers and quotas stay correct.
      headers = ["Authorization", "X-Api-Key", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies {
        forward = "none"
      }
    }
  }

  # Vector tiles. Clients request /tiles/{layer}/{z}/{x}/{y}?v={layer updatedAt},
  # so a republished layer is fetched under a new URL.
  ordered_cache_behavior {
    path_pattern           = "/tiles/*"
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    min_ttl     = local.tile_ttl
    default_ttl = local.tile_ttl
    max_ttl     = local.tile_ttl

    forwarded_values {
      query_string            = true
      query_string_cache_keys = ["v"]
      headers                 = ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"]
      cookies {
        forward = "none"
      }
    }
  }

  default_cache_behavior {
    target_origin_id       = local.origin_id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    min_ttl     = var.race_week_mode ? 86400 : 60
    default_ttl = var.race_week_mode ? 86400 : 60
    max_ttl     = var.race_week_mode ? 86400 : 86400

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# Post-publish: operators run
#   aws cloudfront create-invalidation --distribution-id ... --paths "/api/announcements/*"
# immediately after the publisher Job succeeds (evening-news cutover).
