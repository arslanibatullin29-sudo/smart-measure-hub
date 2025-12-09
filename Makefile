.PHONY: help build up down logs restart clean dev

help: ## Показать справку
	@echo "Доступные команды:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

build: ## Собрать production образ
	docker compose build

up: ## Запустить production контейнер
	docker compose up -d

down: ## Остановить контейнеры
	docker compose down

logs: ## Показать логи
	docker compose logs -f frontend

restart: ## Перезапустить контейнеры
	docker compose restart

clean: ## Очистить контейнеры и volumes
	docker compose down -v

dev: ## Запустить dev режим
	docker compose -f docker-compose.dev.yml up --build

dev-down: ## Остановить dev контейнеры
	docker compose -f docker-compose.dev.yml down

test: ## Запустить тесты
	docker compose -f docker-compose.dev.yml --profile test run --rm test

test-watch: ## Запустить тесты в watch режиме
	docker compose -f docker-compose.dev.yml --profile test up test-watch

test-coverage: ## Запустить тесты с покрытием
	docker compose -f docker-compose.dev.yml --profile test run --rm test-coverage

rebuild: ## Пересобрать без кэша
	docker compose build --no-cache

shell: ## Войти в контейнер
	docker compose exec frontend sh

