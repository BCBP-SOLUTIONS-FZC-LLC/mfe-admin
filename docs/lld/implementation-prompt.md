# Implementation Prompt: mfe-admin

> **Historical (written against LLD v0.1.5, 2026-11-25).** The build it describes is done. Where it differs from the code now: the app is under `src/app/`, the SDK is `1.0.0-alpha.10` (with `useRefreshSessionContext`), the identity components are interim copies (ADR 0003), `AdminLayout` is the page outlet only (web-shell draws the frame and the Admin sub-menu), tests are Rstest, and use cases exist (ADR 0004). Current rules: `.claude/CLAUDE.md`.

Paste the prompt below into a fresh Claude Code session started in an empty `mfe-admin` checkout, with the sibling repos (`mfe-dashboard`, `mfe-tender`, `web-shell`) beside it. Written against [mfe-admin-lld.md](mfe-admin-lld.md) v0.1.5. If the LLD changes, update this prompt with it.

Notes:
- The prompt stops at two known blockers (shared identity package, session-context refresh) and asks instead of inventing.
- It ends by waiting for a go-ahead. Delete the last sentence to let the session scaffold straight away.

---

````text
You are implementing `mfe-admin`, the tenant-administration Module Federation remote (container `admin`, ownerDomain `iam`) for the Tender Management SaaS platform. Work from the design documents, not from memory.

## Source of truth (read first, in this order)
1. docs/lld/mfe-admin-lld.md  (v0.1.5: the design baseline; read "Signoff conditions" and §15 first)
2. docs/adr/0001-server-state-with-tanstack-query.md
3. docs/observability/metrics.md  (proposed metric inventory; the code must match it)
4. docs/lld/session-context-refresh-handoff.md, app-chrome-handoff.md, shared-components-and-navigation-handoff.md, web-shell-iam-handoff.md
5. Sibling repos as structural references (read-only): ../mfe-dashboard (shipped, v0.4.0: build, nginx, CI, release, arch-lint, metrics test), ../mfe-tender (layout and conventions), ../web-shell (host: manifest, RemoteBoundary, navigator, SDK usage)
6. /Users/balaji/BCBP/xpertpms/docs/iam-product-screen-spec.md v0.1 (screens E1-E7, §7 shared components, §9 errors, §11 API map, §14 open questions), and the IAM Swagger 2.0 files in /Users/balaji/BCBP/xpertpms/docs/IAM_swagger: iam-org-membership.yaml, iam-user-profile.yaml, iam-catalog-admin.yaml, iam-group-mapping.yaml, iam-audit-log.yaml, iam-delegation.yaml (the other three are not used by this remote). Mind the per-file basePath: `/api/v1` for most, `/` for group-mapping (paths already start with /api/v1), none for delegation (paths already start with /api/v1)

Where the LLD and a sibling repo disagree, say so and ask; do not silently pick. Once code exists the code wins over the LLD, so update the LLD in the same change when you diverge.

## Scope (this release only)
Build: E1 Users and invitations, E1a Invite, E2 User detail, E2a Impact review **step 2 only** (IAM 409 resolution path), E3 Departments and role labels, E5 Group mappings, E6 Tenant settings, E7 Audit log and exports, AdminLayout (section nav only), the `admin` message catalogue, Tier 3 metrics.
Do NOT build: E4 SSO (wireframe only: no route, no nav entry, no calls), E2a step 1 / WorkflowImpactPort, any global header, user menu, workspace switcher or admin entry point (unassigned owner, LLD §15 #2), any `mfe-me` screen (G1-G6, separate repo), operator console, sign-up, or anything in web-shell.

## Blockers to check before writing screen code (stop and report if unmet)
- Shared identity components (user chip, department label, member picker) come from a common package that does not exist yet (LLD §15 #5). Until a package name and alpha exist, do not write a local copy. Build against an `IdentityDirectory` port and a fake, and ask me where the package lives. Screens that show people are blocked on this.
- Session-context refresh: the SDK has no refresh (handoff). Code against a thin `useAdminAccess` seam and a TODO-free stub that calls nothing; do not call P-35 from the remote or add a private copy of roles.
- Confirm SDK versions: installed SDK, webpack-preset and eslint-plugin must be equal (`1.0.0-alpha.9`) and not newer than web-shell's. web-shell's local node_modules showed alpha.6; check before relying on SDK behaviour (e.g. `/nav`, `useSessionContext`).

## Architecture rules (from the LLD, enforce with tooling)
- Layers: app -> presentation, application, domain, infrastructure, shared; presentation (application, domain, shared); application (domain, shared; no React, SDK or browser); domain (nothing; pure TS); infrastructure (application, domain, shared); shared (nothing). Add `.dependency-cruiser.cjs`, `npm run arch-lint`, `test/unit/architecture/layers.test.ts`, `test/unit/sdk/dependency-rules.test.ts` (copy and adapt from mfe-dashboard).
- One port per IAM service (OrgMembership, UserProfile, Catalog, GroupMapping, Audit, DelegationPolicy). The HTTP adapter per port lives in infrastructure/api on the SDK ApiClient with route templates. Identity is never sent (no x-user-id/x-tenant-*); tenant id in paths comes from useSessionContext().tenantId.
- Server state through TanStack Query (ADR 0001): keys include the workspace slug, one QueryClient per mount, only features/ and app/ import it, ports and rules do not.
- SDK only through public subpaths (/auth /config /http /i18n /logging /metrics /nav /problem /react /storage); never reimplement what the SDK provides; no raw storage, no tokens, no role-name literals, no console, no dangerouslySetInnerHTML.
- Routing: remote's own BrowserRouter with basename from `workspaceBasename`; routes under /admin per LLD §4.4; each page calls useRouteTemplate. Cross-remote links use SDK `navigate(appId, '/t/<slug>/...')` with the slug from useSessionContext(), never `<a href>`; same-remote moves use the own router.
- Authorization is UI hints only via useHasPermission / <Can> with the eight permission keys; the gateway decides.
- i18n: namespace `admin`, every UI string in locales (chrome in en.json, each screen in en/<screen>.json); catalogue test fails on missing/unused keys and hard-coded text.
- Metrics: implement exactly docs/observability/metrics.md (iam_admin_* through getServiceMeter, behind the AdminTelemetry port in application/ports/telemetry.ts, closed label sets in domain/events/admin-events.ts, failure vs error decided by the problem-to-outcome map). Add test/unit/metrics/metrics.test.tsx. If the code needs different label values, change the doc in the same PR.

## Build order
1. Scaffold from mfe-dashboard: Rsbuild + `pluginPlatform({ role:'remote', name:'admin', exposes:{'./App':'./src/App.tsx'} })`, `config/remote-manifest-entry.mjs`, dev port 5006 (strictPort, CORS *), standalone entry with runtime.json start-up, nginx image (SPA rule, security headers, digest-pinned, uid 101), CI, release workflow, changelog check, Dependabot ignore for the three platform packages. Add the integration test `remote-entry.test.tsx` (share keys, no SDK in bundle).
2. Composition root, providers, AdminLayout (section nav, per-page MFEErrorBoundary with resetKeys, read-only wrapper), useAdminAccess, i18n, telemetry adapter, problem.ts mapping (LLD §11), userBatcher (200-ID chunks, ~60 s TTL).
3. Domain: entities, value objects (RecordVersion, Cursor, AuditFilter), rules in admin-rules.ts (LLD §6.3) with both-path tests, ports.
4. Adapters + contract tests against IAM Swagger fixtures (response shapes, errorCode casing, invitation_id).
5. Screens in order: E1 + E1a, E2 (+ E2a step 2, reset MFA with useStepUp), E3; then E6, E7, E5. For each: loading/failed/error states, optimistic locking (409 ConflictDialog, never retry 409/422), read-only mode, step-up, and e2e flows listed in LLD §14.
6. Hardening: axe WCAG 2.1 AA browser tests, smoke script, bundle budget measure, ARCHITECTURE.md and constitution assessment, CHANGELOG, README.

## Working rules
- Do each step as a small, reviewable change with tests; run `npm run lint`, `arch-lint`, `tsc`, unit/integration/e2e after each. Coverage gate 95% and every src/domain file above 95%.
- Do not invent backend routes. If a route or field is not in the spec/Swagger, stop and list the question (LLD §15 #8: Q3, Q4, Q5, Q9, Q12, Q14).
- Do not resolve open LLD items yourself (#8-#13, #15-#17); record the dependency and continue where possible.
- Never commit secrets or tokens. Do not push or open PRs unless I ask.
- Keep the LLD accurate: update it (and its revision history) whenever the code diverges.

## Definition of done for the first milestone
Container builds and loads through web-shell's `loadRemote` (verified with a built remoteEntry.js through a shell share scope), E1-E3 work against mocked IAM end to end, metrics test and arch-lint green, image smoke test passes, and a short report lists what is blocked (shared package, session refresh, web-shell /admin route, IAM questions).

Start by reading the documents, then reply with: (1) the blockers you confirmed or could not confirm, (2) a step-1 scaffold plan with the exact files you will create, and (3) any contradictions between the LLD and the sibling repos. Wait for my go-ahead before writing code.
````
