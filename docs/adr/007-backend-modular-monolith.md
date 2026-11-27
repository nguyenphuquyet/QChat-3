# ADR 007 — Backend shape for the new platform

- **Status:** ACCEPTED
- **Date:** 2026-11-27
- **Milestone:** M0 (implemented in M9)

## Context

Section 14 requires a modular monolith with clear domain boundaries, API prefix
`/api/v1/`, isolated build workers, a separate signing service, private source
storage, immutable artifacts, no manual review, and states for versions and
jobs. The existing server is a Next.js App Router service with Prisma/PostgreSQL,
S3-compatible storage, Redis and an audit log. It already carries the legacy QApp
domain.

## Decision

1. **Keep the existing Next.js server as the host of a modular monolith.** Do not
   add a second backend runtime.
2. **New domain modules under `apps/server/src/modules/v1/`** with the routes
   exposed under `/api/v1/`: `auth`, `developers`, `apps`, `projects`,
   `builds`, `packages`, `signing`, `versions`, `releases`, `distribution`,
   `permissions`, `analytics`, `crashes`, `compatibility`, `audit`.
3. **Reuse the shared infrastructure** (session verification, authorization,
   rate limiting, Prisma client, S3 client, audit log, push) through the existing
   services; do not fork them.
4. **Build workers are separate processes** (M9), with resource limits, timeouts,
   no signing keys, restricted network, cancellation, retries and logs. Developer
   scripts never run in the API process.
5. **Signing is a separate restricted service** (M9/M5 contract) with protected
   keys, rotation and revocation. The API process never holds the private key.
6. **No manual review.** Automated validation decides; `suspended` and `revoked`
   are operator controls. The legacy review workflow is `REMOVE` in the register.
7. The legacy `/api/miniapps/*` endpoints stay until M11 for production
   continuity and are removed with the legacy system.

## Alternatives considered

1. **A new standalone service (e.g. NestJS/Fastify).** Cleaner boundaries, but a
   second deployment, second auth integration and second database client. The
   specification asks for a modular monolith, not a microservice fleet.
2. **Extend the legacy `miniapps.ts` module.** Forbidden by section 12.2.
3. **Serverless build workers.** Rejected for M9: no long-running build control,
   harder cancellation/timeout guarantees, and possible cost beyond the ceiling.

## Consequences and risks

- The Next.js process must not run builds; the worker is a separate entry point
  in M9.
- Route coexistence (`/api/miniapps` legacy, `/api/v1` new) is deliberate and
  must be documented so no client calls the wrong one.
- The signing service is a new deployment unit; its key handling is the highest
  security risk in M9.

## Cost and effort to reverse

Medium: the domain modules are separate files; moving them to another process is
possible. Changing the URL prefix later would break clients, so it is fixed now.
