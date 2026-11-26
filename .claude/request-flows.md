# Request flows

How a request moves through the remote. Layer names are in [`architecture.md`](architecture.md); the LLD's §7 has each screen's flow.

## Mounted by web-shell

1. The shell's `loadManifest()` lists `admin` (`entry`, `version`, `ownerDomain: iam`, `integrity`); its `/admin/*` route renders `<RemoteBoundary remote="admin" module="./App" />` with no props and `useRouteTemplate('/t/:slug/admin')`.
2. The SDK's `loadRemote` fetches `remoteEntry.js` (SRI), runs it (`var __platform_mfe_admin`), calls `init(shareScope)` (React, React DOM, the OTel API and every SDK subpath come from the shell's share scope), then `get('./App')`.
3. `App` renders `AdminProviders` (one `QueryClient`, cleared on unmount; the services built from the session context's `tenantId` and the slug-prefixed workspace prefix, unless a test provided its own) and then `AppRoutes`: inside the shell's router it uses it as is; otherwise it makes a `BrowserRouter` under `workspaceBasename(location.pathname)`.
4. A `navigate()` into the remote while it is showing remounts it (web-shell's `RouterBridge`), so its own router follows the URL.

## Standalone start

`main.tsx` → `startStandalone()` (never rejects): sets the page identity (`mfe-admin`, domain `iam`; environment from `/config/runtime.json`, else `local` in dev and `prod` built), loads the runtime config, then renders `App` inside the SDK's `MFEErrorBoundary`. With no shell there is no session: every SDK API answers its anonymous defaults (deny-all permissions, no flags, console logger), so each section says "not permitted". The dev harness (`dev/harness.tsx`) starts the SDK's test platform instead and answers `/api/*` from the fake IAM.

## A read

screen → `useTrackedQuery` (`presentation/features/tracked.ts`) → `useAdminUseCases().<name>.execute()` → port → adapter (`infrastructure/api/<service>.ts`) → `ApiScope.client` (the SDK `ApiClient`: retries safe calls with `Retry-After`) → `/api/v1/tenants/:id/…` → mapper (snake_case JSON → domain) → TanStack cache under `adminKeys(slug)`. The load is measured once (`iam_admin_loads_total`, `iam_admin_load_duration_seconds`); a superseded or aborted load is not counted. A failed query is retried at most twice, only for no response, a timeout, `429` and `5xx` (`isRetryableQueryError`).

## Names for IDs

Lists carry IDs only. `useUserProfiles(ids)` asks User Profile once for the distinct IDs not fresh in the cache, in chunks of at most 200 (`userBatcher`), and stores each profile under its own key (fresh for 60 s, the service's own cache). A row is never hidden: "Unknown user" when the service lists the ID as missing, "Name unavailable" when the call failed. A raw ID is never shown.

## A write

screen → the domain rule first (`planInvitation`, `planRoleChange`, `planGroupMappings`, …: refuses what the UI already knows) → `useTrackedMutation` → use case → adapter (sends the `recordVersion` it read) → on success, invalidate the keys it made stale (members share one prefix). Measured once (`iam_admin_actions_total{outcome}`: `success`; `failure` for a rejection, every `4xx`; `error` for a fault). Mutations are never retried.

## 409 and the removal resolution

- `OPTIMISTIC_LOCK_CONFLICT` / `VERSION_CONFLICT`: `ConflictDialog` offers Reload (refetch), never a blind retry.
- `WORKFLOW_RESOLUTION_REQUIRED` on a removal or demotion (E2a step 2): `ResolutionDialog` offers replacing the delegate or stopping the workflows; the chosen action is sent to `resolveRemoval`, then the original write is sent again once. Step 1 (the impact check) is not built.
- `LAST_OWNER_REMOVAL`, `SEAT_LIMIT_REACHED`, `REINVITE_TOO_SOON`, …: plain catalogue messages by `errorCode` (`infrastructure/api/problem.ts`).

## Group-mapping save (full replacement)

Department-and-level saves write two full lists in order (departments, then levels). If the second write fails after the first went through, the screen says which part saved and the Retry sends only the rest (`skipDepartments`). Role mappings are one list. A non-owner is refused only for changing owner rows.

## Gateway step-up

Reset MFA (and any gateway-guarded action later) uses the SDK's `useStepUp()`: when `stepUp.needed` (the login is older than the freshness window), confirming starts `stepUp.reauthenticate()` first and records `iam_admin_step_up_requests_total`; the SDK saves drafts and redirects, and the user returns and acts again. If the call is sent anyway and the gateway answers `403 DENY_MFA_STALE` (`problems.isMfaStale`), the dialog offers the same step-up. The remote never reads tokens.

## Session refresh

`useSessionRefresh` is the SDK's `useRefreshSessionContext()`. It runs after a successful P-28 on the caller's own user and on `403 DENY_ROLE_INSUFFICIENT` (never retried in a loop). The shell reloads P-35 and re-renders every consumer (`useHasPermission`, `useReadOnly`, the sections list). The shell also refreshes on focus (at most once a minute). A failed refresh keeps the old hints.

## Audit search and exports

The filter lives in the URL (`useSearchParams`); a search is one measured load, paged by cursor (100 a page). The plan may clamp `from` (the page says so). A large search answers `202` with a job: the page shows "preparing as a file" and links to the exports. "Export these results" posts the filter and opens `/admin/audit/exports`, where each tracked export (IDs in the SDK's per-app storage via `ExportJobStore`, cleared on sign-out) is polled until it is ready, failed or expired; a ready export's download link is fresh on each poll.

## Seats and upgrade

`getSeatUsage` (P-27, admins and owners only) feeds the seat card. With no free seat, "Invite user" opens the upgrade prompt instead of the form. "Upgrade plan" calls the `AdminNavigation` port → SDK `navigate('billing', '<workspace prefix>/billing')` (the destination, `UPGRADE_PATH`, is a placeholder until a billing area exists).
