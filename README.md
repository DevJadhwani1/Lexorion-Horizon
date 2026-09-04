# Lexorion Horizon

Lexorion Horizon is an academic enterprise HRMS project built with a microservices architecture. The current implementation includes platform and tenant administration, Workforce functionality, foundational Payroll workflows, a Finance service shell, service discovery, an API Gateway, and a React frontend.

## Project Members

| Name | Enrollment No. | Division |
|------|----------------|----------|
| Dev Jadhwani | 70612400063 | A070 |
| Rushil Patel | 70612500047 | A044 |

## Project Overview

Lexorion Horizon is designed to simplify Human Resource Management by separating business capabilities into independent microservices. Each service owns its own data and communicates with other services through REST APIs, providing scalability, maintainability, and flexibility.

## Current Services

- Platform Service
- Workforce Service
- Payroll Service
- Finance Service
- API Gateway
- Eureka Server
- React/Vite Frontend

## Technology Stack

- Java 21
- Spring Boot 4.1
- Spring Cloud
- React.js
- TypeScript
- PostgreSQL
- Spring Data JPA
- Spring Security
- JWT
- Maven
- Docker Compose
- Jenkins Pipeline

## Repository Structure

```text
Horizon/
├── backend/
│   ├── api-gateway/
│   ├── eureka-server/
│   ├── finance-service/
│   ├── payroll-service/
│   ├── platform-service/
│   └── workforce-service/
├── frontend/
├── docs/
├── design/
├── docker-compose.yml
└── Jenkinsfile
```

## Documentation

- Phase 1 synopsis and ERD material is under `docs/Phase-1/`.
- Docker instructions are in `docs/docker.md`.
- Jenkins CI information is in `docs/ci-cd.md`.

PostgreSQL is an external dependency and is not included in Docker Compose. See the Docker documentation for required environment variables and known local database prerequisites.

## License

This repository is maintained for academic purposes as part of the Lexorion Horizon project.
