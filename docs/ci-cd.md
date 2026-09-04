# Jenkins CI

The root `Jenkinsfile` defines the Lexorion Horizon continuous-integration pipeline. It validates the application and builds local Docker images; it does not deploy or push images.

## Jenkins agent prerequisites

- A Unix-like Jenkins agent with a POSIX shell
- Git, configured by the Jenkins SCM job
- Java 21
- Node.js and npm compatible with the committed lockfile (Node 24 is recommended)
- Docker Engine with the Docker Compose v2 plugin
- Permission for the Jenkins agent to use Docker
- Pipeline, Git, JUnit, and Artifact Manager functionality available in Jenkins

Maven does not need to be installed globally. Every backend module uses its committed Maven Wrapper. Initial builds require network access to the Maven and npm package registries unless dependencies are already cached.

## Pipeline stages

1. Checkout the configured SCM revision.
2. Compile all six backend modules in parallel.
3. Test all six backend modules in parallel and publish Surefire reports.
4. Install frontend dependencies with `npm ci`.
5. Run frontend lint.
6. Run frontend TypeScript checking.
7. Build and archive the frontend production output.
8. Build all seven images with Docker Compose.
9. Validate the Compose model with `docker compose config -q`.
10. Emit a verification summary.

Any failed command fails its stage and the pipeline. Application containers are never started by the pipeline; workspace retention follows the Jenkins job's configured policy.

## Database and deployment scope

CI does not start, create, migrate, seed, or otherwise manage PostgreSQL. Backend tests use their existing test configuration, and the Docker images are built without launching the database-backed services. This avoids requiring the currently absent Workforce, Payroll, and Finance databases.

No credentials are embedded in the pipeline. Production deployment and registry publication are intentionally not automated in this milestone.
