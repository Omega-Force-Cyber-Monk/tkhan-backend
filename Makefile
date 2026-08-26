ps:
	@docker ps

cps:
	@docker compose ps

build:
	@docker compose build

up:
	@docker compose up -d

down:
	@docker compose down

push:
	@docker push softvence/tkhan-backend:latest

push-lx:
	@docker buildx build \
		--platform linux/amd64,linux/arm64 \
		-t softvence/tkhan-backend:latest \
		--push .

logs:
	@docker compose logs -f

logs-tail:
	@docker compose logs --tail=100

all: down build up