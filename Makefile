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

logs:
	@docker compose logs -f

logs --tail:
	@docker compose logs --tail


all: down build up logs
