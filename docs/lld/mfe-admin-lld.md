# mfe-admin — Low-Level Design

## Tender Management SaaS Platform — Administration Remote (`admin`)

| | |
|---|---|
| Repository | `BCBP-SOLUTIONS-FZC-LLC/mfe-admin` (proposed; **not created yet**) |
| Status | **Baseline for signoff (conditional, see Signoff conditions).** No code exists. This document is written from the IAM screen spec and the structure and rules of the sibling remote `mfe-tender`, not from running code. Where it says "inherited", the rule comes from `mfe-tender`'s LLD or web-shell's; where it says "proposed", it is a decision for review (§15) |
| Version | `0.1.4`, 25 November 2026 (first draft `0.1`, 24 November). First release target: none set |
| Host | `web-shell`, mounting this remote at `/t/<slug>/admin/*` with `RemoteBoundary remote="admin"`, no props, `ownerDomain: iam`. **web-shell has no admin route yet** (checked 2026-11-25: `main` after `v0.4.0` mounts `dashboard`, `tenders`, `drafting`, `workflows`; the IAM role-map keys, A6/A8, banners and the read-only notice are in); see [web-shell-iam-handoff.md](web-shell-iam-handoff.md) |
| Platform SDK | `@bcbp-solutions-fzc-llc/frontend-sdk` `1.0.0-alpha.9` (peer `^1.0.0-alpha.9`, provided by the shell, whose `main` is on alpha.9); `webpack-preset` and `eslint-plugin` `1.0.0-alpha.9`. Never newer than web-shell's |
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
| 0.1.4 | 2026-11-25 | #3 and #4 resolved by scope acceptance: E2a step 2 only, E4 wireframe only. Updated §1, §2.1, §7.4, §15 |
| 0.1.3 | 2026-11-25 | #5 resolved (shared identity components in a common package) and #6 resolved (shell-managed navigation). Corrected §4.4: SDK `navigate()` is not a full page load. Added `/nav` to §4.2 |

### Signoff conditions

Signoff accepts this document as the design baseline. It does not close every open item in §15. Conditions:

1. **Scope:** E1, E2, E3, E5, E6, E7 and E2a step 2 only. E4 is wireframe only; E2a step 1 is out (§15 #3, #4).
2. **Prerequisite to first release, session-context refresh (§15 #15):** the SDK has no refresh; needs a hook in `platform-reactcommon` and a shell callback ([handoff](session-context-refresh-handoff.md)).
3. **Prerequisite to building screens that show people, shared identity package (§15 #5):** name, home and owner decided and a first alpha published ([handoff](shared-components-and-navigation-handoff.md)).
4. **Shell navigation:** web-shell confirms or fixes shell-driven moves inside an already-mounted remote, and adds the `/admin/*` and `/me/*` routes (same handoff, §3.3).
5. **App chrome owner is unassigned (§15 #2):** until decided, nothing links to `/admin`; first release needs at least the interim link list ([handoff](app-chrome-handoff.md)).
6. **Before the affected screens are built:** IAM answers the §15 #8 questions. Items #9–#13 are tracked build-time work.
7. SDK findings were checked against the installed `alpha.6` copy, not the pinned `alpha.9`; recheck before the platform team acts.

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
| E1 Users and invitations | Member list, seat meter, pending invitations | `users` | Built |
| E1a Invite user (dialog) | Create an invitation | n/a | Built |
| E2 User detail | Roles, departments, suspend, remove, reset MFA | `users/:userId` | Built |
| E2a Impact review (dialog) | Gate before remove or demote | n/a | **This release: step 2 only** (IAM 409 path, Built). Step 1 (Workflow impact review) is **out of scope**, no backend route (IAM-FE-Q6) |
| E3 Departments and role labels | Activate departments, rename level labels | `departments` | Built |
| E4 Single sign-on | IdP configuration | `sso` | **Wireframe only this release** (scope accepted): no tenant-facing IdP route (IAM-FE-Q7). No route, no nav entry, no calls, no production SSO commitment |
| E5 Group mappings | IdP group → department, level, role | `group-mappings` | Built |
| E6 Tenant settings | Workspace block (owner), delegation policy (admin) | `settings` | Built |
| E7 Audit log | Search, detail, exports | `audit`, `audit/exports` | Built |
| Section chrome | Left nav for the admin area, per-section gating, read-only wrapper | `app/layouts` | n/a |
| The `admin` message catalogue and Tier 3 metrics (`iam_admin_*`) | | `infrastructure/` | n/a |

### 2.2 Out of scope (owned elsewhere)

| Concern | Owner |
|---|---|
| Sign-in, MFA enrolment, tokens, session, sign-out, workspace switch | SDK `/auth` in web-shell (Keycloak) |
| App chrome: global header, user menu, admin entry point, workspace switcher | Unassigned; the shell or platform layer once decided (§15 #2, [app-chrome-handoff.md](app-chrome-handoff.md)). This remote ships only its own section nav |
| Whether an action is allowed | IAM and the gateway (AuthZ Enrichment). This remote only hides what the user cannot do |
| Role → UI permission map | web-shell `src/domain/rules/permissions.ts` (the eight permissions in spec §4.3) |
| P-35 (session context: roles, plan, flags) | web-shell owns the port and the call. This remote has no `P-35` adapter and reads the result through `useSessionContext`. How it asks for a refresh is open (§15 #15) |
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
- Links between `/admin` and `/me` are cross-remote full navigations (§15 #6).
- Release, SRI, kill switch and manifest entry are per remote.

## 3. Architecture and Source Layout

The constitution's layers, as in `mfe-tender` (inherited), with one change: the port is split per service, because this remote talks to several.

```
src/
├── App.tsx                           federation expose ./App: re-exports app/routes (default App, workspaceBasename)
├── app/                              composition root (may import every layer)
│   ├── routes/index.tsx              routes, basename, AdminServicesProvider
│   ├── providers/composition.ts      the HTTP adapters and the metrics telemetry (the only wiring point)
│   ├── bootstrap/                    main.tsx (standalone entry), standalone.ts, remote.ts (empty entry)
│   └── layouts/                      AdminLayout (section nav, per-page MFEErrorBoundary, read-only wrapper)
├── presentation/
│   ├── pages/                        UsersPage, UserDetailPage, DepartmentsPage, SsoPage, GroupMappingsPage,
│   │                                 SettingsPage, AuditPage, AuditExportsPage
│   ├── components/                   ui.tsx (controls, LoadFailed), SeatMeter, RoleBadge, ConflictDialog,
│   │                                 ResolutionDialog, ProblemDetails ("Copy details" with traceId)
│   └── features/                     services.tsx (provider and hooks), useMembers, useAuditSearch, useStepUpAction, ...
├── application/                      use cases, no React, browser or SDK runtime
│   ├── queries/                      listMembers (P-4 joined with users:batch), getMember, seatUsage, searchAudit, ...
│   ├── commands/                     inviteMember, changeRoles, suspendMember, removeMember, resolveRemoval,
│   │                                 saveGroupMappings, saveTenantSettings, ...
│   └── use-cases/                    the barrel pages import
├── domain/                           pure TypeScript
│   ├── entities/                     Member, Invitation, SeatUsage, TenantDepartment, CatalogDepartment, RoleLabel,
│   │                                 GroupMapping*, TenantSettings, DelegationPolicy, AuditEntry, AuditExport, ImpactItem
│   ├── value-objects/                RecordVersion, Cursor, AuditFilter
│   ├── rules/admin-rules.ts          plan* (§6.3)
│   ├── events/admin-events.ts        ADMIN_ACTIONS, ACTION_OUTCOMES, STEP_UP_ACTIONS, LOAD_RESOURCES, AdminTelemetry
│   └── repositories/                 OrgMembershipPort, UserProfilePort, CatalogPort, GroupMappingPort, AuditPort,
│                                     DelegationPolicyPort, WorkflowImpactPort (Proposed)
├── infrastructure/
│   ├── api/                          one HTTP adapter per port, on the SDK's ApiClient with route templates;
│   │                                 problem.ts (errorCode → outcome); userBatcher.ts (§7.2)
│   ├── telemetry/metrics.ts          Tier 3 instruments and the AdminTelemetry adapter
│   └── configuration/                messages.ts, locales/en.json, locales/en/<screen>.json
├── shared/                           constants (APP_ID = 'admin'), utilities (dates, utf8Bytes), hooks (useDraft, useDismiss)
└── assets/
```

The architecture lint (`.dependency-cruiser.cjs`) is carried over from `mfe-tender` with the same 13 components and rules: no SDK storage, metrics or config in `presentation/`, no cycles, nothing from `test/`. A new folder joins a component in the same PR.

**Server state (decided, [ADR 0001](../adr/0001-server-state-with-tanstack-query.md)).** TanStack Query owns server state: queries, mutations and invalidation, with keys that include the workspace slug and one `QueryClient` per mount. HTTP still goes through the SDK `ApiClient` (§5). Only `features/` hooks and `app/` import TanStack Query; ports and rules do not. The `useApi` plus keyed-cache option was rejected as a duplicate of what TanStack Query provides.

## 4. Runtime Contract with the Shell

This is the SemVer surface. Same model as `mfe-tender` §4 (inherited).

### 4.1 Container

| Item | Value |
|---|---|
| Container name / global | `admin`, defined by `remoteEntry.js` as `var __platform_mfe_admin` (the preset's `containerName('admin')`) |
| Exposed module | `./App` → `src/App.tsx` (re-exports `src/app/routes/index.tsx`: default `App`, named `workspaceBasename`) |
| Chunk loading | Relative to `remoteEntry.js`; every lazy chunk pinned by sha384 inside `remoteEntry.js` |
| Images and fonts | Imported from `src/`, never root-relative (inside web-shell `/image/…` resolves on the shell's origin) |
| Split chunks | Async only; a split entry makes the container global a Promise, which `loadRemote` refuses |
| Manifest entry | `"admin": { "entry": ".../remoteEntry.js", "version", "ownerDomain": "iam", "integrity": "sha384-…" }`, written by `config/remote-manifest-entry.mjs` at build. `ownerDomain` must be `iam` (a registry domain) or the SDK drops the entry or refuses the metrics |
| Name rule | `^[a-z][a-z0-9_-]{0,62}$`, not `shell` |
| Remote split | This remote owns only `admin` (E1–E7). The member self-service screens are the separate `me` remote (§2.3). The container is not renamed to `mfe-iam`, and `ownerDomain` stays `iam` for both |

### 4.2 Shared modules

`sharedFor('remote')` offers React, React DOM, `@opentelemetry/api` and every SDK subpath as strict singletons (`import: false` for the SDK, never bundled). Subpaths used here: `/auth`, `/config`, `/http` (see §5), `/i18n`, `/logging`, `/metrics`, `/nav`, `/problem`, `/react`, `/storage`. `react-router-dom` is **not** shared. The integration test `remote-entry.test.tsx` from `mfe-tender` is carried over (share keys, no SDK in the bundle, CSS integrity, assets from the remote's public path, nothing environment-specific compiled in).

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
| E4 | `sso` | `/t/:slug/admin/sso` |
| E5 | `group-mappings` | `/t/:slug/admin/group-mappings` |
| E6 | `settings` | `/t/:slug/admin/settings` |
| E7 | `audit`, `audit/exports` | `/t/:slug/admin/audit[/exports]` |

Each page registers its template with `useRouteTemplate`. A user visiting a section they cannot use sees a "not permitted" page, not a redirect.

**Migration from `mfe-dashboard`.** User management exists today at `/t/:slug/dashboard/user-management`, on fixtures (IAM-FE-Q10). When E1 ships here, `mfe-dashboard` keeps a redirect to `/admin/users` for one release. That redirect uses the SDK `/nav` `navigate('admin', '/t/<slug>/admin/users', { replace: true })`, which goes through the shell's router (no page load) for a same-workspace path, not an in-router `Navigate` from the dashboard's own router. Cross-remote rules and a same-remote gap to confirm: [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §3.

## 5. Platform SDK Usage

The rule is inherited: anything the SDK provides is used from the SDK through public subpaths only; lint and the `no-sdk-duplicates` test enforce it.

| Concern | SDK API | Used in |
|---|---|---|
| Signed-in user, sign-out | `useCurrentUser`, `useSignOut` (`/react`) | routes, `useActor` |
| Session context (roles, plan, flags, read-only, MFA window) | `useSessionContext`, `useReadOnly`, `useFeatureFlag` | layouts, `useAdminAccess` |
| Permissions | `Can`, `useHasPermission` | `useAdminAccess` (see §15 #7) |
| Step-up MFA | `useStepUp` → `{ needed, reauthenticate() }` | reset MFA (E2), any action the gateway guards |
| API calls | `useApiClient()` or `createApiClient({ mfe: 'admin' })` with route templates (`/tenants/:id/members`), wrapped by TanStack Query hooks in `features/*` (ADR 0001) | `infrastructure/api/*`, `features/*` |
| API errors | `isProblemError` (`/problem`), `problemMessage` (`/i18n`) | `infrastructure/api/problem.ts`, `LoadFailed` |
| Route naming | `useRouteTemplate` | every page |
| Logs, metrics | `getLogger({ mfe: 'admin' })`, `getServiceMeter({ mfe: 'admin' })` | telemetry adapter |
| Messages, dates, numbers | `registerNamespace('admin', …)`, `useT('admin')`, `formatDate`, `formatNumber`, `useLocale` | components |
| Per-app storage, redirect hook | `storage('admin')`, `useBeforeAuthRedirect` (via `useDraft`) | drafts only (§10) |
| Navigation | `navigate()` from `/nav` | links to other remotes |
| Render errors | `MFEErrorBoundary` (`mfe="admin"`) per page, `resetKeys` = path | `AdminLayout` |
| Tests | `createTestPlatform`, `mockApi`, `mockProblem` / `parseProblemResponse` | `test/fixtures` |

**Identity is never sent by this remote** (IAM-UX-1). The gateway strips and re-injects `x-user-id`, `x-tenant-id` and `x-tenant-roles`; lint rule `no-identity-headers` enforces it. The tenant ID in a path comes from `useSessionContext().tenantId` and must equal the token's, or the call is `403`.

**Own helpers** (no SDK counterpart): `utf8Bytes` (group names are limited to 255 *bytes*), `newIdempotencyKey` (reserved for `mfe-me`; not used here), `userBatcher` (§7.2), the problem-to-outcome map (§11).

## 6. Domain Model

### 6.1 Types (`src/domain/entities`)

| Type | Fields / values |
|---|---|
| `Member` | `userId`, `status` (`active`/`suspended`), `tenantRoles[]` (`member` is implicit, never stored), `departments[{ departmentId, level }]`, `recordVersion`. Joined with a profile (name, email, job title, avatar, `source` `local`/`federated`, availability, profile `status`) from User Profile. Level codes `preparator`/`reviewer`/`approver` |
| `Invitation` | `invitationId` (not the older `id` alias), `email`, `fullName`, `initialRoles[]`, `invitedBy`, `sentAt`, `expiresAt`, `recordVersion`. Only `pending` is listed |
| `SeatUsage` | `activeUsers`, `pendingInvitations`, `licensedSeats`. `used = active + pending`; `over = active > licensed`. No grace date from the API (IAM-FE-Q3) |
| `TenantDepartment` | `departmentId` (UUID), `isActive`, `isSystem`, `recordVersion`, member count (from P-9). Names come from the catalogue |
| `RoleLabel` | `roleCode` (`preparator`/`reviewer`/`approver`), `displayName`, `recordVersion` |
| `GroupMapping` | Three lists, each full replacement: `{ keycloakGroupName, departmentId }`, `{ keycloakGroupName, roleCode: level }`, `{ keycloakGroupName, roleCode: tenant role }` |
| `TenantSettings` | `name`, `defaultLocale`, `mfaFreshnessSeconds` (60–900), `localAccountsEnabled`, `residencyMode` (`standard`/`strict`), `recordVersion`, plus read-only `status`, `plan`, `realmSyncPending` |
| `DelegationPolicy` | `maxDurationDays`, `reviewWindowDays`, each 1–180 |
| `AuditEntry` | `id`, `at` (UTC instant), `actor` (`type`: `user`/`service_account`/`iam_system`/`anonymous`, display name), `action`, `entryType`, `target`, `sourceService`, `ip`, `traceId`, metadata |
| `AuditExport` | `id`, `status` (`pending`/`running`/`ready`/`failed`/`expired`), failure reason, download URL (re-issued on each poll), 7-day retention |
| `ImpactItem` | Tender, stage, department, level, deadline, last action (E2a step 1, Proposed) |

Three axes are kept apart (spec §2.1): tenant roles (closed set `tenant_owner`, `tenant_admin`, `tender_admin`; `member` implicit), department levels (never in `roles`), and plan (features and limits, never permissions). Times are UTC on the wire and rendered in the profile timezone (IAM-UX-14).

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
| `WorkflowImpactPort` (Proposed; **not implemented this release**) | `GET /workflows/active-by-user` and the per-row reassign / pause routes |

### 6.3 Rules (`domain/rules/admin-rules.ts`)

Pure functions returning `{ ok: true, … }` or `{ ok: false, failure }`. Today and now are inputs. They enforce only what the UI knows; every one is **re-checked by the service**, and the UI never grants more than IAM does.

| Rule | Refuses | Accepts with |
|---|---|---|
| `planInvitation({ email, fullName, roles, departments, seats, actorIsOwner })` | `email-invalid` (>254), `name-required` / `name-too-long` (>200), `seats-full` (`used ≥ licensed`), `role-not-offered` (`tenant_owner`/`tenant_admin` offered to owners only, IAM-FE-Q14), `department-inactive` | The P-6 body |
| `planRoleChange({ current, next, actorIsOwner, ownerCount })` | `last-owner` (IAM-UX-7), `role-not-offered`, `member-role` | The full role list for P-28 (full replacement) |
| `planSuspension`, `planReactivation` | `last-owner` | The P-7 body with `recordVersion` |
| `planDepartmentAssignment`, `planDepartmentRemoval` | `department-inactive`; a demotion or removal is flagged `needsImpactReview` | The P-10 / P-11 call |
| `planRemoval` | — | The P-8 call, flagged `needsImpactReview` |
| `planResolution({ action, replacementUserId })` | `replacement-required` for `replace_delegate` | The P-26 body |
| `planGroupMappings(lists)` | `group-required`, `group-too-long` (>255 bytes), `duplicate-group`, `role-not-allowed` (`member`), `owner-mapping-owner-only` | The full lists to write |
| `planTenantSettings(draft, actorIsOwner)` | `not-owner`, `mfa-window-out-of-range` (60–900), `name-required`, `locale-invalid` | The P-2 body with `recordVersion` |
| `planDelegationPolicy` | `days-out-of-range` (1–180) | The DLG-7 body |
| `planAuditQuery(filter, window)` | `range-inverted`, `page-too-large` (>1000) | The query; reports `windowClamped` / `effectiveFrom` from the response |

`test/unit/domain/rule-paths.test.ts` pins each rule both ways (inherited practice). Coverage gate: every `src/domain/` file above 95%.

### 6.4 Load states

Each loader returns `loading`, `failed`, `error`, `reload` (inherited from `useTenderData`). A load calls `telemetry.loadStarted(resource)` and finishes once with `success` or `error`.

| Load result | Handling |
|---|---|
| SDK `ApiError` | Logged once at `warn`; the page shows `LoadFailed` with `problemMessage` and Retry, and "Copy details" with `traceId` |
| Any other throw | Reaches the page's `MFEErrorBoundary` |

## 7. Key Flows

### 7.1 Mount inside web-shell

1. The shell resolves `admin` from its manifest; `loadRemote` injects `remoteEntry.js` (SRI), runs `init(shareScope)` and `get('./App')`, and renders inside `RemoteBoundary` at `/t/:slug/admin/*`.
2. Importing the routes module registers the `admin` catalogue and CSS.
3. `App` mounts its own `BrowserRouter` with `workspaceBasename(location.pathname)`.
4. Nothing here initialises the SDK, loads `runtime.json`, starts telemetry or signs in.
5. Standalone mode (the image's `/`) follows `mfe-tender` §7.2 and is anonymous: every call returns `401`, so it exists only for development and smoke tests.

### 7.2 E1 member list (IAM-UX-4)

1. `GET /tenants/:id/members?limit=50&cursor=` (P-4) returns IDs only: status, roles, departments, `record_version`.
2. The page collects the page's user IDs and calls `POST /users:batch` once (≤ 200 IDs; 50 per page). `userBatcher` de-duplicates and chunks the IDs; results are stored per user ID in the Query cache (`staleTime` about 60 seconds (matching the service cache)), so the pending-invitations tab, E2 and pickers do not refetch.
3. Rows are joined. `missing[]` → "Unknown user". A `users:batch` failure renders the rows with "Name unavailable"; rows are never hidden.
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

1. P-3 (tenant departments) and `GET /departments` (catalogue) side by side; Activate = P-24; Deactivate / Reactivate = P-25 with `record_version`.
2. Hide the retire action when `isSystem` (`422 SYSTEM_DEPARTMENT_CANNOT_BE_RETIRED` otherwise).
3. Member counts come from P-9 (one call per department; load lazily).
4. Role labels: three rows, P-13 with `record_version`. The code never changes; only `displayName` does.
5. Catalogue activation may lag up to 10 minutes (spec §8).

### 7.8 E5 group mappings (IAM-UX-10)

1. Three full-replacement lists. Recommended layout: one table "IdP group → department + level" (writes `/departments` **and** `/department-roles`) and one "IdP group → tenant role".
2. Saving the first table makes **two** writes. If the second fails, show which part saved and offer Retry for the remainder; do not claim success.
3. Send the whole list; an omitted row is deleted.
4. Mappings are **additive only** and apply at the user's *next SSO sign-in* (2-minute service cache). The screen says both.
5. Errors: `409 MAPPING_CONFLICT`, `422 DEPARTMENT_NOT_IN_CATALOG`, `403 ROLE_ASSIGNMENT_FORBIDDEN` ("Only an owner can change owner mappings"), `400 INVALID_ROLE`.

### 7.9 E6 settings

1. Workspace block (owner only): P-2 with `record_version`. A `200` is final. A `202` means the realm part is still applying: show "Saving to sign-in settings…", poll P-1 until `realm_sync_pending` clears (retry cadence is the service's, about 10 minutes).
2. "Local accounts" carries the note that enforcement at login is not live yet (IAM gap G-6).
3. `residency_mode: strict` warns that AI drafting may be unavailable.
4. Delegation-policy block (admin or owner): DLG-6 to read, DLG-7 to write.

### 7.10 E7 audit

1. Filters: time range, entry type (loaded from `iam-audit-log/api/taxonomy.json` at build time), actor, actor type, target type and ID, source service, retention tier.
2. Keyset cursor, page size 100 (server max 1000). Filters live in the URL search string so a result is shareable.
3. A response with `window_clamped: true` shows "Showing from {effective_from} — your plan's audit window".
4. A **`202`** from search means the query is too large: switch to the export tracker ("This search is large, so we're preparing it as a file").
5. Exports: AL-3 to start, AL-4 to poll (`pending → running → ready | failed | expired`). The download URL is fresh on each poll; the file stays retrievable for 7 days. `429` → "Too many exports running".
6. Display rules: service account → "Automation", `iam_system` → "System".

### 7.11 Read-only and failing closed

When `useReadOnly()` is true every mutation is disabled with "Workspace is read-only (subscription ended)" (spec §7.10); a `DENY_TENANT_READ_ONLY` after the fact does the same. A `503 …_UNAVAILABLE` on invite, removal, reset MFA or settings means nothing changed, and the UI never shows success (IAM-UX-5).

### 7.12 Sign-out

Sign-out is the SDK's `useSignOut()`. This remote draws no user menu, so sign-out is called only where a screen needs it (for example after a session-ending action). A global sign-out control belongs to the app chrome, which this remote does not own (§15 #2).

## 8. Authorization (UI hints)

All checks here are hints. IAM and the gateway decide; a stale hint is corrected by `403` handling and a session-context refresh (P-35, owned by the shell, §15 #15) (IAM-UX-2: roles are not in the token; refresh on `403` and on focus after about 60 seconds).

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

Role names never appear in this repo. These eight keys are in web-shell's role map (`manage:admin-roles` replaces the spec's `manage:roles:admin`, which the SDK's `roleMapAuthorizer` rejects); this remote only asks `useHasPermission`. The service account is never a member and never appears here.

## 9. i18n

Namespace `admin` (`APP_ID`), inherited layout: chrome in `locales/en.json`, each screen in `locales/en/<screen>.json` with keys prefixed by the screen. Stored codes (`tenant_admin`, `preparator`, `pending`, `ooo`, audit entry types) stay in English on the wire and are translated for display. Audit entry-type families get plain-word labels (`auth.*` → "Sign-in", `membership.*` → "Membership", and so on). Department level labels are the **tenant's** (P-12), not the catalogue's. Never show a server's `detail` text as the main message; use `problemMessage` and the table in §11.

The `catalog.test.ts` and `admin-text.test.ts` equivalents of `mfe-tender` apply (missing or unused key; hard-coded text).

## 10. State and Storage

| State | Where | Lifetime |
|---|---|---|
| Server data (members, invitations, departments, settings, audit) | TanStack Query cache (ADR 0001) | Per mount; user profiles about 60 s; catalogue per session; invalidated by the remote's own writes |
| Audit filters | URL search string | The URL |
| Unsent dialog text | `useDraft` → SDK session storage, only just before an SDK redirect (step-up) | Removed once restored |
| Section nav state, open dialogs, selection | React state | The mount |

No tokens, no user data and no permissions are stored. This remote keeps **nothing in local storage** by default (`storage('admin')` is reserved for a future theme or table preference). Raw browser storage is rejected by lint.

## 11. Failure Handling

Rendering rules (spec §9, inherited from IAM): every error body is RFC 9457 `application/problem+json`; `errorCode` is UPPER_SNAKE (compare case-insensitively); show `traceId` behind "Copy details" on every error. Retry only `429` (honour `Retry-After`) and `503`, and only for idempotent calls. Never retry `409` or `422`.

| Failure | Behaviour |
|---|---|
| Rule refuses | Catalogue message; `actions_total{outcome="failure"}`; nothing sent |
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
| `403 DENY_ROLE_INSUFFICIENT` | "You don't have permission to do this", then refresh the session context (§15 #15) |
| `403 DENY_TENANT_READ_ONLY` | Read-only mode |
| `403 DENY_MFA_STALE` | Step-up, then retry once |
| `503 DENY_SERVICE_UNAVAILABLE` | "We couldn't check your access, so nothing was done" |
| `401` / `DENY_MALFORMED_IDENTITY` | Sign in again (the SDK handles the redirect) |
| Audit `429` | "Too many exports running" / wait |
| A page throws while rendering | The page's `MFEErrorBoundary` (only the page is replaced; the section nav still works) |
| The shell lacks a shared SDK subpath or its SDK or React is out of range | `get('./App')` or the singleton check fails; the shell's `RemoteBoundary` shows its error |

## 12. Build, Image, Configuration and Release

All inherited from `mfe-tender` §12, with these differences.

| Item | `mfe-admin` |
|---|---|
| Container, module, port | `admin`, `./App`, dev server port **5006** (web-shell's local manifest already uses 5002–5005) (`strictPort`, CORS `*`); web-shell's local manifest gets `"admin": { "entry": "http://localhost:5006/remoteEntry.js", "version": "local", "ownerDomain": "iam" }` and `remotes.allowedOrigins` gets the origin |
| Build | `tsc`, then Rsbuild with `pluginPlatform({ role: 'remote', name: 'admin', exposes: { './App': './src/App.tsx' } })`, then `config/remote-manifest-entry.mjs`. A Vite ES-module remote does **not** load through `loadRemote` |
| SDK | `SdkVersionPlugin` fails the build unless the installed SDK equals the preset's. **Never build against an SDK newer than web-shell's; upgrade the shell first** |
| Bundle budget | Start from `mfe-tender`'s (entry 230 KB, total 270 KB, largest 85 KB gzip) and re-measure after E7 |
| Metrics | Tier 3 `iam_admin_*` through `getServiceMeter`; registry domain `iam`. The observability inventory and SLOs must be written before release (§15 #9) |
| Image | `nginxinc/nginx-unprivileged` on 8080, uid 101, digest-pinned, source maps removed, the same nginx SPA rule (only extension-less paths get `index.html`; `/api`, `/otel`, `/csp-report`, `/config`, `/remotes`, dotfiles and maps are 404) |
| Hosting until CloudFront | The ingress needs `/remotes/admin/` in addition to `/remotes/dashboard/` and `/remotes/tenders/` |
| Deploy | Copy the `admin` object from `remote-manifest-entry.json` into the environment manifest with an absolute `entry`, `ownerDomain: iam`, and `integrity`; deploy alongside a web-shell that has the `/admin/*` route, on the same platform packages |
| CI and release | `ci.yml`, `release.yml`, `changelog-check.yml` copied from `mfe-tender`; Dependabot ignores the three platform packages |
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

Layout and stack as `mfe-tender` (Vitest 5, happy-dom, Testing Library; `createTestPlatform`, `mockApi`, `mockProblem`). The gate is 95% on statements, branches, functions and lines, plus every `src/domain/` file above 95%.

| Suite | Covers |
|---|---|
| `test/unit/<area>` | Rules (both paths), the problem-to-outcome map, `userBatcher` (de-duplication, 200-ID chunking, TTL), `planGroupMappings` byte limits, architecture and SDK-duplicate rules, i18n catalogue and no-hard-coded-text |
| `test/integration` | The built `remoteEntry.js` through a shell share scope (inherited) |
| `test/e2e` | Flows through the whole `App` with a mocked IAM: invite with seat limit, role change with last-owner refusal, remove with a `409` resolution and automatic re-send, the group-mapping two-write partial failure, `202` settings sync, audit `202` → export polling, read-only mode, step-up on reset MFA |
| `test/contract` (new) | Each adapter against the shared IAM Swagger fixtures (response shapes, `errorCode` casing, `invitation_id` rather than `id`). Pin the Swagger commit |
| `test/browser` | The production standalone page in Chromium, Firefox and WebKit under the CSP, with axe WCAG 2.1 AA |
| `test/smoke` | The image: SPA rule, `remoteEntry.js` headers, manifest integrity |

## 15. Open Items

| # | Item | Owner |
|---|---|---|
| 1 | ~~Server state.~~ **Resolved 2026-11-25:** TanStack Query, recorded in [ADR 0001](../adr/0001-server-state-with-tanstack-query.md) | Architecture Review, mfe-admin |
| 2 | ~~App chrome.~~ **Resolved for this remote 2026-11-25:** it ships only its own section navigation inside `/admin`. The global header, user menu, admin entry point and workspace switcher are outside the IAM remotes' scope; their owner is still unassigned and falls to the shell or platform layer. Not a build blocker, but until it is decided no link to `/admin` or `/me` exists anywhere. See [app-chrome-handoff.md](app-chrome-handoff.md) | Frontend platform |
| 3 | ~~E2a step 1.~~ **Resolved by scope acceptance 2026-11-25:** this release ships step 2 only (IAM's `409` path), and the dialog says the workflow impact check is not available. Step 1 stays out until the Workflow service provides `GET /workflows/active-by-user` and per-row reassign and pause routes (IAM-FE-Q6). Future backend work; no date | Workflow |
| 4 | ~~E4 SSO.~~ **Resolved by scope acceptance 2026-11-25:** wireframe only. No production-ready SSO is committed in this milestone. Building it needs a tenant-facing IdP route (IAM-FE-Q7) first. Future backend work; no date | Org & Membership, Realm Provisioner |
| 5 | ~~Shared IAM components.~~ **Resolved 2026-11-25:** because IAM is split, the shared identity components (those used by two or more remotes: user chip, department label, member picker, and any other that gains a second consumer) are extracted into a **common package before implementation**; this remote keeps no copy. Package name, home and owner, and whether it shares a cache, are still to be set (the package shares code, not the Query cache). This blocks screens that show people. See [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §2 | Frontend platform |
| 6 | ~~Two routers, one URL.~~ **Resolved 2026-11-25:** the shell owns top-level routing, and cross-remote navigation goes through shell-managed routes with SDK `navigate()`, not full-page loads (no shared `react-router-dom` singleton). Still to confirm: a shell-driven move **inside an already-mounted remote** may not reach that remote's own router. See [shared-components-and-navigation-handoff.md](shared-components-and-navigation-handoff.md) §3 | web-shell, platform-reactcommon |
| 7 | ~~Permission key shape.~~ **Resolved 2026-11-25:** web-shell uses `manage:admin-roles`; spec §4.3 should be updated to match | IAM spec |
| 8 | **IAM questions that change screens:** IAM-FE-Q3 (seat grace date), Q4 (MFA and last-login columns), Q5 (member search and filters), Q9 (admin list of delegations, for the E2 header), Q12 (gateway-enforced step-up on reset MFA), Q14 (who may grant `tenant_admin`; the UI follows the HLD) | IAM |
| 9 | **Observability.** Write the `iam_admin_*` inventory, SLOs and dashboard; confirm the `iam` registry domain accepts a Tier 3 service named `admin` | mfe-admin, platform observability |
| 10 | **Contract suite.** Add an `admin` spec and server entry to web-shell's browser tests; no test yet loads a real remote other than `dashboard` inside the real shell | web-shell, mfe-admin |
| 11 | **Theme and CSS ownership** when embedded (Tailwind and daisyUI shipped by each remote; same open question as `mfe-tender` #7) | web-shell, platform |
| 12 | **Realm gaps shown to users** (IAM-FE-Q13: G-5 password policy, G-6 local accounts, G-13 invitation acceptance). E1a and E6 copy must change when they close. Until G-13 is fixed, a user may sign in and still show as pending | Realm Provisioner, Event Consumer |
| 13 | **Local development against IAM.** Agree whether dev uses the shell's `config/dev-platform.mjs` stand-ins, recorded fixtures, or a shared IAM dev environment, and who maintains the stub | mfe-admin, IAM |
| 14 | ~~Remote name and split.~~ **Resolved 2026-11-25:** separate remotes, one per audience (`admin`, `me`), not one `mfe-iam`. Matches the target architecture and avoids a later remote-boundary refactor. Recorded in §2.3 and §4.1 | Frontend platform |
| 15 | **Session-context refresh.** P-35 belongs to web-shell, but §7.5, §8 and §11 need the remote to trigger a refresh (after own role change, on `403`, on focus after about 60 s, IAM-UX-2). **Checked 2026-11-25: the SDK exposes no refresh** (`useSessionContext` is read-only; the shell's context store is private). Needs a new SDK hook plus a shell callback; see [session-context-refresh-handoff.md](session-context-refresh-handoff.md) | web-shell, platform-reactcommon |
