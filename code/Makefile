CLUSTER    ?= citymap
NAMESPACE  ?= citymap
# k6 runs in a container on the cluster's Docker network, next to the load balancer, so
# the host's port forwarding is not part of what a load test measures.
# Local binary instead: make peak K6=k6 (then BASE_URL defaults to http://localhost:8080).
K6_IMAGE   ?= grafana/k6:2.3.0
K6         ?= docker run --rm -i --user "$$(id -u):$$(id -g)" --network k3d-$(CLUSTER) -v "$(CURDIR)":/work -w /work $(K6_IMAGE)
BASE_URL   ?= $(if $(filter k6,$(K6)),http://localhost:8080,http://k3d-$(CLUSTER)-serverlb)
K6_FLAGS   ?=
API_TAG    := 1.4.3
PUB_TAG    := 1.1.0
PG_TAG     := 17-4

.PHONY: help cluster images deploy seed publish traffic peak soak status destroy observe

help: ## List targets
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "} {printf "  %-9s %s\n", $$1, $$2}'

cluster: ## Create the local k3d cluster (ingress on localhost:8080)
	k3d cluster create $(CLUSTER) --servers 1 --agents 0 \
	  --api-port 127.0.0.1:6550 \
	  --port "8080:80@loadbalancer" \
	  --lb-config-override settings.workerConnections=16384 \
	  --k3s-arg "--disable=traefik@server:0" \
	  --wait

images: ## Build the service images and load them into the cluster
	docker build -t citymap-api:$(API_TAG) services/api
	docker build -t citymap-publisher:$(PUB_TAG) services/publisher
	docker build -t citymap-postgis:$(PG_TAG) db
	k3d image import -c $(CLUSTER) citymap-api:$(API_TAG) citymap-publisher:$(PUB_TAG) citymap-postgis:$(PG_TAG)

deploy: images ## Build images and deploy everything with Terraform
	terraform -chdir=deploy/terraform/local init -input=false
	terraform -chdir=deploy/terraform/local apply -input=false -auto-approve

seed: ## Load the deterministic seed data (safe to re-run)
	kubectl -n $(NAMESPACE) exec -i statefulset/citymap-postgis -- psql -U citymap -d citymap -q < db/seed/seed.sql

publish: ## Publish the race-weekend dataset (runs the publisher job once)
	kubectl -n $(NAMESPACE) create job --from=cronjob/citymap-publisher publish-$$(date +%s)

traffic: ## Baseline traffic (DURATION=10m)
	$(K6) run $(K6_FLAGS) -e BASE_URL=$(BASE_URL) -e SCENARIO=baseline -e DURATION=$(or $(DURATION),10m) traffic/main.ts

peak: ## Peak traffic (MULTIPLIER=10 or 50, DURATION=5m)
	$(K6) run $(K6_FLAGS) -e BASE_URL=$(BASE_URL) -e SCENARIO=peak -e MULTIPLIER=$(or $(MULTIPLIER),10) -e DURATION=$(or $(DURATION),5m) traffic/main.ts

soak: ## Baseline traffic for a long run (DURATION=20m)
	$(K6) run $(K6_FLAGS) -e BASE_URL=$(BASE_URL) -e SCENARIO=soak -e DURATION=$(or $(DURATION),20m) traffic/main.ts

status: ## Pods, autoscaler and jobs
	kubectl -n $(NAMESPACE) get pods,hpa,jobs -o wide

observe: ## Install Prometheus + Grafana (self-hosted) with dashboard and alert rules
	kubectl apply -k deploy/observability
	@echo "Grafana: kubectl -n observability port-forward svc/grafana 3001:3000"
	@echo "Prometheus: kubectl -n observability port-forward svc/prometheus 9090:9090"

destroy: ## Delete the local cluster
	k3d cluster delete $(CLUSTER)
