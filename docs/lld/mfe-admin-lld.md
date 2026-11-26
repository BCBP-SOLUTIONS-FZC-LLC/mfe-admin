# mfe-admin — Low-Level Design

## Tender Management SaaS Platform — Administration Remote (`admin`)

| | |
|---|---|
| Repository | `BCBP-SOLUTIONS-FZC-LLC/mfe-admin` (the remote exists; nothing is committed to `main` yet beyond the baseline) |
| Status | **Baseline for signoff (conditional, see Signoff conditions).** The code is built and mounts in web-shell `0.5.0` (verified 2026-11-26 in a real browser session against the shell's `admin` manifest entry and `/t/:slug/admin/*` route); E4 SSO is wireframe only. This document was written from the IAM screen spec and the structure and rules of the sibling remote `mfe-tender`. Where it says "inherited", the rule comes from `mfe-tender`'s LLD or web-shell's; where it says "proposed", it is a decision for review (§15) |
| Deliverables | Container image `ghcr.io/bcbp-solutions-fzc-llc/mfe-admin` and the release `dist` tarball (proposed, as `mfe-dashboard`). `package.json` private; nothing is published to npm |
| Version | `0.1.17`, 26 November 2026 (first draft `0.1`, 24 November). First release target: none set |
| Narrative | `ARCHITECTURE.md` (the layer model, data flow and runtime flows; the constitution assessment and refactoring outputs are in `docs/architecture/`); decisions so far in [docs/adr](../adr/); metrics in [docs/observability/metrics.md](../observability/metrics.md) |
| Upstream contracts | platform-reactcommon LLD and design doc (`docs/lld/platform-reactcommon-lld.md`, `docs/design/frontend-sdk-design.md`); `iam-product-screen-spec.md`; the IAM services' Swagger (§14 contract tests) |
| Host | `web-shell`, mounting this remote at `/t/<slug>/admin/*` with `RemoteBoundary remote="admin"`, no props, `ownerDomain: iam`. **web-shell `0.5.0` mounts it** (checked 2026-11-26: routes for `dashboard`, `tenders`, `drafting`, `workflows`, `admin` and `me`; the manifest entry and `remotes.allowedOrigins` are per environment; it draws the frame and the Admin sub-menu); see [web-shell-iam-handoff.md](web-shell-iam-handoff.md) |
| Platform SDK | `@bcbp-solutions-fzc-llc/frontend-sdk` `1.0.0-alpha.10` (peer `^1.0.0-alpha.10`, provided by the shell, whose `main` is on alpha.10); `webpack-preset` and `eslint-plugin` `1.0.0-alpha.10`. Never newer than web-shell's |
| Runtime | React 19, React Router 7, Tailwind 4 + daisyUI 5; Rsbuild 2 (Rspack); nginx on port 8080 (all inherited) |
| Source of requirements | `iam-product-screen-spec.md` v0.1 (19 Nov 2026), screens E1–E7 and the shared components of §7. Section references "§" below are to that spec unless stated |
| Siblings | `mfe-tender` (`docs/lld/mfe-tender-lld.md`, whose structure this follows) and `mfe-dashboard` |
| Not in this remote | `mfe-me` (G1–G6, separate remote, §2.3), C16 (inside `mfe-tender`), A1 sign-up, operator console O1–O4, A2/A4/A5/A6/A8 (web-shell). Reasoning in §2.2 |

### Revision history

| Version | Date | Change |
|---|---|---|
| 0.1 | 2026-11-24 | First draft, before any code |
| 0.1.1 | 2026-11-25 | Open item #14 resolved: separate remotes (`admin`, `me`). Added §2.3, updated §2.2 and §4.1 |
| 0.1.2 | 2026-11-25 | #2 resolved for this remote (section nav only; chrome owner unassigned, outside scope). #15 finding recorded. Updated §2.2, §7.12, §15 |
| 0.1.3 | 2026-11-25 | #5 resolved (shared identity components in a common package) and #6 resolved (shell-managed navigation). Corrected §4.4: SDK `navigate()` is not a full page load. Added `/nav` to §4.2 |
| 0.1.4 | 2026-11-25 | #3 and #4 resolved by scope acceptance: E2a step 2 only, E4 wireframe only. Updated §1, §2.1, §7.4, §15 |
| 0.1.5 | 2026-11-25 | Aligned with `mfe-dashboard`'s LLD (architecture and metrics): header rows, §3 import directions and telemetry port in `application/ports`, §4.2 share table, §5 lint rules and metrics row, §12 release and image, §14 suites, §15 #9 and #16. New [docs/observability/metrics.md](../observability/metrics.md) (proposed inventory) |
| 0.1.6 | 2026-11-25 | Scaffold built (step 1): `./App` is `src/app/App.tsx` (not `src/App.tsx`), no top-level `assets/` (the layers test allows only the six layers), `src/domain/vocabulary.ts` holds the IAM wire codes as data and §8 no longer says role names never appear (§3, §4.1, §8, §12). See CHANGELOG |
| 0.1.7 | 2026-11-25 | Step 2 built: query keys live in `application/queries/keys.ts` (ADR 0001 said `infrastructure/api`); `AdminTelemetry` adapter and the five `iam_admin_*` metrics; `problem.ts` (outcome, retry rule, message keys, incl. `DENY_MEMBER_SUSPENDED` and `DENY_UNRESOLVABLE_SUBJECT`); `userBatcher` is stateless (TTL is the Query cache's `staleTime`); `useAdminAccess` and permission-filtered section nav with a "not permitted" page (§3, §7.2, §11). See CHANGELOG |
| 0.1.8 | 2026-11-25 | Step 3 built: entities, value objects (`RecordVersion`, `Cursor`, `AuditFilter`), the six ports plus the interface-only `WorkflowImpactPort`, and `admin-rules.ts` with both-path tests. Rules differ from the draft where the spec or Swagger said otherwise: `planRemoval` refuses the last owner (IAM-UX-7), removing a department is allowed from a retired one, more failure codes (§6.1, §6.2, §6.3) |
| 0.1.9 | 2026-11-25 | Step 4 built: the six HTTP adapters, mappers and the pinned-Swagger contract tests (§3, §5, §14); ports return what the services answer (`DepartmentVersion`, `MemberStatusChange`, `RolesChange`, §6.2); an audit search takes one entry type until the SDK can repeat a query key; new open item #18 and [sdk-api-client-handoff.md](sdk-api-client-handoff.md) |
| 0.1.10 | 2026-11-25 | Step 5 begun: shared feature plumbing (measured queries and mutations, `ProblemReader` port, identity hooks, `Dialog`, `ConflictDialog`, `LoadFailed`) and **E1 and E1a built** (member table with filters and paging, seat meter, invite dialog, pending invitations with revoke). `userBatcher` moved to `application/queries` and problem reading to a port, so presentation imports no infrastructure (§3, §7.2). New load resource `user_profiles` in the metrics |
| 0.1.11 | 2026-11-25 | **E2 and E2a step 2 built**: member detail (profile edit with revert to the directory value, roles, departments, suspend, reactivate, remove, reset MFA with step-up), the resolution dialog for work a member covers (the original call is re-sent after the choice), `ProblemReader.resolutionRequired`, `planProfileEdit`, metric actions `assign_department` and `remove_from_department` (§2.1, §6.3, §7.4, §7.5) |
| 0.1.12 | 2026-11-25 | **E3 built**: the tenant's departments with member counts, retire and reactivate, the catalogue to activate from, and the three level labels (`planRoleLabel`) (§2.1, §6.3, §7.7) |
| 0.1.13 | 2026-11-25 | **E6 built** (workspace block, delegation policy, polling while the realm part applies). Fixed a flaw in E2 and E3: a "saved" notice kept inside a card keyed by `recordVersion` was lost when the save bumped the version and the card remounted (§7.9) |
| 0.1.14 | 2026-11-25 | **E7 built** (search with URL filters, paging, plan window, large-search export job, entry dialog, exports followed by polling) and the export job store port (§7.10, §15 #19) |
| 0.1.15 | 2026-11-25 | **E5 built** (plan gate, department-and-level table with the two-write partial-save retry, role table, locked owner rows). `planGroupMappings` takes the current lists, so a non-owner is refused only for changing owner rows. **All in-scope screens are now built** (E1, E1a, E2, E2a step 2, E3, E5, E6, E7; E4 stays wireframe-only) (§2.1, §6.3, §7.8) |
| 0.1.16 | 2026-11-25 | **Hardening**: the fake IAM and the LLD §14 e2e flows, the axe suite over every screen and dialog, the Chromium browser suite (CSP, colour contrast, routes), `ARCHITECTURE.md`, the constitution assessment, ADR 0002 and 0003, image rebuilt and smoke-tested. Fixed: a "saved" notice lost to a remount when a save settled after the card was unmounted (six cards now use `mutateAsync`), empty table headers, duplicate field names, a missing level-one heading (§14, §15 #10) |
| 0.1.17 | 2026-11-26 | **Aligned with the shipped platform**: SDK, webpack-preset and eslint-plugin `1.0.0-alpha.10`; `useSessionRefresh` calls the SDK's `useRefreshSessionContext` (§15 #15 resolved); web-shell `0.5.0` mounts `/t/<slug>/admin/*` and draws the frame, and its sidebar now also draws the Admin sub-menu, so this remote ships the page outlet only (§15 #2, #6); the dashboard's Aura look on every screen; Rstest instead of Vitest (ADR 0005); use cases (ADR 0004); smoke suite and the `.claude/` setup. Review fixes: a profile edit refreshes names at once, no stray error behind the removal-resolution dialog, disjoint query keys, an export is not started for an invalid range, the download link must be https |

### Signoff conditions

Signoff accepts this document as the design baseline. It does not close every open item in §15. Conditions:

1. **Scope:** E1, E2, E3, E5, E6, E7 and E2a step 2 only. E4 is wireframe only; E2a step 1 is out (§15 #3, #4).
2. ~~**Session-context refresh (§15 #15)**~~ **Resolved 2026-11-26:** SDK `1.0.0-alpha.10` has `useRefreshSessionContext` and web-shell `0.5.0` passes `refreshContext` ([handoff](session-context-refresh-handoff.md) §9). Open only: IAM's P-35 cache lag after P-28.
3. **Prerequisite to replacing the interim identity components, shared identity package (§15 #5):** name, home and owner decided and a first alpha published; until then this remote keeps its own copies ([handoff](shared-components-and-navigation-handoff.md) §8, ADR 0003).
4. ~~**Shell navigation**~~ **Resolved 2026-11-26:** web-shell `0.5.0` adds the `/admin/*` and `/me/*` routes and remounts a remote when `navigate()` moves inside it (same handoff, §3.3, §8).
5. ~~**App chrome owner (§15 #2)**~~ **Resolved 2026-11-26:** web-shell owns the frame and the Admin sub-menu ([handoff](app-chrome-handoff.md) §9). Open: a joint browser test in web-shell's contract suite (§15 #10).
6. **Before the affected screens are built:** IAM answers the §15 #8 questions. Items #9–#13 are tracked build-time work.
7. SDK findings were checked on 2026-11-26 against the installed and pinned `alpha.10` (the earlier `alpha.6` and `alpha.9` checks are superseded).

### Table of Contents

1. [Document Overview](#1-document-overview)
2. [Responsibilities and Boundaries](#2-responsibilities-and-boundaries)
3. [Architecture and Source Layout](#3-architecture-and-source-layout)
4. [Runtime Contract with the Shell](#4-runtime-contract-with-the-shell)
5. [Platform SDK Usage](#5-platform-sdk-usage)
6. [Domain Model](#6-domain-model)
7. [Key Flows](#7-key-flows)
8. [Authorization (UI hints)](#8-authorization-ui-hints)
9. [i18n](#9-i18n)
10. [State and Storage](#10-state-and-storage)
11. [Failure Handling](#11-failure-handling)
12. [Build, Image, Configuration and Release](#12-build-image-configuration-and-release)
13. [Security](#13-security)
14. [Testing](#14-testing)
15. [Open Items](#15-open-items)

---

## 1. Document Overview

This LLD records how the remote is to be built and what it promises its host: the exposed module, routes, shared modules, SDK dependencies, the domain rules and data it shows, and how it fails. Once code exists, the code wins over this document.

Unlike `mfe-tender`, which runs on fixtures, **every IAM route this remote calls is Built** (spec §11). The remote has a real backend from the first commit, but it calls **seven** services from the browser (Org & Membership, User Profile, Catalog, Group Mapping, Audit Log, Delegation settings, and later Workflow). Two things are not Built: the Workflow impact-review routes (Proposed, IAM-FE-Q6) and any tenant-facing IdP route (IAM-FE-Q7). **Scope accepted for this release (2026-11-25):** E2a ships **step 2 only** (IAM's `409` resolution path) and E4 stays **wireframe-only**. No code calls the missing routes, and no production-ready SSO is promised in this milestone. Enabling either needs backend work first (§15 #3, #4). Affected screens are marked in §2.1.

## 2. Responsibilities and Boundaries

### 2.1 In scope

| Screen | Purpose | Path | Backend status |
|---|---|---|---|
| E1 Users and invitations | Member list, seat meter, pending invitations | `users` | Built (backend). **Screen built** 2026-11-25 |
| E1a Invite user (dialog) | Create an invitation | n/a | Built (backend). **Dialog built** 2026-11-25 |
| E2 User detail | Roles, departments, suspend, remove, reset MFA | `users/:userId` | Built (backend). **Screen built** 2026-11-25 (profile edit, roles, departments, membership, reset MFA) |
| E2a Impact review (dialog) | Gate before remove or demote | n/a | **This release: step 2 only** (IAM 409 path, Built). **Dialog built** 2026-11-25. Step 1 (Workflow impact review) is **out of scope**, no backend route (IAM-FE-Q6) |
| E3 Departments and role labels | Activate departments, rename level labels | `departments` | Built (backend). **Screen built** 2026-11-25 |
| E4 Single sign-on | IdP configuration | `sso` | **Wireframe only this release** (scope accepted): no tenant-facing IdP route (IAM-FE-Q7). No route, no nav entry, no calls, no production SSO commitment |
| E5 Group mappings | IdP group → department, level, role | `group-mappings` | Built (backend). **Screen built** 2026-11-25 |
| E6 Tenant settings | Workspace block (owner), delegation policy (admin) | `settings` | Built (backend). **Screen built** 2026-11-25 |
| E7 Audit log | Search, detail, exports | `audit`, `audit/exports` | Built (backend). **Screens built** 2026-11-25 |
| Page outlet | `AdminLayout`: the page outlet and a `MFEErrorBoundary` per page (web-shell draws the frame and the Admin sub-menu; per-section gating and read-only handling are in each page) | `app/layouts` | n/a |
| The `admin` message catalogue and Tier 3 metrics (`iam_admin_*`, [inventory](../observability/metrics.md)) | | `infrastructure/` | n/a |

### 2.2 Out of scope (owned elsewhere)

| Concern | Owner |
|---|---|
| Sign-in, MFA enrolment, tokens, session, sign-out, workspace switch | SDK `/auth` in web-shell (Keycloak) |
| App chrome: global header, user menu, admin entry point, workspace switcher | web-shell (`0.5.0`): its sidebar, user menu, workspace switcher and the Admin sub-menu (§15 #2, [app-chrome-handoff.md](app-chrome-handoff.md)). This remote ships the page outlet only |
| Whether an action is allowed | IAM and the gateway (AuthZ Enrichment). This remote only hides what the user cannot do |
| Role → UI permission map | web-shell `src/domain/rules/permissions.ts` (the eight permissions in spec §4.3) |
| P-35 (session context: roles, plan, flags) | web-shell owns the port and the call. This remote has no `P-35` adapter and reads the result through `useSessionContext`. It asks for a refresh through the SDK's `useRefreshSessionContext` (§15 #15, resolved) |
| A1 sign-up | A separate app on `signup.bcbpsolutions.com` (`bff-signup`); ownership IAM-FE-Q15 |
| A2, A4, A5, A6, A8, tenant banners | web-shell (needs P-1, P-27 and `errorCode` branching on P-35 `403`) |
| G1–G6 (profile, availability, delegations, AI and notification preferences, security) | `mfe-me`, a **separate remote** (decided, §2.3). Different audience (everyone) and weight |
| C16 restricted-tender access | `mfe-tender` (IAM-UX-12: reachable only from a tender the user can see). The routes and rules are IAM's |
| O1–O4 operator console | A separate app on the platform realm |
| Workflow impact review routes | Workflow service (IAM-FE-Q6) |
| IdP routes | Org & Membership + Realm Provisioner (IAM-FE-Q7) |
| Hosting in an environment, the manifest, SRI enforcement, kill switch | Platform deployment, web-shell, SDK `/mfe` |

### 2.3 Remote split (decided)

IAM UI ships as **separate remotes, one per audience**, not a single `mfe-iam`:

| Remote | Container | Mount | Audience | Screens |
|---|---|---|---|---|
| `mfe-admin` (this repo) | `admin` | `/t/<slug>/admin/*` | Tenant admins and owners | E1–E7 |
| `mfe-me` (own repo, own release) | `me` | `/t/<slug>/me/*` | Every member | G1–G6 |

Both use `ownerDomain: iam`. Reason: this matches the planned target architecture and avoids a later remote-boundary refactor. Consequences:

- No code, route, container or manifest entry is shared between the two; the `admin` bundle never contains G1–G6.
- Anything both need (user chip, department label, member picker; §15 #5) must come from the SDK or a shared singleton in the preset, or be duplicated, until that is settled.
- Links between `/admin` and `/me` are cross-remote moves through the shell's router with SDK `navigate()` (§15 #6, §4.4).
- Release, SRI, kill switch and manifest entry are per remote.

## 3. Architecture and Source Layout

The Frontend Architecture Constitution's layers, as in `mfe-dashboard` (ADR 0001 there, layered structure) and `mfe-tender` (inherited), with one change: the port is split per service, because this remote talks to several. The layers that each may import are in brackets.

```
src/
├── env.d.ts                          ambient types (ImportMeta, assets)
├── app/                              composition root (may import every layer)
│   ├── App.tsx                       federation expose ./App (default App, named workspaceBasename)
│   ├── routes/index.tsx              AdminRoutes (one `Section` per route: route template, access check, "not permitted"), workspaceBasename
│   ├── providers/                    composition.ts (the HTTP adapters, telemetry and navigation: the only wiring point), AdminProviders.tsx (one QueryClient per mount, cleared on unmount; the services), queryClient.ts (retry rules)
│   ├── bootstrap/                    main.tsx (standalone entry), remote.ts (the remote build's placeholder entry)
│   ├── layouts/                      AdminLayout (page outlet, per-page MFEErrorBoundary; the shell draws the Admin sub-menu)
│   └── styles/                       index.css (Tailwind, daisyUI), aura.css and daisyAuraBridge.css (the dashboard's Aura tokens, copied)
├── presentation/                     UI (application, domain, shared)
│   ├── pages/                        UsersPage, UserDetailPage, DepartmentsPage, GroupMappingsPage, SettingsPage, AuditPage, AuditExportsPage, and one folder per screen for its parts (users/, user/, departments/, mappings/, settings/, audit/). No SsoPage: E4 is wireframe only
│   ├── components/                   styles.ts (card, table, button and input classes), Dialog, Drawer, ConfirmDialog, ConflictDialog, ResolutionDialog, LoadFailed, ProblemDetails ("Copy details" with traceId), SeatMeter, SectionPlaceholder; identity/ (Avatar, UserChip, DepartmentLabel, MemberPicker, RoleBadge, MemberBadges: interim copies of what the shared package will replace, ADR 0003)
│   └── features/                     services.tsx (services provider, `useAdminServices`, `useAdminUseCases`), tracked.ts (measured queries, paged queries and mutations), workspace.ts (slug-keyed queries), useProblemText.ts, access/useAdminAccess.ts, session/useSessionRefresh.ts (the SDK's refresh), identity/ (useUserProfiles, useDepartmentDirectory), members/, departments/, mappings/, settings/, audit/ (one hook file per screen)
├── application/                      use cases and ports, no React, browser or SDK runtime (domain, shared)
│   ├── ports/                        telemetry.ts (AdminTelemetry), problems.ts (ProblemReader: outcome, refresh and reload signals, message key, trace ID of a failed call), exportJobs.ts (ExportJobStore), navigation.ts (AdminNavigation: the plan upgrade)
│   ├── queries/                      keys.ts (adminKeys(slug): every query key, slug first), userBatcher.ts (§7.2: de-duplicate, chunk at 200; the 60 s TTL is the Query cache's staleTime)
│   └── use-cases/                    one class per repository-port operation (35), createUseCases / AdminRepositories in index.ts (ADR 0004); the feature hooks call them through `useAdminUseCases`
├── domain/                           pure TypeScript (nothing)
│   ├── entities/                     Member, User, Invitation, SeatUsage, TenantDepartment, CatalogDepartment, RoleLabel, GroupMapping*, TenantSettings, DelegationPolicy, AuditEntry, AuditExport, ImpactItem
│   ├── value-objects/                RecordVersion, Cursor, AuditFilter
│   ├── vocabulary.ts                 TENANT_ROLES, DEPARTMENT_LEVELS, audit families (IAM wire codes, data only; §8)
│   ├── rules/admin-rules.ts          plan* (§6.3)
│   ├── events/admin-events.ts        ADMIN_ACTIONS, ACTION_OUTCOMES, STEP_UP_ACTIONS, LOAD_RESOURCES (closed metric label sets)
│   └── repositories/                 OrgMembershipPort, UserProfilePort, CatalogPort, GroupMappingPort, AuditPort, DelegationPolicyPort, WorkflowImpactPort (interface only: E2a step 1 is not built)
├── infrastructure/                   implementations (application, domain, shared)
│   ├── api/                          one HTTP adapter per port (orgMembership, userProfile, catalog, groupMapping, audit, delegationPolicy), on the SDK's ApiClient with route templates; scope.ts (the tenant ID read at call time, `withSignal`), readers.ts and mappers.ts (service JSON ⇄ domain types; a missing field is a `MappingError`, a null list is empty);
│   │                                 problem.ts (errorCode → outcome, retry rule, message key; §11; exposed to the screens only as the `ProblemReader` port)
│   ├── configuration/                messages.ts, locales/en.json, locales/en/<screen>.json, standalone.ts (the standalone start-up: page identity and runtime config; the only reader of the environment)
│   ├── federation/navigation.ts      the AdminNavigation adapter (SDK navigate() with the workspace prefix from the session context), UPGRADE_PATH
│   ├── storage/exportJobs.ts         the ExportJobStore on the SDK's storage('admin')
│   └── telemetry/metrics.ts          Tier 3 instruments and the AdminTelemetry adapter
└── shared/                           depends on nothing of ours: constants/app.ts (APP_ID = 'admin'), hooks/useFocusTrap.ts
```

`npm run arch-lint` (dependency-cruiser, `.dependency-cruiser.cjs`; its own CI step `Architecture lint`) and `test/unit/architecture/layers.test.ts` enforce the import directions in brackets and reject import cycles. They keep `domain/` and `application/` free of React, the SDK and browser APIs, and keep the SDK's storage, metrics and config out of `presentation/` and `application/` (only `infrastructure/` and `app/` import them). The rules are carried over from `mfe-tender` (six components: `app`, `presentation`, `application`, `domain`, `infrastructure`, `shared`; nothing from `test/`). A new folder joins a component in the same PR. `test/unit/sdk/dependency-rules.test.ts` enforces the SDK rules in §5.

**Server state (decided, [ADR 0001](../adr/0001-server-state-with-tanstack-query.md)).** TanStack Query owns server state: queries, mutations and invalidation, with keys that include the workspace slug and one `QueryClient` per mount. HTTP still goes through the SDK `ApiClient` (§5). Only `features/` hooks and `app/` import TanStack Query; ports and rules do not. The `useApi` plus keyed-cache option was rejected as a duplicate of what TanStack Query provides.

## 4. Runtime Contract with the Shell

This is the SemVer surface. Same model as `mfe-tender` §4 (inherited).

### 4.1 Container

| Item | Value |
|---|---|
| Container name / global | `admin`, defined by `remoteEntry.js` as `var __platform_mfe_admin` (the preset's `containerName('admin')`) |
| Exposed module | `./App` → `src/app/App.tsx` (default `App`, named `workspaceBasename`; the routes are in `src/app/routes/index.tsx`) |
| Chunk loading | Relative to `remoteEntry.js`; every lazy chunk pinned by sha384 inside `remoteEntry.js` |
| Images and fonts | Imported from `src/`, never root-relative (inside web-shell `/image/…` resolves on the shell's origin) |
| Split chunks | Async only; a split entry makes the container global a Promise, which `loadRemote` refuses |
| Manifest entry | `"admin": { "entry": ".../remoteEntry.js", "version", "ownerDomain": "iam", "integrity": "sha384-…" }`, written by `config/remote-manifest-entry.mjs` at build. `ownerDomain` must be `iam` (a registry domain) or the SDK drops the entry or refuses the metrics |
| Name rule | `^[a-z][a-z0-9_-]{0,62}$`, not `shell` |
| Remote split | This remote owns only `admin` (E1–E7). The member self-service screens are the separate `me` remote (§2.3). The container is not renamed to `mfe-iam`, and `ownerDomain` stays `iam` for both |

### 4.2 Shared modules

`sharedFor('remote')` offers React, React DOM, `@opentelemetry/api` and every SDK subpath as strict singletons (`import: false` for the SDK, never bundled). Subpaths used here: `/auth`, `/config`, `/http` (see §5), `/i18n`, `/logging`, `/metrics`, `/nav`, `/problem`, `/react`, `/storage`. The build consumes only what `src/` imports; `remoteEntry.js` contains:

| Share key | `requiredVersion` | Notes |
|---|---|---|
| `react`, `react/jsx-runtime` | `^19.0.0` | strict singleton |
| `@bcbp-solutions-fzc-llc/frontend-sdk/{auth,config,http,i18n,logging,metrics,nav,problem,react,storage}` | `^1.0.0-alpha.10` (the preset's SDK version) | `import: false`: never bundled, no fallback; the load fails without the shell's copy |

`react-dom` is used only by the standalone entry, and `@opentelemetry/api` not at all, so neither appears in the remote. `react-router-dom` is **not** shared; the remote brings its own router (§4.4). TanStack Query is bundled in the remote (not shared), one `QueryClient` per mount (ADR 0001). The integration test `remote-entry.test.tsx` from `mfe-dashboard` and `mfe-tender` is carried over: every share key is one the shell provides, no SDK code is in the bundle, CSS integrity, assets from the remote's public path, nothing environment-specific compiled in.

### 4.3 Props

None. The shell passes no props to any remote, and this remote reads the user, session context, sign-out and step-up through SDK hooks. A new required prop would be a MAJOR change.

### 4.4 Routes

| Mounted | Router | Paths |
|---|---|---|
| Inside web-shell (`/t/<slug>/admin/*`) | The remote's own `BrowserRouter`, `basename = workspaceBasename(pathname)` (e.g. `/t/acme`). `useInRouterContext()` is false under the shell's router | `/admin/*` under the basename; unknown paths → `/admin/users` |
| Standalone (`npm run dev`, the image's `/`) | Same, no basename | `/admin/...` |

| Screen | Path | Route template |
|---|---|---|
| E1 | `users` | `/t/:slug/admin/users` |
| E2 | `users/:userId` | `/t/:slug/admin/users/:userId` |
| E3 | `departments` | `/t/:slug/admin/departments` |
| E4 | none | No route (wireframe only: no route, no nav entry) |
| E5 | `group-mappings` | `/t/:slug/admin/group-mappings` |
| E6 | `settings` | `/t/:slug/admin/settings` |
| E7 | `audit`, `audit/exports` | `/t/:slug/admin/audit[/exports]` |

Each page registers its template with `useRouteTemplate`. A user visiting a section they cannot use sees a "not permitted" page, not a redirect.

**Migration from `mfe-dashboard`.** User management exists today at `/t/:slug/dashboard/user-management`, on fixtures (IAM-FE-Q10). When E1 ships here, `mfe-dashboard` keeps a redirect to `/admin/users` for one release. That redirect uses the SDK `/nav` `navigate('admin', '/t/<slug>/admin/users', { replace: true })`, which goes through the shell's router (no page load) for a same-workspace path, not an in-router `Navigate` from the dashboard's own router. Cross-remote rules and a same-remote gap to confirm: [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §3.

## 5. Platform SDK Usage

The rule is inherited: anything the SDK provides is used from the SDK through public subpaths only. `npm run lint` (`@bcbp-solutions-fzc-llc/eslint-plugin`: `no-raw-storage`, `no-sdk-deep-import`, `no-sdk-root-import`, `no-unsafe-html`, `no-identity-headers`, `no-eval`, …) and `test/unit/sdk/dependency-rules.test.ts` enforce it. The latter also keeps metrics in `src/infrastructure/telemetry/metrics.ts` through `/metrics` (no OpenTelemetry or Prometheus client), host-page start-up (`initializeCore`, runtime config) in `src/infrastructure/configuration/standalone.ts`, shell-only APIs (manifest, `loadRemote`, auth, flags, telemetry start) out of `src/`, role-name literals out of `src/`, and `console` out except the standalone config warning.

| Concern | SDK API | Used in |
|---|---|---|
| Signed-in user, sign-out | `useCurrentUser`, `useSignOut` (`/react`) | routes, `useActor` |
| Session context (roles, plan, flags, read-only, MFA window) | `useSessionContext`, `useReadOnly`, `useFeatureFlag` | layouts, `useAdminAccess` |
| Permissions | `Can`, `useHasPermission` | `useAdminAccess` (see §15 #7) |
| Step-up MFA | `useStepUp` → `{ needed, reauthenticate() }` | reset MFA (E2), any action the gateway guards |
| API calls | `useApiClient()` or `createApiClient({ mfe: 'admin' })` with route templates that start at `/v1/…` (`/v1/tenants/:id/members`; the client adds the same-origin `/api` prefix, as web-shell's `iam.ts` does for `/v1/me/session-context`; group mapping and delegation paths already carry `/api/v1` in their Swagger, so the adapter must not double it), wrapped by TanStack Query hooks in `features/*` (ADR 0001) | `infrastructure/api/*`, `features/*` |
| API errors | `isProblemError` (`/problem`), `problemMessage` (`/i18n`) | `infrastructure/api/problem.ts`, `LoadFailed` |
| Route naming | `useRouteTemplate` | every page |
| Logs | `getLogger({ mfe: 'admin' })` (`/logging`): a failed load is a `warn` with the error and resource (redacted by the SDK, exported by the shell) | `features/*`, API adapters |
| Metrics | `getServiceMeter({ mfe: 'admin' })` (`/metrics`): Tier 3 `iam_admin_loads_total`, `iam_admin_load_duration_seconds`, `iam_admin_actions_total`, `iam_admin_action_duration_seconds`, `iam_admin_step_up_requests_total` ; the SDK injects `domain` (`iam`), `service` (`admin`), `environment` and enforces the observability standard; the shell exports. Inventory and rules: [`docs/observability/metrics.md`](../observability/metrics.md) | `infrastructure/telemetry/metrics.ts` (through the `AdminTelemetry` port) |
| Messages, dates, numbers | `registerNamespace('admin', …)`, `useT('admin')`, `formatDate`, `formatNumber`, `useLocale` | components |
| Per-app storage | `storage('admin')` | the audit export job list, key `auditExports` (`infrastructure/storage/exportJobs.ts`, §10) |
| Navigation | `navigate()` from `/nav` | links to other remotes |
| Render errors | `MFEErrorBoundary` (`mfe="admin"`) per page, `resetKeys` = path | `AdminLayout` |
| Tests | `createTestPlatform`, `mockApi`, `mockProblem` / `parseProblemResponse` | `test/fixtures` |

**Identity is never sent by this remote** (IAM-UX-1). The gateway strips and re-injects `x-user-id`, `x-tenant-id` and `x-tenant-roles`; lint rule `no-identity-headers` enforces it. The tenant ID in a path comes from `useSessionContext().tenantId` and must equal the token's, or the call is `403`.

Not used yet, and the place to start when the need arrives: `useAppUpdate`, `useOnlineStatus`. Standalone, with no shell, every SDK API answers with its anonymous defaults (no user, `denyAll`, the default locale, `storage()` writes nothing), and the standalone page sets its own identity and runtime config as in `mfe-dashboard` §7.2 (`startStandalone`; `initializeCore`, `domain: 'iam'`, `serviceName: 'mfe-admin'`).

**Two ApiClient limits** (workarounds in place, asks in [sdk-api-client-handoff.md](sdk-api-client-handoff.md), §15 #18): `/users:batch` is sent as `users%3Abatch` because the template parser reads `:batch` as a parameter, and an audit search takes one entry type because a query value cannot be repeated.

**Own helpers** (no SDK counterpart): `utf8Bytes` (group names are limited to 255 *bytes*; private to `domain/rules/admin-rules.ts`), `userBatcher` (§7.2), the problem-to-outcome map (§11), `useFocusTrap` (`shared/hooks`, for dialogs and the drawer) and the `datetime-local` ⇄ UTC converters (`presentation/pages/audit/datetime.ts`).

## 6. Domain Model

### 6.1 Types (`src/domain/entities`)

| Type | Fields / values |
|---|---|
| `Member` | `userId`, `status` (`active`/`suspended`), `tenantRoles[]` (`member` is implicit, never stored), `departments[{ departmentId, level }]`, `recordVersion`. Joined with a profile (`UserSummary`: name, email, job title, `source` `local`/`federated`, availability, profile `status`) from User Profile, as a `ProfileState` (`found`, `missing` = "Unknown user", `unavailable` = "Name unavailable"). **The Swagger's `UserResponse` has no avatar field**, so none is modelled (spec E1 shows one: ask IAM). Level codes `preparator`/`reviewer`/`approver` |
| `Invitation` | `invitationId` (not the older `id` alias), `email`, `fullName`, `initialRoles[]`, `invitedBy` (a user ID; the name comes from User Profile), `sentAt` (`created_at`), `expiresAt`, `recordVersion`. Only `pending` is listed |
| `SeatUsage` | `activeUsers`, `pendingInvitations`, `licensedSeats`. `used = active + pending`; `over = active > licensed`. No grace date from the API (IAM-FE-Q3) |
| `TenantDepartment` | `departmentId` (UUID), `code`, `name` (P-3 already carries the catalogue's name and code), `isActive`, `isSystem`, `recordVersion`; member count comes from P-9. `CatalogDepartment` is the catalogue's row (`GET /departments`, which names its ID `id`) |
| `RoleLabel` | `roleCode` (`preparator`/`reviewer`/`approver`), `displayName`, `recordVersion` |
| `GroupMapping` | Three lists, each full replacement: `DepartmentMapping { groupName, departmentId }`, `LevelMapping { groupName, level }` (`role_code` on the wire), `TenantRoleMapping { groupName, role }`; at most 500 rows each |
| `TenantSettings` | `name`, `defaultLocale`, `mfaFreshnessSeconds` (60–900), `localAccountsEnabled`, `residencyMode` (`standard`/`strict`), `recordVersion`, plus read-only `status`, `plan`, `realmSyncPending` |
| `DelegationPolicy` | `maxDurationDays`, `reviewWindowDays`, each 1–180 |
| `AuditEntry` | `id`, `occurredAt` (UTC instant), `actor` (`type`: `user`/`service_account`/`iam_system`/`anonymous`, display name), `action`, `entryType`, `target`, `sourceService`, `retentionTier`, `ipAddress`, `traceId`, metadata. A search answers an `AuditPage` (with `windowClamped`, `effectiveFrom`) or, for a large one, an export job |
| `AuditExport` | `exportId`, `status` (`pending`/`running`/`ready`/`failed`/`expired`), `error` (the failure reason), `downloadUrl` and its expiry (re-issued on each poll), `expiresAt` (7-day retention), `rowCount` |
| `ImpactItem` | Tender, stage, department, level, deadline, last action (E2a step 1, Proposed) |

Value objects: `RecordVersion` and `Cursor` (branded, so a count or a search term cannot stand in for them) and `AuditFilter` (URL-pair parsing and writing, a stale link still opens). Three axes are kept apart (spec §2.1): tenant roles (closed set `tenant_owner`, `tenant_admin`, `tender_admin`; `member` implicit), department levels (never in `roles`), and plan (features and limits, never permissions). Times are UTC on the wire and rendered in the profile timezone (IAM-UX-14).

### 6.2 Ports (`domain/repositories`)

Each port mirrors one service's routes in the spec's §11 and returns domain types (adapters map snake_case to camelCase).

| Port | Routes it wraps |
|---|---|
| `OrgMembershipPort` | P-1, P-2, P-3, P-24, P-25, P-9, P-10, P-11, P-4, P-5, P-6, P-7, P-8, P-26, P-28, P-34, P-27, P-30, P-31, P-12, P-13 |
| `UserProfilePort` | `POST /users:batch`, `GET /users/:id`, `PATCH /users/:id` (admin edit of another user's profile, `expected_version`) |
| `CatalogPort` | `GET /departments` |
| `GroupMappingPort` | GM-1…GM-6 |
| `AuditPort` | AL-1…AL-4 |
| `DelegationPolicyPort` | DLG-6, DLG-7 |
| `WorkflowImpactPort` (Proposed; **interface only this release**: nothing calls it and no adapter is wired) | `GET /workflows/active-by-user` and the per-row reassign / pause routes |

### 6.3 Rules (`domain/rules/admin-rules.ts`)

Pure functions returning `{ ok: true, … }` or `{ ok: false, failure }`. Today and now are inputs. They enforce only what the UI knows; every one is **re-checked by the service**, and the UI never grants more than IAM does.

| Rule | Refuses | Accepts with |
|---|---|---|
| `planInvitation({ email, fullName, tenantRoles, departments, seats, actorIsOwner, activeDepartmentIds })` | `email-invalid` (blank, malformed or >254), `name-required` / `name-too-long` (>200), `seats-full` (`used ≥ licensed`), `role-not-offered` (`tenant_owner`/`tenant_admin` offered to owners only, IAM-FE-Q14), `department-inactive`; checked in that order | The P-6 body (trimmed, roles in vocabulary order, one row per department) |
| `planRoleChange({ current, next, actorIsOwner, ownerCount })` | `member-role`, `invalid-role` (a code outside the vocabulary), `role-not-offered` (changing `tenant_owner`/`tenant_admin` as a non-owner), `last-owner` (IAM-UX-7) | The full role list for P-28 (full replacement) |
| `planSuspension`, `planReactivation` | `last-owner`; `not-active` / `not-suspended` | The P-7 body with `recordVersion` |
| `planDepartmentAssignment`, `planDepartmentRemoval` | Assignment: `department-inactive`. Removal: `not-assigned` (removing from a retired department is allowed: only membership matters). A demotion or a removal is flagged `needsImpactReview`; a promotion or a new department is not | The P-10 / P-11 call |
| `planRemoval` | `last-owner` (IAM-UX-7: prevent removing the only owner) | The P-8 call, flagged `needsImpactReview` |
| `planResolution({ action, replacementUserId, subjectUserId })` | `replacement-required` for `replace_delegate`; `replacement-is-subject` | The P-26 body (`stop_workflows` carries no replacement) |
| `planRoleLabel(draft, current)` | `name-required`, `name-too-long` (the UI's own cap of 100: the Swagger declares none), `no-change` | The P-13 body: the unchanged level code, the trimmed label, the version being replaced |
| `planProfileEdit(draft, current)` | `name-required`, `name-too-long`, `title-too-long` (200 each, User Profile's limits), `no-change` | The `PATCH /users/:id` body: only the changed fields, with the version being replaced as `expected_version` |
| `planGroupMappings(draft, actorIsOwner, current?)` | `too-many-mappings` (>500), `group-required`, `group-too-long` (>255 bytes), `duplicate-group` (within one list), `invalid-level`, `role-not-allowed` (`member` or unknown), `owner-mapping-owner-only` (only when a non-owner changes the owner rows: given `current`, the lists as the service has them, a non-owner may save the rest beside owner rows left exactly as they were); `at` names the row | The full lists to write (trimmed names) |
| `planTenantSettings(draft, current, actorIsOwner)` | `not-owner`, `name-required`, `locale-invalid`, `mfa-window-out-of-range` (60–900, whole seconds), `residency-invalid`, `no-change` | The P-2 patch: only the changed fields, with the `recordVersion` being replaced |
| `planDelegationPolicy` | `days-out-of-range` (whole days, 1–180; `at` names the field) | The DLG-7 body |
| `planAuditQuery(filter, { limit, cursor })` | `range-invalid`, `range-inverted`, `one-entry-type-only` (more than one entry type: the SDK cannot repeat a query key), `page-too-small`, `page-too-large` (>1000; default 100) | The query. The plan's window is not guessed: the response reports `windowClamped` / `effectiveFrom` |

Also in the file: `seatsUsed`, `seatState` (`room`/`full`/`over`), `levelRank`, `isLastOwner`. The rules name `tenant_owner` and `tenant_admin` through `OWNER` and `ADMIN` in `vocabulary.ts`, so a literal still appears nowhere else. `test/unit/domain/rule-paths.test.ts` pins each rule both ways (inherited practice). Coverage gate: every `src/domain/` file above 90%.

### 6.4 Load states

Each load is a TanStack query through `useTrackedQuery` (`presentation/features/tracked.ts`), which gives the page `isPending`, `isError`, `error` and `refetch`. A load calls `telemetry.loadStarted(resource)` and finishes once with `success` or `error`.

| Load result | Handling |
|---|---|
| SDK `ApiError` | Logged once at `warn`; the page shows `LoadFailed` with `problemMessage` and Retry, and "Copy details" with `traceId` |
| Any other throw | Reaches the page's `MFEErrorBoundary` |

## 7. Key Flows

### 7.1 Mount inside web-shell

1. The shell resolves `admin` from its manifest; `loadRemote` injects `remoteEntry.js` (SRI), runs `init(shareScope)` and `get('./App')`, and renders inside `RemoteBoundary` at `/t/:slug/admin/*`.
2. Importing `App` registers the `admin` catalogue (`messages.ts`) and the CSS (`styles/index.css`).
3. `App` mounts its own `BrowserRouter` with `workspaceBasename(location.pathname)`.
4. Nothing here initialises the SDK, loads `runtime.json`, starts telemetry or signs in.
5. Standalone mode (the image's `/`) follows `mfe-tender` §7.2 and is anonymous: every call returns `401`, so it exists only for development and smoke tests.

### 7.2 E1 member list (IAM-UX-4)

1. `GET /tenants/:id/members?limit=50&cursor=` (P-4) returns IDs only: status, roles, departments, `record_version`.
2. The page collects the page's user IDs and calls `POST /users:batch` once (≤ 200 IDs; 50 per page). `userBatcher` de-duplicates and chunks the IDs; results are stored per user ID in the Query cache (`staleTime` about 60 seconds (matching the service cache)), so the pending-invitations tab, E2 and pickers do not refetch.
3. Rows are joined. `missing[]` → "Unknown user". A `users:batch` failure renders the rows with "Name unavailable"; rows are never hidden. **Built (2026-11-25):** `useUserProfiles` makes one lookup per set of IDs, writes each profile under its own key (`staleTime` 60 s) and asks only for IDs with no fresh profile; the table is `presentation/pages/users/MembersTab.tsx`.
4. Department names come from `GET /departments` (cached for the session), level labels from P-12. A catalogue failure shows "Department" and keeps the row.
5. **No server-side filters or search** (IAM-FE-Q5). Filter by department with P-9; filter by role or status client-side over loaded pages and say so ("Showing matches in the first N members — load more").
6. The "MFA enrolled" and "last login" columns are omitted (IAM-FE-Q4).

### 7.3 E1a invite

1. Before opening the dialog, if `active + pending ≥ licensed`, open the upgrade prompt instead (IAM-UX-8).
2. `planInvitation` validates; P-6 returns `202` with the pending invitation.
3. Errors map per §11. `503` means nothing was sent and the dialog says so (IAM-UX-5).
4. Revoke (P-31) needs the invitation's `record_version`. Resend is revoke plus invite and is refused by IAM within 60 minutes (`REINVITE_TOO_SOON`).

### 7.4 E2 and E2a remove or demote (IAM-UX-6)

```
remove / demote requested
  └─ step 1 (NOT in this release; no backend route, §15 #3): WorkflowImpactPort.activeByUser(userId)
        non-empty → per-row Reassign | Pause | Let them finish; apply through Workflow; show progress
        until it exists: skipped, and the dialog says the workflow impact check is not available yet
  └─ step 2 (this release): send the IAM call (P-8 / P-10 / P-11)
        409 WORKFLOW_RESOLUTION_REQUIRED { active_workflows, workflow_ids, allowed_actions }
          → ResolutionDialog: replace_delegate (member picker) | stop_workflows (confirm)
          → P-26 { action, replacement_user_id? }
          → re-send the original call automatically
        422 INVALID_REPLACEMENT | 503 WORKFLOW_SERVICE_UNAVAILABLE → nothing changed
```

Promotions (adding a department, raising a level) never need E2a.

### 7.5 E2 role, membership and MFA actions

**Built (2026-11-25):** `pages/UserDetailPage.tsx` with `user/{ProfileCard,RolesCard,DepartmentsCard,MembershipCard}.tsx`. The last-owner checks need the number of active owners, which P-4 cannot filter for (IAM-FE-Q5), so `useActiveOwnerCount` walks every page, and only for an active owner; if that fails the screen does not block and the service refuses the last owner itself (`422 LAST_OWNER_REMOVAL`). Controls show for admins and owners and are disabled, with the reason, in a read-only workspace; a plain member sees the page with every field and box disabled. After changing your own roles the page calls `useSessionRefresh` (the SDK's `useRefreshSessionContext`, §15 #15).

| Action | Flow |
|---|---|
| Change roles (P-28) | Full replacement of the role list. `tenant_owner` / `tenant_admin` checkboxes shown to owners only (follows the HLD until IAM-FE-Q14 is answered). `422 LAST_OWNER_REMOVAL` → "A workspace must keep at least one owner" |
| Suspend / reactivate (P-7) | Send `record_version`. Suspending does not move work; the dialog says so |
| Remove (P-8) | Runs E2a first; the confirm dialog names the person; `204` → back to E1 with a toast |
| Reset MFA (P-34) | Confirm → `useStepUp().needed` ? `reauthenticate()` first → call. The UI compares `auth_time` against the window before the call and still handles `DENY_MFA_STALE` after. Whether the gateway enforces this or only the UI is IAM-FE-Q12 |
| Profile edits | Same rules as G1 (`expected_version` in the request; the response returns `record_version`). Federated users: editing name or title sets `*_overridden`, with "Revert to directory value" (IAM-UX-11) |
| After changing **your own** roles | Ask the shell to refresh the session context (P-35, spec §8; mechanism §15 #15) |

### 7.6 Optimistic locking (IAM-UX-9)

Org & Membership, Delegation and Tender ACL use `record_version`; User Profile uses `expected_version` in the request and returns `record_version`. On `409` (`OPTIMISTIC_LOCK_CONFLICT` / `VERSION_CONFLICT`) the `ConflictDialog` reads the current `record_version` from the problem body and offers Reload. Never retry `409` or `422`.

### 7.7 E3 departments and labels

**Built (2026-11-25):** `pages/DepartmentsPage.tsx` with `departments/{TenantDepartments,CatalogDepartments,RoleLabelsCard}.tsx`. Member counts are asked per row (P-9) so a slow count never holds the table; a failed count shows "?". Retire and Reactivate send the version the row was read at, a `409` offers Reload, and a retirement is counted as `retire_department` while a reactivation and a catalogue activation are `activate_department`. The tenant list and the labels share their query keys with the directory the other screens use, so one load serves all of them. Departments P-3 answers carry the catalogue's name and code, so the catalogue is only needed for what the tenant has not activated.

1. P-3 (tenant departments) and `GET /departments` (catalogue) side by side; Activate = P-24; Deactivate / Reactivate = P-25 with `record_version`.
2. Hide the retire action when `isSystem` (`422 SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED` otherwise).
3. Member counts come from P-9 (one call per department; load lazily).
4. Role labels: three rows, P-13 with `record_version`. The code never changes; only `displayName` does.
5. Catalogue activation may lag up to 10 minutes (spec §8).

### 7.8 E5 group mappings (IAM-UX-10)

**Built (2026-11-25):** `pages/GroupMappingsPage.tsx` with `mappings/{DepartmentMappings,RoleMappings}.tsx`. The plan gate reads P-1 (`status`, `plan`), never a role: a trial workspace is told "SSO is available after you upgrade" (the shared realm has no SSO), a Starter workspace gets an upgrade card, and the lists are not even asked for in either case (until the `sso_enabled` flag reaches the session context, IAM gap G-10). The department table shows one row per group, joined from the two lists; a group in only one list keeps a half-set row and the page says a group needs both. Saving it is two writes, departments then levels; if the second fails after the first went through, the page says the departments were saved and offers "Retry the rest", which sends only the second write (`useSaveDepartmentMappings`). The role table is its own write. An admin sees owner mappings locked, is not offered the owner role, and can save the other rows beside them.

1. Three full-replacement lists. Recommended layout: one table "IdP group → department + level" (writes `/departments` **and** `/department-roles`) and one "IdP group → tenant role".
2. Saving the first table makes **two** writes. If the second fails, show which part saved and offer Retry for the remainder; do not claim success.
3. Send the whole list; an omitted row is deleted.
4. Mappings are **additive only** and apply at the user's *next SSO sign-in* (2-minute service cache). The screen says both.
5. Errors: `409 MAPPING_CONFLICT`, `422 DEPARTMENT_NOT_IN_CATALOG`, `403 ROLE_ASSIGNMENT_FORBIDDEN` ("Only an owner can change owner mappings"), `400 INVALID_ROLE`.

### 7.9 E6 settings

**Built (2026-11-25):** `pages/SettingsPage.tsx` with `settings/{WorkspaceCard,DelegationCard}.tsx`. While `realm_sync_pending` is true the settings are asked again every 30 seconds (`REALM_SYNC_POLL_MS`; the service itself retries about every 10 minutes) and the screen says "Saving to sign-in settings…". The language list is `ENABLED_LOCALES` (only `en` today, as the shell's runtime config), plus a saved value that is not in it, so it is never silently changed. The plan and status are shown read-only. Spec §10's "MFA for all users" indicator is not shown: P-1 returns `feature_flags` but the operator flag's name is not in the Swagger. The "saved" notices live in the page, not the cards: a save changes the record's version, the cards are keyed by it so their forms reload, and a notice kept inside would be lost with the remount (this also fixed the same flaw in E2's profile and roles cards and E3's labels).

1. Workspace block (owner only): P-2 with `record_version`. A `200` is final. A `202` means the realm part is still applying: show "Saving to sign-in settings…", poll P-1 until `realm_sync_pending` clears (retry cadence is the service's, about 10 minutes).
2. "Local accounts" carries the note that enforcement at login is not live yet (IAM gap G-6).
3. `residency_mode: strict` warns that AI drafting may be unavailable.
4. Delegation-policy block (admin or owner): DLG-6 to read, DLG-7 to write.

### 7.10 E7 audit

**Built (2026-11-25):** `pages/AuditPage.tsx` (filters in the URL, results, entry dialog, "Export these results") and `pages/AuditExportsPage.tsx`. Three consequences of the API's shape: (1) **one entry type per search**, because the SDK cannot repeat a query key (§15 #18; `planAuditQuery` refuses more with `one-entry-type-only`, exports take several in their JSON body); (2) there is **no "list my exports" route**, only `GET /audit/exports/:id`, so the exports this admin starts are tracked by ID in a job store (`application/ports/exportJobs.ts`, kept in the SDK's per-app storage by `infrastructure/storage/exportJobs.ts`: per workspace, newest 20, cleared on sign-out) and each is polled every 5 seconds while it is waiting or running; (3) the **entry-type taxonomy file** (`iam-audit-log/api/taxonomy.json`) is not available here, so the filter takes an exact entry type as text and the screen groups by family (the part before the first dot: Sign-in, Membership, …), which are the 14 families listed in spec E7 (§15 #19). The actor filter lists members, suspended ones included; an entry with no actor name is looked up in User Profile, else "Unknown user".

1. Filters: time range, entry type (loaded from `iam-audit-log/api/taxonomy.json` at build time), actor, actor type, target type and ID, source service, retention tier.
2. Keyset cursor, page size 100 (server max 1000). Filters live in the URL search string so a result is shareable.
3. A response with `window_clamped: true` shows "Showing from {effective_from} — your plan's audit window".
4. A **`202`** from search means the query is too large: switch to the export tracker ("This search is large, so we're preparing it as a file").
5. Exports: AL-3 to start, AL-4 to poll (`pending → running → ready | failed | expired`). The download URL is fresh on each poll; the file stays retrievable for 7 days. `429` → "Too many exports running".
6. Display rules: service account → "Automation", `iam_system` → "System".

### 7.11 Read-only and failing closed

When `useReadOnly()` is true every mutation is disabled with "Workspace is read-only (subscription ended)" (spec §7.10); a `DENY_TENANT_READ_ONLY` after the fact does the same. A `503 …_UNAVAILABLE` on invite, removal, reset MFA or settings means nothing changed, and the UI never shows success (IAM-UX-5).

### 7.12 Sign-out

Sign-out is the SDK's `useSignOut()`, offered by the shell's header menu; this remote draws no user menu, so it calls it only where a screen needs it (for example after a session-ending action). A global sign-out control belongs to the app chrome, which this remote does not own (§15 #2).

## 8. Authorization (UI hints)

All checks here are hints. IAM and the gateway decide; a stale hint is corrected by `403` handling and a session-context refresh (P-35, owned by the shell; this remote asks through `useRefreshSessionContext`, §15 #15) (IAM-UX-2: roles are not in the token; the shell also refreshes on focus, at most once a minute).

| UI | Needs (spec §4.3) |
|---|---|
| Admin area, E1 read, pickers | `read:members` (every member) |
| E1/E1a/E2 actions, E3 | `manage:members` (`tenant_admin`, `tenant_owner`) |
| Grant or remove `tenant_owner` / `tenant_admin` in E2; owner rows in E5 | `manage:admin-roles` (`tenant_owner`) |
| E6 workspace block | `manage:tenant-settings` (`tenant_owner`) |
| E4, E5 | `manage:sso` (admin or owner, **and** plan flag; gate on `plan ∈ {pro, enterprise}` until IAM gap G-10 is fixed; not available in the shared trial realm) |
| E6 delegation block | `manage:delegation-policy` (admin or owner) |
| E7 | `read:audit` (admin or owner) |
| Every mutation | Not `useReadOnly()` |

Role names are never used to decide access: no role literal appears in a permission check (a test rejects it). The IAM wire codes (`tenant_owner`, `tenant_admin`, `tender_admin`; levels `preparator`, `reviewer`, `approver`) are data for request bodies, badges and mapping rows, and live in one file, `src/domain/vocabulary.ts`, the only place `test/unit/sdk/dependency-rules.test.ts` allows them. These eight keys are in web-shell's role map (`manage:admin-roles` replaces the spec's `manage:roles:admin`, which the SDK's `roleMapAuthorizer` rejects); this remote only asks `useHasPermission`. The service account is never a member and never appears here.

## 9. i18n

Namespace `admin` (`APP_ID`), inherited layout: chrome in `locales/en.json`, each screen in `locales/en/<screen>.json` with keys prefixed by the screen. Stored codes (`tenant_admin`, `preparator`, `pending`, `ooo`, audit entry types) stay in English on the wire and are translated for display. Audit entry-type families get plain-word labels (`auth.*` → "Sign-in", `membership.*` → "Membership", and so on). Department level labels are the **tenant's** (P-12), not the catalogue's. Never show a server's `detail` text as the main message; use `problemMessage` and the table in §11.

`test/unit/i18n/catalog.test.ts` and `messages.test.ts` check the catalogue (a missing or unused key, a key in two files, every message formatting through the SDK).

## 10. State and Storage

| State | Where | Lifetime |
|---|---|---|
| Server data (members, invitations, departments, settings, audit) | TanStack Query cache (ADR 0001) | Per mount; user profiles about 60 s; catalogue per session; invalidated by the remote's own writes |
| Audit filters | URL search string | The URL |
| The audit export job list (IDs only, newest 20) | `storage('admin')` key `auditExports`, behind the `ExportJobStore` port | Per workspace; cleared on sign-out and workspace switch by the SDK |
| Open dialogs, selection, form drafts | React state | The mount |

No tokens, no user data and no permissions are stored. The only thing this remote keeps is the export job list above, through the SDK's `storage('admin')` (namespaced per workspace). The theme is the shell's. Raw browser storage is rejected by lint.

## 11. Failure Handling

Rendering rules (spec §9, inherited from IAM): every error body is RFC 9457 `application/problem+json`; `errorCode` is UPPER_SNAKE (compare case-insensitively); show `traceId` behind "Copy details" on every error. Retry only `429` (honour `Retry-After`) and `503`, and only for idempotent calls. Never retry `409` or `422`.

| Failure | Behaviour |
|---|---|
| Rule refuses | Catalogue message; `iam_admin_actions_total{outcome="failure"}`; nothing sent |
| `409 SEAT_LIMIT_REACHED` | Upgrade prompt for seats |
| `409 INVITATION_ALREADY_EXISTS`, `429 REINVITE_TOO_SOON`, `429 INVITE_RATE_LIMITED` | "Already invited", "Invited less than an hour ago", "Try again later" |
| `422 LAST_OWNER_REMOVAL` | "A workspace must keep at least one owner" |
| `409 WORKFLOW_RESOLUTION_REQUIRED` | `ResolutionDialog` (§7.4) |
| `422 INVALID_ACTION` / `INVALID_REPLACEMENT` | Fix the choice |
| `503 WORKFLOW_SERVICE_UNAVAILABLE`, `REALM_PROVISIONER_UNAVAILABLE`, `…_UNAVAILABLE`, `DB_UNAVAILABLE` | "Nothing was changed. Try again." |
| `422 MEMBER_NOT_ACTIVE` (reset MFA) | "Reactivate the user first" |
| `422 DEPARTMENT_NOT_ACTIVE_FOR_TENANT` | "Activate the department first" (link to E3) |
| `422 SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED` | Action is hidden; message if reached |
| `409 OPTIMISTIC_LOCK_CONFLICT` / `VERSION_CONFLICT` | `ConflictDialog` |
| `409 MAPPING_CONFLICT`, `422 DEPARTMENT_NOT_IN_CATALOG`, `403 ROLE_ASSIGNMENT_FORBIDDEN` | E5 messages (§7.8) |
| `403 DENY_ROLE_INSUFFICIENT` | "You don't have permission to do this", then ask the shell to refresh the session context (`useSessionRefresh`, §15 #15) |
| `403 DENY_TENANT_READ_ONLY` | Read-only mode |
| `403 DENY_MFA_STALE` | Step-up, then retry once |
| `503 DENY_SERVICE_UNAVAILABLE` | "We couldn't check your access, so nothing was done" |
| `403 DENY_MEMBER_SUSPENDED` | The caller's own membership is suspended: "Your access to this workspace is paused" (same as the shell's access-paused screen; the remote does not decide it). In the SDK contract but missing from spec §9.2 |
| `403 DENY_UNRESOLVABLE_SUBJECT` | The caller is not an active member of this tenant: not-a-member screen (shell) |
| `401 DENY_MALFORMED_IDENTITY` | Sign in again (the SDK handles the redirect). The SDK contract says `401` only; spec §9.2 says `401/403` |
| Audit `429` | "Too many exports running" / wait |
| A page throws while rendering | The page's `MFEErrorBoundary` (only the page is replaced; the shell's sidebar still works) |
| The shell lacks a shared SDK subpath or its SDK or React is out of range | `get('./App')` or the singleton check fails; the shell's `RemoteBoundary` shows its error |

## 12. Build, Image, Configuration and Release

All inherited from `mfe-tender` §12, with these differences.

| Item | `mfe-admin` |
|---|---|
| Container, module, port | `admin`, `./App`, dev server port **5006** (web-shell's local manifest already uses 5002–5005) (`strictPort`, CORS `*`); web-shell's local manifest gets `"admin": { "entry": "http://localhost:5006/remoteEntry.js", "version": "local", "ownerDomain": "iam" }` and `remotes.allowedOrigins` gets the origin |
| Build | `tsc`, then Rsbuild with `pluginPlatform({ role: 'remote', name: 'admin', exposes: { './App': './src/app/App.tsx' } })`, then `config/remote-manifest-entry.mjs`. A Vite ES-module remote does **not** load through `loadRemote` |
| SDK | `SdkVersionPlugin` fails the build unless the installed SDK equals the preset's. **Never build against an SDK newer than web-shell's; upgrade the shell first** |
| Bundle budget | Enforced: `npm run budget` (`.github/scripts/bundle-budget.mjs`, CI step `Bundle budget` after the build), gzip -9, about 20% over the sizes of 2026-11-26: `remoteEntry.js` 10 KB (5.7 now), the remote's JS 95 KB (77.7), the standalone entry 210 KB (171.6), any file 85 KB (67.0), CSS 76 KB (63.4), images 100 KB (36.4). Raise a limit on purpose, with the reason in the CHANGELOG |
| Metrics | Tier 3 `iam_admin_*` through `getServiceMeter`; registry domain `iam`. The inventory and rules (implemented) and the SLO proposals are in [`docs/observability/metrics.md`](../observability/metrics.md); CI validates them in `test/unit/metrics`. Owner and registry confirmation still open (§15 #9) |
| Image | `nginxinc/nginx-unprivileged` on 8080, uid 101, digest-pinned, source maps removed, the same nginx SPA rule (only extension-less paths get `index.html`; `/api`, `/otel`, `/csp-report`, `/config`, `/remotes`, dotfiles and maps are 404) |
| Hosting until CloudFront | The ingress needs `/remotes/admin/` in addition to `/remotes/dashboard/` and `/remotes/tenders/` |
| Deploy | Copy the `admin` object from `remote-manifest-entry.json` into the environment manifest with an absolute `entry`, `ownerDomain: iam`, and `integrity`; deploy alongside a web-shell that has the `/admin/*` route, on the same platform packages |
| CI and release | `ci.yml`, `release.yml`, `changelog-check.yml` copied from `mfe-tender`; Dependabot ignores the three platform packages. Release as `mfe-dashboard` §12.5 (a `vX.Y.Z` tag): validate and test (95% and domain gates, build, lint, arch-lint, audit); `verify-release-tag` and `verify-changelog-entry`; image pushed **by digest only** with BuildKit provenance and SBOM, Trivy CRITICAL/HIGH, Cosign keyless sign and verify, and only then the `X.Y.Z`, `X.Y`, `X` and `latest` tags; GitHub Release with the `dist` tarball, `remote-manifest-entry.json`, checksums, provenance and SBOM. There is no deploy job |
| Runtime configuration | Nothing environment-specific is a build argument. The standalone page reads `/config/runtime.json` (the image's default has no `environment` and no `auth.signInUrl`: each deployment mounts its own; the page falls back to `local` in dev and `prod` built); one build serves every environment (as `mfe-dashboard` §12.4, ADR 0006 there). Build args: `BUILD_VERSION`, `SOURCE_DATE_EPOCH` |
| Contract test | web-shell's browser contract suite serves only a build named `dashboard` today. A real `admin` build needs its own spec and a server entry in web-shell's `test/browser/server.ts` |

## 13. Security

| Item | Handling |
|---|---|
| Tokens, identity headers | Never seen or set (inherited rules; lint) |
| Passwords, card data | Not handled here (A1 is a separate app) |
| HTML injection | No `dangerouslySetInnerHTML`; audit metadata and IdP group names are untrusted text, rendered escaped |
| CSP | No inline script or style, no `eval`, no third-party origin; fonts self-hosted |
| Anti-enumeration | Not applicable here (the workspace lookup is A2) |
| Approver and admin actions | Reset MFA requires fresh MFA (UI check plus gateway, IAM-FE-Q12) |
| Attribution | Actors are the signed-in user from the SDK, never typed text; IAM stamps the real identity server-side |
| Sensitive data on screen | Another user's phone number is omitted by the API unless the viewer is self or admin; this remote never requests more than the API returns |
| IdP secrets (E4) | Not handled until a tenant-facing route exists; the OIDC client secret must never be echoed back |
| Image | Digest-pinned bases, uid 101, read-only content, no source maps, Trivy, SBOM, provenance, Cosign; the shell pins `remoteEntry.js` by SRI |

## 14. Testing

Layout and stack as `mfe-tender` (Rstest with `@rstest/coverage-istanbul`, happy-dom 21 pinned through `overrides` because Rstest's peer range lists 20.x, Testing Library; `createTestPlatform`, `mockApi`, `mockProblem`). The gate is 95% on statements, branches, functions and lines, plus every `src/domain/` file above 90%.

| Suite | Covers |
|---|---|
| `test/unit/<area>` (`a11y`, `app`, `application`, `architecture`, `authz`, `domain`, `features`, `i18n`, `infrastructure`, `metrics`, `pages`, `sdk`) | Rules (both paths), the problem-to-outcome map, the mappers, `userBatcher` (de-duplication, 200-ID chunking, TTL), the use cases (one per port operation, forwarding arguments and signal), `planGroupMappings` byte limits; every screen (`pages/`, with a `*-design.test.tsx` beside each redesigned screen) and the access hints (`authz`); the layer, SDK-rule and catalogue checks (`layers.test.ts`, `dependency-rules.test.ts`, `catalog.test.ts`); `metrics` checks the inventory against the observability standard and [`docs/observability/metrics.md`](../observability/metrics.md); `app/dev-mock-iam.test.ts` checks the seeded dev workspace holds together |
| `test/integration` | The built `remoteEntry.js` through a shell share scope (inherited) |
| `test/e2e` | **Built.** The flows through the whole `App` against a fake IAM at the HTTP level (`test/fixtures/fakeIam.ts`: the six services, Swagger-shaped, with failures injected): invite with the seat limit (full, upgrade prompt, revoke, invite again, and a `409` after the form was opened), role change with last-owner refusal, remove and demotion with a `409` resolution and the automatic re-send, group mappings with the two-write partial failure and retry, a `202` settings sync polled to the end, a large audit search (`202`) becoming an export polled to ready, an export from the results, read-only mode on every screen that changes something, reset MFA with a stale and a fresh sign-in, and moving around the area as an owner and as a plain member |
| `test/contract` | Each adapter run through the real SDK client with a stubbed `fetch`, against a **vendored, SHA-256-pinned** copy of the six IAM Swagger files (`test/contract/swagger/PIN.json`; `npm run contracts:check` compares it with IAM's folder, `contracts:pin` re-pins). Every request must exist in the Swagger (method, path, declared query, a body that validates with no unknown field); every fixture must be a valid answer for its status; the mapped result is checked. Plus error answers (UPPER_SNAKE `errorCode`, `record_version` and workflow extensions, `503`, offline), `invitation_id` rather than `id`, the harness's own failures, and tripwires for the known Swagger gaps. `npm run test:contract` |
| `test/browser` | **Built, Chromium only.** The production standalone page under the image's CSP: it loads with no CSP violation and no failed request, reads `/config/runtime.json`, serves `remoteEntry.js`, reloads a nested route and redirects an unknown path, passes WCAG 2.1 A and AA **with colour contrast** in the light and dark themes, and does not scroll sideways at 360 px. With no shell there is no identity, so every section is "not permitted"; the screens behind a session are covered by `test/e2e` and `test/unit/a11y` (jsdom). Firefox and WebKit are not run |
| `test/unit/a11y` | **Built.** axe-core (WCAG 2.1 A, AA and best practice; contrast excluded, it needs layout) over every screen and dialog in the states a user can be in: the page, a dialog open on it, a refusal or an error showing, an empty list, a locked read-only view, a "not permitted" view. It found, and this release fixed, empty table headers on the actions columns, two fields with the same accessible name, and a "not permitted" page with no level-one heading |
| `test/smoke` | GET-only suite (`npm run test:smoke`, `test/smoke/README.md`), modelled on web-shell's, against `SMOKE_BASE_URL`: the image (CI `smoke` job, after `smoke-tests.sh`'s size, `/healthz` and container-global checks) or, in `live` mode, a deployment. The document and SPA rule, immutable hashed assets, no source maps, `remoteEntry.js` (container global, `./App`, SDK from the shell, revalidated, CORS, chunks), the manifest entry's integrity, `runtime.json` validated by the SDK, nginx's exact 404s, headers, gzip; live: the platform security headers and the per-environment deploy check |

`npm run arch-lint` checks the layer rules in CI as well as in the unit suite.

## 15. Open Items

| # | Item | Owner |
|---|---|---|
| 1 | ~~Server state.~~ **Resolved 2026-11-25:** TanStack Query, recorded in [ADR 0001](../adr/0001-server-state-with-tanstack-query.md) | Architecture Review, mfe-admin |
| 2 | ~~App chrome.~~ **Resolved 2026-11-26 (option A):** web-shell draws the one frame (`AppHeader`: remote links, **Admin** for `manage:members`, user menu with My account, Switch workspace and Sign out; flag `shell.frame`). Its sidebar also draws the Admin sub-menu (Users, Departments, Group mappings, Settings, Audit log, each by permission). This remote ships the page outlet only (`AdminLayout`) and draws no header, navigation, user menu, theme picker or sign-out. mfe-dashboard and mfe-tender still draw their own frames until they migrate (web-shell §15 #23). See [app-chrome-handoff.md](app-chrome-handoff.md) | web-shell, mfe-dashboard, mfe-tender |
| 3 | ~~E2a step 1.~~ **Resolved by scope acceptance 2026-11-25:** this release ships step 2 only (IAM's `409` path), and the dialog says the workflow impact check is not available. Step 1 stays out until the Workflow service provides `GET /workflows/active-by-user` and per-row reassign and pause routes (IAM-FE-Q6). Future backend work; no date | Workflow |
| 4 | ~~E4 SSO.~~ **Resolved by scope acceptance 2026-11-25:** wireframe only. No production-ready SSO is committed in this milestone. Building it needs a tenant-facing IdP route (IAM-FE-Q7) first. Future backend work; no date | Org & Membership, Realm Provisioner |
| 5 | ~~Shared IAM components.~~ **Resolved 2026-11-25:** because IAM is split, the shared identity components (those used by two or more remotes: user chip, department label, member picker, and any other that gains a second consumer) are extracted into a **common package before implementation**; this remote keeps no copy. Package name, home and owner, and whether it shares a cache, are still to be set (the package shares code, not the Query cache). **Not published yet (2026-11-26: no package exists), so this remote builds its own interim copies (user chip, department label, member picker; ADR 0003) behind the same ports, and replaces them when the package ships.** See [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §2 | Frontend platform |
| 6 | ~~Two routers, one URL.~~ **Resolved 2026-11-25:** the shell owns top-level routing, and cross-remote navigation goes through shell-managed routes with SDK `navigate()`, not full-page loads (no shared `react-router-dom` singleton). Confirmed and fixed in web-shell `0.5.0`: a `navigate()` into the remote already showing remounts it, so its own router follows the URL. See [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §3 | web-shell, platform-reactcommon |
| 7 | ~~Permission key shape.~~ **Resolved 2026-11-25:** web-shell uses `manage:admin-roles`; spec §4.3 should be updated to match | IAM spec |
| 8 | **IAM questions that change screens:** IAM-FE-Q3 (seat grace date), Q4 (MFA and last-login columns), Q5 (member search and filters), Q9 (admin list of delegations, for the E2 header), Q12 (gateway-enforced step-up on reset MFA), Q14 (who may grant `tenant_admin`; the UI follows the HLD) | IAM |
| 9 | **Observability.** The `iam_admin_*` inventory and rules are implemented (and checked by `test/unit/metrics`); the SLO and alert proposals are written ([`docs/observability/metrics.md`](../observability/metrics.md), proposed; label values are fixed when the code is written). **Checked 2026-11-25 against the SDK's `metric-registry.json` and `registry-vocab.json`:** `iam` is a registry domain, `admin` matches the service pattern, and no registry metric is named `iam_admin_*` or overlaps (the eight existing `iam_*` Tier 2 entries are server-side: auth events, tenant resolution, identity sync, realm operations, RLS, session revoke, lifecycle events). Left: whether to use the registered `operation` label instead of the custom `action` and `resource` labels; an owner for the recording rules, alerts, SLOs and dashboard in the platform's Prometheus/Grafana; source maps are removed, not uploaded for symbolication | mfe-admin, platform observability |
| 10 | **Contract suite.** Add an `admin` spec and server entry to web-shell's browser tests; no test yet loads a real remote other than `dashboard` inside the real shell. **Progress 2026-11-25:** this repo's own browser suite (Chromium, the standalone page) and the whole-app e2e against a fake IAM are built; what is left is the joint test through a real web-shell, which needs web-shell's `/admin/*` route first | web-shell, mfe-admin |
| 11 | **Theme and CSS ownership** when embedded (Tailwind and daisyUI shipped by each remote; same open question as `mfe-tender` #7) | web-shell, platform |
| 12 | **Realm gaps shown to users** (IAM-FE-Q13: G-5 password policy, G-6 local accounts, G-13 invitation acceptance). E1a and E6 copy must change when they close. Until G-13 is fixed, a user may sign in and still show as pending | Realm Provisioner, Event Consumer |
| 13 | **Local development against IAM.** Agree whether dev uses the shell's `config/dev-platform.mjs` stand-ins, recorded fixtures, or a shared IAM dev environment, and who maintains the stub | mfe-admin, IAM |
| 14 | ~~Remote name and split.~~ **Resolved 2026-11-25:** separate remotes, one per audience (`admin`, `me`), not one `mfe-iam`. Matches the target architecture and avoids a later remote-boundary refactor. Recorded in §2.3 and §4.1 | Frontend platform |
| 15 | ~~Session-context refresh.~~ **Resolved 2026-11-26:** SDK `1.0.0-alpha.10` has `useRefreshSessionContext()` and web-shell `0.5.0` passes `refreshContext` and also reloads P-35 on focus (at most once a minute). `useSessionRefresh` calls the hook after a successful change to the caller's own roles (P-28) and on `403 DENY_ROLE_INSUFFICIENT`; calls are shared and never throw, and a failed refresh keeps the old hints. Open with IAM: whether P-35 can lag a role change (handoff §6); a refresh that still shows old roles is not retried in a loop. See [session-context-refresh-handoff.md](session-context-refresh-handoff.md) | IAM (cache lag) |
| 16 | **Repository setup** (as `mfe-dashboard` #18, #19): the GitHub repository exists; set the branch rules (not verified from here). Make `Validate / Test / test`, `Validate / Quality / quality` (which runs the architecture lint step), `Browser (Playwright, axe)`, `Smoke tests` and `changelog` required checks, create the Dependabot secret `PACKAGES_READ_TOKEN`, and note that `ci.yml` uses `paths-ignore` on the markdown files for some triggers: a required check must not be skipped by it (a Markdown-only PR could not satisfy it). `package.json` `version` is not checked against the release tag | repository admins, mfe-admin |
| 17 | **Constitution follow-ups** (as `mfe-dashboard` #17): `ARCHITECTURE.md`, the constitution assessment and the contract tests are done (`docs/architecture/`, `test/contract`); still open: axe on the daisyUI themes; `platform-design-system` components when published (also the shared-package question, #5) | mfe-admin, platform |
| 18 | **SDK `ApiClient` limits** found by the adapters: a `:name` after a non-slash (`/users:batch`) is read as a path parameter (sent as `users%3Abatch`, unproven through the gateway), and a query value cannot be repeated (`entry_type`, so an audit search takes one). Asks and a gateway check in [sdk-api-client-handoff.md](sdk-api-client-handoff.md) | platform-reactcommon, IAM, platform deployment |
| 19 | **Audit entry-type taxonomy.** Spec E7 says to load the list of entry types from `iam-audit-log/api/taxonomy.json` at build time. That file is not in the workspace, so the entry-type filter is a text box (an exact type, one at a time) and results are grouped by family. With the file, the filter becomes a picker and a catalogue test can check it against the file | Audit Log, mfe-admin |
