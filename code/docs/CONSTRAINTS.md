# Constraints

These come from Velorian Digital Services and from the government landing zone that CityMap production runs in. They are not negotiable within this project.

## Landing zone (AWS)

- Production runs in a **government landing zone**. Workload accounts have **no Internet Gateway and no NAT Gateway**. All egress goes through the shared network account.
- The network account shares a Transit Gateway with every workload account. Its ID is provided to workload modules as `var.transit_gateway_id`, and the attachment for the workload VPC as `var.transit_gateway_attachment_id`. Default routes (`0.0.0.0/0`) from workload subnets must point at the Transit Gateway.
- Inbound public traffic arrives only through CloudFront and the load balancer created by the cluster's ingress controller.
- An organization **Service Control Policy denies the creation of any resource that does not carry these tags**:
  - `Project`
  - `Owner`
  - `DataClassification`
- Region: `il-central-1`.

## Tooling

- **No external SaaS** for observability, APM, logging, alerting or error tracking. Open-source, self-hosted tools only.

## Data

- **Public data must remain openly accessible and embeddable** by any website. Scraping and abuse should be limited without blocking legitimate partners.
- **Personal data** (addresses, user identifiers) must not be stored outside approved systems. The approved systems are the CityMap database and its backups.
