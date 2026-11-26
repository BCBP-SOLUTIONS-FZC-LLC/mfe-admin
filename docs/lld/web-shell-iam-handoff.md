# web-shell Handoff: IAM Screens

> **Superseded 2026-11-26 where it says "open":** web-shell `0.5.0` mounts `/t/<slug>/admin/*` and `/me/*`, draws the frame (sidebar, user menu, workspace switcher) and the Admin sub-menu, and the SDK is `1.0.0-alpha.10` with the session-context refresh. Items 2 and 3 below (routes, manifest entries) and "no shared chrome" describe the state on 2026-11-25. What stays open: the per-environment manifest entry for `admin`, the production-CSP contract spec in web-shell (mfe-admin LLD §15 #10), and IAM's own gaps.

| Field | Value |
|---|---|
| Repo | `xpertpms/web-shell` (`main` after v0.4.0, SDK `1.0.0-alpha.9`) |
| Purpose | What the shell team must change or provide so the IAM screens in `iam-product-screen-spec.md` (v0.1, 19 Nov 2026) can be built |
| Date | 24 November 2026; status refreshed 25 November 2026 against web-shell `main` (CHANGELOG `[Unreleased]`, `permissions.ts`, `App.tsx`, `remotes.local.json`) |
| Built from | The IAM spec (read in full); web-shell `README`, LLD, `App.tsx`, `permissions.ts`, `iam.ts`, ADRs 0002/0006; platform-reactcommon `ARCHITECTURE`, SDK `react`, `auth`, `mfe` sources |
| Not verified | `mfe-dashboard` and `mfe-tender` source; frontend spec v0.2; the contents of `gateway-deny-codes.json`; whether IAM has confirmed the P-35 error codes (IAM-FE-Q2) |

Spec section numbers (§) refer to the IAM spec unless stated otherwise.

---

## 1. What the shell is today

- A Rsbuild app, shipped as a static nginx image. It runs the SDK start-up sequence once per page, then renders remotes through Module Federation.
- **It owns:** the sign-in page and session screens, the two IAM ports (PUB-1 and P-35), the role map, and the signed-in routes.
- **It does not own:** PKCE, tokens, refresh, idle timeout, telemetry, remote loading, the shared map (all SDK), Keycloak, IAM APIs, or any screen inside a remote.
- **Remotes today:** `dashboard` (`ownerDomain: portal`) at `/t/<slug>/dashboard/*`; `tenders` (`mfe-tender`, `tender_management`, unreleased) at `/tenders/*`; `drafting` (`mfe-drafting`) at `/drafting/*` and `workflows` (`mfe-workflow-designer`) at `/workflows/*`, both `portal`, provisional and unreleased. Local dev ports 5002–5005 are taken; `mfe-admin` uses 5006.
- **Contract with remotes:** the shell exposes nothing and loads each remote's `./App` with **no props**. Remotes read the user, session context, flags, read-only state, step-up and sign-out through SDK hooks. Each remote runs its own router under the `/t/<slug>` basename (`react-router-dom` is not shared).
- **No shared chrome:** the shell has no header, nav or sign-out control. Each remote draws its own.
- **Shell rules that affect this work:** never re-implement SDK behaviour (`no-sdk-duplicates.test.ts`), presentation never imports infrastructure or the SDK, all user-facing words live in `src/shared/i18n`, coverage gate 95%, and CSP-safe (no inline script or style, no eval).

---

## 2. Target split of IAM screens

| Piece | Screens | Where |
|---|---|---|
| `mfe-admin` (new remote, proposed `ownerDomain: iam`) | E1, E1a, E2, E2a, E3, E5, E6, E7; E4 wireframe only | `/t/:slug/admin/*` |
| `mfe-me` (new remote, proposed `ownerDomain: iam`) | G1–G6 | `/t/:slug/me/*` |
| web-shell | A2, A4, A5, A6, A8, banners, read-only wrapper, role map | `/login`, `/onboarding/*`, `/workspace-unavailable` |
| Sign-up app (separate) | A1 | `signup.bcbpsolutions.com`, beside `bff-signup`; outside the shell |
| Operator console (separate) | O1–O4 | Platform realm; not under the shell |
| Inside `mfe-tender` | C16 access grants | `/t/:slug/tenders/:tenderId/access` |
| Keycloak theme | A3 | Not an MFE |

The `admin` / `me` split is **decided** (2026-11-25, LLD §15 #14): separate remotes, one per audience, matching the target architecture and avoiding a later remote-boundary refactor. The spec only names `mfe-admin` (v0.2 §12.3, IAM-FE-Q10). One `mfe-iam` serving both prefixes was rejected; web-shell registers two manifest entries, `admin` and `me`.

---

## 3. Work for the shell team

### 3.1 Required changes

**Status (25 Nov):** done = 1, 4, 5, 6, 8, 9. Partly done = 7. Still open = 2, 3, 10 (they wait for the remotes to exist).

| # | Change | Where | Spec ref |
|---|---|---|---|
| 1 | **Done (#74).** Add UI permissions: `manage:admin-roles` (renamed: the SDK's `roleMapAuthorizer` rejects the spec's two-colon `manage:roles:admin`; update spec §4.3), `manage:tenant-settings`, `manage:sso`, `manage:delegation-policy`, `read:audit`, `manage:tender-access` (`read:members` and `manage:members` already exist). Keep the key set to IAM's closed roles; never treat department levels as roles | `src/domain/rules/permissions.ts` | §4.3 |
| 2 | **Open.** Add `RemoteBoundary` routes for `/admin/*` and `/me/*`, each with `useRouteTemplate('/t/:slug/admin')` etc. and a loading text in `shared/i18n` | `src/app/routes/App.tsx` | §4.2 |
| 3 | **Open.** Manifest entries and local config for the two remotes (`config/remotes.local.json`, `remotes.allowedOrigins`, per-environment manifest with sha384 `integrity`) | config and deploy | n/a |
| 4 | **Done (#76).** Branch P-35 `403` on `errorCode`: `TENANT_TRIAL_EXPIRED` → A6, `TENANT_SUSPENDED` → A8, `INSUFFICIENT_ROLE` on P-35 → A8 "access paused" variant. Shown as dialogs, not routes. IAM must still confirm the codes (IAM-FE-Q2) | session-context use case, `ContextUnavailable`, new session screens | §5.5, §6 A6/A8 |
| 5 | **Done (SDK alpha.7–9).** The SDK re-checks a saved trial with PUB-1; the shell's PUB-1 port throws on a non-PUB-1 answer. Original ask: Trial first sign-in: links from sign-up emails must call PUB-1 with the slug (answers `strategy: shared`, `realm: trial`, `tenant_id`) and not use the `tenant-<slug>` shortcut. | `infrastructure/api/iam.ts`, sign-in use case | §5.3, §5.4 |
| 6 | **Done (#74).** A2 copy: label "Work email or workspace name", accept a pasted `/t/<slug>` URL, one generic not-found text for every miss and for `429`, client-side limit of 254 characters | login page, `en.json` | §6 A2 |
| 7 | **Partly done.** A5 upgrade welcome and A6/A8 exist (as dialogs, not at `/workspace-unavailable`, web-shell LLD §15 #19). A4 explainer and `/onboarding/setup-mfa` are not built. Routes `/onboarding/setup-mfa`, `/onboarding/welcome`, `/workspace-unavailable` | shell session screens | §6 A4/A5/A8 |
| 8 | **Done (#77), hourly refresh; "settings applying" is left to E6 in `mfe-admin`.** Banners: trial days left, past due (owner), cancelled/read-only, over seats, ownerless, settings applying. These need **P-1** (status, `trial_ends_at`, `ownerless_since`, `realm_sync_pending`) and **P-27** for seats. The shell only calls P-35 today | new ports + widgets | §5.6 |
| 9 | **Done (#75).** Read-only wrapper UI over the SDK's `useReadOnly()`, with the tooltip "Workspace is read-only (subscription ended)" | widget or shared component | §7.10 |
| 10 | **Open.** Contract test per new remote: a spec and server entry in `test/browser/server.ts` (the suite refuses a build not named `dashboard` today) | `test/browser/` | n/a |

### 3.2 What the SDK already provides (do not rebuild)

- **Step-up MFA:** `useStepUp()` returns `{ needed, reauthenticate }` and redirects with `prompt=login&max_age` using `mfaFreshnessSeconds`. The spec's `requireFreshMfa()` is not needed. The calling remote must resume the action after the redirect and also handle `DENY_MFA_STALE`.
- **Permissions and session:** `useHasPermission`, `<Can>`, `useSessionContext`, `useReadOnly`, `useFeatureFlag`.
- **API and errors:** `ApiClient` with Problem Details (RFC 9457, matching IAM's shape), `problemMessage` in `/i18n`.
- **Other:** per-remote i18n namespaces, namespaced `storage()`, `navigate()`, `useSignOut`, `useSwitchWorkspace`.

### 3.3 Open items that touch the shell

| # | Item | Owner |
|---|---|---|
| a | **App chrome:** with four remotes, who owns the header, user menu (links to `/me`), admin entry points and workspace switcher? Not decided in either document | Frontend platform |
| b | **Shared IAM components (7.1–7.10):** no UI library exists (ADR 0006: `platform-design-system` not published). The user-chip batch loader needs one shared cache; the shell only shares React, ReactDOM, OTel and SDK subpaths, so a bundled copy would be duplicated per remote. Options: new SDK subpath, or add a shared singleton in the preset. Both are changes in `platform-reactcommon` | Frontend platform |
| c | **IAM-FE-Q10:** user management is in `mfe-dashboard` on fixtures. If it moves to `mfe-admin`, keep a redirect from `/dashboard/user-management` | Frontend platform |
| d | **C16 placement:** the shell mounts only `./App` per route and has no remote-to-remote embedding. Proposed: build C16 inside `mfe-tender` with the shared picker and IAM client | `mfe-tender` team |
| e | **A1 ownership (IAM-FE-Q15):** who builds the sign-up page | Product / growth |

---

## 4. Checklist: adding each new remote

Taken from the shell README ("Integrating a remote").

1. Build with `@bcbp-solutions-fzc-llc/webpack-preset` (`role: 'remote'`, `name: 'admin'` or `'me'`, expose `./App`). Name must match `^[a-z][a-z0-9_-]{0,62}$`. The container global becomes `__platform_mfe_<name>`.
2. SDK version no newer than the shell's (`1.0.0-alpha.9`). **Upgrade the shell first** on any SDK bump.
3. A Vite ES-module remote will not load through `loadRemote`.
4. Manifest entry: `{ entry, version, ownerDomain, integrity }`. `ownerDomain` must be in the SDK registry (`iam`, `workflow`, `billing`, `tender_management`, `notifications`, `documents`, `bff`, `portal`) or the entry is dropped. Cross-origin entries need `remotes.allowedOrigins`.
5. Shell route with `<RemoteBoundary remote module="./App" />`, no props, plus `useRouteTemplate`.
6. Hosting until CloudFront: ingress route `/remotes/<name>/`, mounted CSP and HSTS (`docs/hosting-without-cloudfront.md`).
7. Remote reads data only through SDK hooks and never runs its own Keycloak client or reads tokens.
8. Domain remotes follow the constitution's TanStack Query and Zustand rule (the shell's exception is ADR 0002).
9. Update README, ARCHITECTURE, LLD and CHANGELOG together when routes or the remote contract change.

---

## 5. Suggested order

1. Shell (spec phase 1a): done, apart from the A4 / `/onboarding/*` routes in item 7.
2. Decide §3.3 a and b before the first remote is built. Then add routes, manifest entries and contract specs (items 2, 3, 10) for `admin` and `me`.
3. `mfe-admin`: E1, E2, E3 (phase 1b), then E6, E7, E5 (phases 1d and 2).
4. `mfe-me`: G1–G6 (phase 1c).
5. Last or blocked: E4 (needs IAM-FE-Q7), E2a step 1 (needs the Workflow route, IAM-FE-Q6), operator console (platform realm not live).

## 6. Risks

- Shell `403` handling shipped; IAM still needs to confirm the error codes (IAM-FE-Q2).
- Role map entries are hints only. The gateway decides every request; never grant the UI more than IAM does (spec §2.2). IAM-FE-Q14 (who may grant `tenant_admin`) is unresolved, and the UI follows the HLD (owner only) until answered.
- Tender permissions in the role map remain provisional (LLD §15 #8).

---

## 7. References

- `web-shell/README.md`, `docs/lld/web-shell-lld.md` (§15 open items), `src/app/routes/App.tsx`, `src/domain/rules/permissions.ts`, `src/infrastructure/api/iam.ts`
- `web-shell/docs/adr/0002`, `0006`
- `platform-reactcommon/ARCHITECTURE.md`, `packages/frontend-sdk/src/react/hooks.ts`
- `iam-product-screen-spec.md` §4, §5, §6, §7, §13, §14
