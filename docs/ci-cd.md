# Continuous integration

GitHub Actions (`.github/workflows/ci.yml`) is the pipeline that runs on every pull request and on `main`. It tests the six backend modules and the frontend. A push to `main` then builds the seven application images and publishes them to GHCR as `ghcr.io/<owner>/horizon-<service>:<commit>` and `:main`.

The root `Jenkinsfile` runs the same checks and a local image build. It does not start containers or push images. Both pipelines pass `--env-file infrastructure/ci/compose.env` so Compose can interpolate required variables. That file is for image builds only. Do not start the stack with it.

When that CI run succeeds, the CD workflow (`.github/workflows/cd.yml`) starts. It runs on GitHub-hosted runners, pulls the `:main` images, and brings up an ephemeral stack with `compose.cd.yml`. That stack uses its own Postgres volume, checks that the services become healthy, and then removes itself. It does not read the host `.env` and does not replace the database on this machine.

The host stack is still updated with `bash scripts/update-running-stack.sh`.

## Jenkins agent prerequisites

- A Unix-like Jenkins agent with a POSIX shell
- Git, configured by the Jenkins SCM job
- Java 21
- Node.js and npm compatible with the committed lockfile (Node 24 is recommended)
- Docker Engine with the Docker Compose v2 plugin (also used by PostgreSQL Testcontainers)
- Permission for the Jenkins agent to use Docker
- Pipeline, Git, JUnit, and Artifact Manager functionality available in Jenkins

Maven does not need to be installed globally. Every backend module uses its committed Maven Wrapper. Initial builds require network access to the Maven and npm package registries unless dependencies are already cached.

## Pipeline stages

1. Checkout the configured SCM revision.
2. Compile all six backend modules in parallel.
3. Test all six backend modules in parallel and publish Surefire reports.
4. Install frontend dependencies with `npm ci`.
5. Run frontend lint and a high-severity production dependency audit.
6. Run frontend TypeScript checking.
7. Build and archive the frontend production output.
8. Build all seven images with Docker Compose.
9. Validate the Compose model with `docker compose config -q`.
10. Emit a verification summary.

Any failed command fails its stage and the pipeline. Application containers are never started by the pipeline; workspace retention follows the Jenkins job's configured policy.

## Database and deployment scope

CI does not modify or depend on a shared PostgreSQL instance. Critical migration tests start disposable PostgreSQL 16 Testcontainers, apply Flyway from an empty schema, and remove the containers after the suite. Other backend tests retain isolated test configuration. Docker images are built without launching the application stack.

No deployment secrets are stored in the repository. Jenkins does not publish images or start the stack. GitHub Actions publishes the `main` images to GHCR. The CD workflow then deploys those images to an ephemeral stack and removes it after the health check. The database on this machine is not part of that deploy. Rebuild the local containers with `bash scripts/update-running-stack.sh`.
