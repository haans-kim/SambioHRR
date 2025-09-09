# SambioHRR Development Makefile

# Default target
.DEFAULT_GOAL := dev

# Variables
PORT ?= 3003
NODE_ENV ?= development

# Development server
dev:
	npm run dev

# Build the project
build:
	npm run build

# Start production server
start:
	npm run start

# Run linting
lint:
	npm run lint

# Kill existing Next.js processes and restart development server
restart:
	@echo "Killing existing Next.js processes..."
	@pkill -f "next dev" || echo "No existing Next.js processes found"
	@pkill -f "node.*next-server" || echo "No existing Next.js server processes found"
	@sleep 2
	@echo "Starting development server..."
	npm run dev

# Clean build artifacts
clean:
	rm -rf .next
	rm -rf node_modules/.cache

# Install dependencies
install:
	npm install

# Update organization stats
update-org-stats:
	npm run update-org-stats

# Show help
help:
	@echo "Available commands:"
	@echo "  make dev              - Start development server"
	@echo "  make build            - Build for production"
	@echo "  make start            - Start production server"
	@echo "  make restart          - Kill existing processes and restart dev server"
	@echo "  make lint             - Run linting"
	@echo "  make clean            - Clean build artifacts"
	@echo "  make install          - Install dependencies"
	@echo "  make update-org-stats - Update organization statistics"
	@echo "  make help             - Show this help message"

.PHONY: dev build start restart lint clean install update-org-stats help