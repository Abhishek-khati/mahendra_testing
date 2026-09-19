# ChainShield AI Deployment

The application ships as a non-root Node 22 container. Build verification runs type checking, regression tests, the production build, and Dockerfile validation in CI. Local development can use `docker compose up --build` after setting `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and `JWT_SECRET` in the shell or an untracked `.env` file.

Required server-side configuration includes `DATABASE_URL`, `JWT_SECRET`, OAuth environment variables, and the built-in Forge URL/key when object storage or contextual AI is enabled. Never expose `BUILT_IN_FORGE_API_KEY`, `JWT_SECRET`, or `CHAINSHIELD_WORKER_TOKEN` to the client bundle.

Database changes are generated with `pnpm drizzle-kit generate`, reviewed for destructive statements, and applied through the managed migration workflow. The initial ChainShield schema contains workspace isolation, immutable source manifests, run stages, artifacts, evidence, findings, reviews, test executions, dependencies, deployment targets, reports, report anchors, and audit events.

Before enabling compiler, Slither, or behavioral stages, deploy a separate sandbox worker. The worker must authenticate requests, pin `solc`/Slither/test-tool versions, mount source read-only, disable egress by default, enforce CPU/memory/wall-clock/output limits, avoid shell interpolation, and return signed result envelopes containing tool versions and evidence hashes. Without this worker, the API deliberately returns `unsupported` for those stages.

Hosted production should terminate TLS at the edge, use a shared rate limiter, centralize structured logs and alerts, configure database/object retention, and run backups with restore tests. Use a rolling deploy and retain the previous image/checkpoint for rollback. Do not deploy the local Compose passwords or placeholder worker values.
