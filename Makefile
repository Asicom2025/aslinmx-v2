.PHONY: help up down restart logs build clean migrate test

help: ## Muestra esta ayuda
	@echo "Comandos disponibles para Aslin 2.0:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

up: ## Levantar todos los servicios
	docker-compose up -d

up-build: ## Levantar y construir servicios
	docker-compose up --build -d

down: ## Detener todos los servicios
	docker-compose down

down-v: ## Detener servicios y eliminar volúmenes (¡CUIDADO!)
	docker-compose down -v

restart: ## Reiniciar todos los servicios
	docker-compose restart

logs: ## Ver logs de todos los servicios
	docker-compose logs -f

logs-backend: ## Ver logs del backend
	docker-compose logs -f backend

logs-frontend: ## Ver logs del frontend
	docker-compose logs -f frontend

logs-db: ## Ver logs de la base de datos
	docker-compose logs -f db

build: ## Construir imágenes
	docker-compose build

clean: ## Limpiar contenedores e imágenes
	docker-compose down
	docker system prune -f

migrate: ## Aplicar migraciones de base de datos
	docker-compose exec backend alembic upgrade head

migrate-create: ## Crear nueva migración (uso: make migrate-create MSG="mensaje")
	docker-compose exec backend alembic revision --autogenerate -m "$(MSG)"

migrate-down: ## Revertir última migración
	docker-compose exec backend alembic downgrade -1

shell-backend: ## Acceder a shell del backend
	docker-compose exec backend bash

shell-frontend: ## Acceder a shell del frontend
	docker-compose exec frontend sh

install-frontend: ## Instalar dependencias del frontend
	docker-compose exec frontend npm install

install-backend: ## Instalar dependencias del backend
	docker-compose exec backend pip install -r requirements.txt

shell-db: ## Acceder a PostgreSQL
	docker-compose exec db psql -U aslin_user -d aslin_db

test: ## Ejecutar tests del backend
	docker-compose exec backend pytest

test-cov: ## Ejecutar tests con cobertura
	docker-compose exec backend pytest --cov=app --cov-report=html

status: ## Ver estado de los servicios
	docker-compose ps

install: ## Inicializar proyecto (primera vez)
	@echo "🚀 Iniciando Aslin 2.0..."
	docker-compose up --build -d
	@echo "⏳ Esperando que los servicios estén listos..."
	sleep 10
	@echo "✅ Proyecto iniciado correctamente"
	@echo ""
	@echo "📍 URLs disponibles:"
	@echo "   - Frontend: http://localhost:3000"
	@echo "   - Backend: http://localhost:8000"
	@echo "   - API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "📚 Para más información, revisa: docs/SETUP.md"

