# Landing-zone networking: no IGW, no NAT. Egress and inbound private routing
# go through the shared Transit Gateway (see docs/CONSTRAINTS.md).

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = { Name = "citymap-${var.environment}" }
}

resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index)

  tags = {
    Name                              = "citymap-${var.environment}-private-${count.index}"
    "kubernetes.io/role/internal-elb" = "1"
  }
}

# Public-facing ALB subnets still exist for the ingress controller, but they
# have no Internet Gateway route. CloudFront reaches the ALB via the shared
# network path; default routes point at Transit Gateway.
resource "aws_subnet" "ingress" {
  count             = min(2, length(var.availability_zones))
  vpc_id            = aws_vpc.main.id
  availability_zone = var.availability_zones[count.index]
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, 200 + count.index)

  tags = {
    Name                     = "citymap-${var.environment}-ingress-${count.index}"
    "kubernetes.io/role/elb" = "1"
  }
}

resource "aws_ec2_transit_gateway_vpc_attachment" "main" {
  count              = var.manage_transit_gateway_attachment ? 1 : 0
  subnet_ids         = aws_subnet.private[*].id
  transit_gateway_id = var.transit_gateway_id
  vpc_id             = aws_vpc.main.id

  tags = { Name = "citymap-${var.environment}" }
}

locals {
  tgw_attachment_id = var.manage_transit_gateway_attachment ? aws_ec2_transit_gateway_vpc_attachment.main[0].id : var.transit_gateway_attachment_id
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block         = "0.0.0.0/0"
    transit_gateway_id = var.transit_gateway_id
  }

  tags = { Name = "citymap-${var.environment}-private" }
}

resource "aws_route_table" "ingress" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block         = "0.0.0.0/0"
    transit_gateway_id = var.transit_gateway_id
  }

  tags = { Name = "citymap-${var.environment}-ingress" }
}

resource "aws_route_table_association" "private" {
  count          = length(aws_subnet.private)
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "ingress" {
  count          = length(aws_subnet.ingress)
  subnet_id      = aws_subnet.ingress[count.index].id
  route_table_id = aws_route_table.ingress.id
}
