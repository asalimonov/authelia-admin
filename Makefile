.DEFAULT_GOAL := help
DOCKER_IMAGE_NAME ?= authelia-admin
DOCKER_IMAGE_TAG ?= latest
DOCKER_CONTAINER_NAME ?= authelia-admin
DOCKER_DEV_IMAGE_NAME ?= authelia-admin-dev
DOCKER_DEV_IMAGE_TAG ?= latest
DOCKER_CI_IMAGE_NAME ?= authelia-admin-ci
DOCKER_CI_IMAGE_TAG ?= latest
DOCKER_PORT ?= 9093
DOCKER_NETWORK_NAME ?= authelia
DOCKER_NETWORK_CIDR ?= 192.168.38.0/24
DOCKER_TEST_COMPOSE_FILE ?= docker-compose.test.yml
DOCKER_TEST_PG_COMPOSE_FILE ?= docker-compose.test-pg.yml


.PHONY: network
network: ## Create Docker network if it doesn't exist
	@docker network ls --format "{{.Name}}" | grep -q "^$(DOCKER_NETWORK_NAME)$$" || \
		docker network create --subnet=$(DOCKER_NETWORK_CIDR) $(DOCKER_NETWORK_NAME)
	@echo "Docker network '$(DOCKER_NETWORK_NAME)' is ready"

.PHONY: pre-build
pre-build: ## Build CI image with all dependencies for linting/testing (optional for build)
	@if [ ! -f package-lock.json ]; then \
		echo "package-lock.json not found, generating..."; \
		docker run --rm --network=host -v "$(PWD)":/app -w /app node:25-alpine npm install --package-lock-only; \
	fi
	docker build --network=host -f ci.Dockerfile -t $(DOCKER_CI_IMAGE_NAME):$(DOCKER_CI_IMAGE_TAG) .

.PHONY: build
build: ## Build production Docker image (self-contained, no pre-build required)
	@if [ ! -f package-lock.json ]; then \
		echo "package-lock.json not found, generating..."; \
		docker run --rm --network=host -v "$(PWD)":/app -w /app node:25-alpine npm install --package-lock-only; \
	fi
	docker build --network=host -t $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG) .

.PHONY: build-dev
build-dev: ## Build development Docker image
	docker build --network=host -f dev.Dockerfile -t $(DOCKER_DEV_IMAGE_NAME):$(DOCKER_DEV_IMAGE_TAG) .

.PHONY: run
run: network ## Run production Docker container
	docker run --rm --network $(DOCKER_NETWORK_NAME) \
		-v ./test-configs/config.yml:/opt/authelia-admin/config.yml:ro \
		-v ./test-configs/authelia:/config \
		-v ./.test-data/authelia:/data \
		-e NODE_TLS_REJECT_UNAUTHORIZED=0 \
		--name $(DOCKER_CONTAINER_NAME) \
		-p $(DOCKER_PORT):9093 \
		$(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)

.PHONY: run-dev
run-dev: network build-dev ## Run development Docker container with hot-reload
	mkdir -p ./.test-data/lldap
	cp ./test-configs/lldap/lldap_config.toml ./.test-data/lldap
	docker run --rm -i \
		-v $(PWD):/app \
		-v /app/node_modules \
		-v $(PWD)/test-configs/config.yml:/opt/authelia-admin/config.yml:ro \
		-e AAD_LOGLEVEL=DEBUG \
		--network $(DOCKER_NETWORK_NAME) \
		-v ./test-configs/authelia:/config \
		-v ./.test-data/authelia:/data \
		--name $(DOCKER_CONTAINER_NAME) \
		-p $(DOCKER_PORT):9093 \
		$(DOCKER_DEV_IMAGE_NAME):$(DOCKER_DEV_IMAGE_TAG)

.PHONY: stop
stop: ## Stop and remove Docker container
	-docker stop $(DOCKER_CONTAINER_NAME)
	-docker rm $(DOCKER_CONTAINER_NAME)

.PHONY: test
test: pre-build test-lint test-small ## Run tests (w/o functional)

.PHONY: test-small
test-small: ## Run unit tests (requires pre-build)
	docker run --rm --network $(DOCKER_NETWORK_NAME) \
		-e NODE_TLS_REJECT_UNAUTHORIZED=0 \
		$(DOCKER_CI_IMAGE_NAME):$(DOCKER_CI_IMAGE_TAG) npm test

.PHONY: test-medium
test-medium: ## Run functional tests (requires pre-build and run-docker-compose)
	docker run --rm --network $(DOCKER_NETWORK_NAME) \
		-e NODE_TLS_REJECT_UNAUTHORIZED=0 \
		$(DOCKER_CI_IMAGE_NAME):$(DOCKER_CI_IMAGE_TAG) npm run test:functional

.PHONY: test-lint
test-lint: ## Run ESLint on TypeScript code (requires pre-build)
	docker run --rm --network $(DOCKER_NETWORK_NAME) \
		$(DOCKER_CI_IMAGE_NAME):$(DOCKER_CI_IMAGE_TAG) npm run lint

.PHONY: run-docker-compose
run-docker-compose: network ## Run docker compose with network dependencies within external network
	mkdir -p ./.test-data/lldap
	cp ./test-configs/lldap/lldap_config.toml ./.test-data/lldap
	(sleep 5 && docker compose exec -T lldap /bootstrap/bootstrap.sh) &
	docker compose up

.PHONY: test-e2e-up
test-e2e-up: network ## Start E2E test stack (docker-compose.test.yml)
	mkdir -p ./.test-data/lldap
	cp ./test-configs/lldap/lldap_config.toml ./.test-data/lldap
	(sleep 5 && docker compose -f $(DOCKER_TEST_COMPOSE_FILE) exec -T lldap /bootstrap/bootstrap.sh) &
	docker compose -f $(DOCKER_TEST_COMPOSE_FILE) up -d
	./scripts/wait-for-services.sh

.PHONY: test-e2e-down
test-e2e-down: ## Stop and remove E2E test stack
	docker compose -f $(DOCKER_TEST_COMPOSE_FILE) down

.PHONY: test-e2e-pg-up
test-e2e-pg-up: network ## Start PostgreSQL E2E test stack
	mkdir -p ./.test-data/lldap
	cp ./test-configs/lldap/lldap_config.toml ./.test-data/lldap
	(sleep 5 && docker compose -f $(DOCKER_TEST_PG_COMPOSE_FILE) exec -T lldap /bootstrap/bootstrap.sh) &
	docker compose -f $(DOCKER_TEST_PG_COMPOSE_FILE) up -d
	./scripts/wait-for-services.sh

.PHONY: test-e2e-pg-down
test-e2e-pg-down: ## Stop and remove PostgreSQL E2E test stack
	docker compose -f $(DOCKER_TEST_PG_COMPOSE_FILE) down

.PHONY: test-e2e-run
test-e2e-run: ## Run Playwright E2E tests (assumes stack is running)
	npx playwright test --config=e2e/playwright.config.ts

.PHONY: test-e2e
test-e2e: build ## Full E2E: build, start stack, run tests, tear down (SQLite + PostgreSQL)
	@echo "=== Phase 1: SQLite E2E tests ==="
	SQLITE_EXIT=1; PG_EXIT=1; \
	if $(MAKE) test-e2e-up; then \
		npx playwright test --config=e2e/playwright.config.ts; \
		SQLITE_EXIT=$$?; \
	else \
		echo "SQLite stack startup failed"; \
	fi; \
	$(MAKE) test-e2e-down; \
	rm -rf ./.test-data/lldap ./.test-data/authelia; \
	echo "=== Phase 2: PostgreSQL E2E tests ==="; \
	if $(MAKE) test-e2e-pg-up; then \
		npx playwright test --config=e2e/playwright.config.ts; \
		PG_EXIT=$$?; \
	else \
		echo "PostgreSQL stack startup failed"; \
	fi; \
	$(MAKE) test-e2e-pg-down; \
	rm -rf ./.test-data/lldap ./.test-data/authelia; \
	if [ $$SQLITE_EXIT -ne 0 ] || [ $$PG_EXIT -ne 0 ]; then \
		echo "E2E tests failed: SQLite=$$SQLITE_EXIT, PostgreSQL=$$PG_EXIT"; \
		exit 1; \
	fi

.PHONY: all
all: build ## Build docker image

.PHONY: network-remove
network-remove: ## Remove Docker network
	@docker network rm $(DOCKER_NETWORK_NAME) 2>/dev/null

.PHONY: clean
clean: ## Clean up Docker images and local files
	-docker rmi $(DOCKER_IMAGE_NAME):$(DOCKER_IMAGE_TAG)
	-docker rmi $(DOCKER_DEV_IMAGE_NAME):$(DOCKER_DEV_IMAGE_TAG)
	-docker rmi $(DOCKER_CI_IMAGE_NAME):$(DOCKER_CI_IMAGE_TAG)
	rm -rf ./.test-data
	rm -rf ./node_modules
	rm -rf ./build
	rm -rf ./.svelte-kit

.PHONY: help
help:	## Print help
		@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

define print-target
    @printf "Executing target: \033[36m$@\033[0m\n"
endef
