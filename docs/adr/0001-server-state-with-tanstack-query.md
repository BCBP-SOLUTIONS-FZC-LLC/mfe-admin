# ADR 0001: Server state uses TanStack Query

## Status

Accepted (2026-11-25), decided at Architecture Review. Closes mfe-admin LLD §15 #1.

## Context

The platform constitution makes TanStack Query mandatory for server state. `mfe-tender` ADR 0002 deferred it because that remote had only fixtures behind SDK `useApi`.

This remote has a real IAM API from day one: paged and filtered lists (members, invitations, audit), a batched profile lookup (`POST /users:batch`, up to 200 IDs, about 60 s cache), a per-session department catalogue, and writes that must invalidate those reads. The earlier draft proposed `useApi` plus a small keyed cache in `infrastructure/api`.

## Decision

Use TanStack Query for all server state in this remote.

- Reads are queries, writes are mutations, and a successful write invalidates the affected query keys.
- Query keys are built in one place in `infrastructure/api` and include the workspace slug, so a workspace switch cannot show another workspace's data.
- HTTP still goes through the SDK `ApiClient` (route templates, Problem Details, telemetry, auth). TanStack Query only owns caching, request de-duplication, retries and invalidation. It never calls `fetch` itself.
- `userBatcher` stays as a small batching function (de-duplicate, chunk at 200). Its results are stored per user ID in the Query cache with `staleTime` about 60 s.
- Retries: none on `4xx`; the default back-off on `5xx` and network errors. `401` is left to the SDK's redirect.
- One `QueryClient` per mount of `./App`, created in `app/`, never at module level, and cleared on unmount.
- Ports and domain rules do not import TanStack Query. Only `features/` hooks and `app/` do. The architecture lint (`.dependency-cruiser.cjs`) gets a rule for this.
- TanStack Query is a dependency bundled in this remote (the shell shares only React, React DOM, OpenTelemetry and SDK subpaths).

Client state (Zustand) is not decided here. This remote has little of it, and `useDraft` and the SDK's `storage()` cover it today. Revisit if a screen needs shared client state.

## Rejected alternative

`useApi` with a custom keyed cache. It would re-implement de-duplication, staleness, invalidation, paging keys and retry handling that TanStack Query already provides, and we would own and test that code for the life of the remote. The higher long-term maintenance cost outweighs the extra dependency.

## Consequences

- The remote follows the constitution with no deviation to record.
- Bundle size grows by TanStack Query. Check this against the bundle budget when the first screen lands.
- The Query cache is private to this remote. `mfe-me`, `mfe-dashboard` and `mfe-tender` do not share it, so each remote that shows user chips fetches its own profiles. The shared-component question (LLD §15 #5) is unchanged.
- Cache behaviour is tested through the hooks (stale, invalidated, retried, workspace-keyed), not through a hand-written cache.
- Update LLD §3, §7.2 and §10, plus §15 #1, to match.
