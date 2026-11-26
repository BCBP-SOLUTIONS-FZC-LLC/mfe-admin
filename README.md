# mfe-admin

Micro-frontend remote (Module Federation container `admin`, `ownerDomain: iam`) for tenant administration in the Tender Management SaaS platform: users and invitations, roles, departments, group mappings, tenant settings and the audit log. Built on the platform SDK and loaded by web-shell at `/t/<slug>/admin/*`.

**Status:** every in-scope screen is built and tested (users and invitations, member detail, departments and role labels, tenant settings and delegation policy, group mappings, audit log and exports); SSO (E4) is wireframe-only. Not released. web-shell `0.5.0` mounts it at `/t/<slug>/admin/*` (verified in a real browser session on 2026-11-26) and draws the frame and the Admin sub-menu; this remote draws the page only. The design is in [docs/lld/mfe-admin-lld.md](docs/lld/mfe-admin-lld.md) (read "Signoff conditions" first); the structure is in [ARCHITECTURE.md](ARCHITECTURE.md).

## Run

```sh
export NODE_AUTH_TOKEN=$(gh auth token)   # needs: gh auth refresh -s read:packages
npm install
npm run dev            # http://localhost:5006 (remoteEntry.js and the standalone page)
npm run build          # dist/ and dist/remote-manifest-entry.json
npm run dev:harness    # http://localhost:5006/harness.html: a fake session and the seeded sample workspace on every screen
npm run dev:mock-iam   # http://localhost:5090: the same sample workspace as an IAM, for web-shell (DEV_API_URL=http://localhost:5090 npm run dev there)
```

Tests run on **Rstest** (not Vitest; [ADR 0005](docs/adr/0005-rstest-for-unit-and-integration-tests.md)) and the build on Rsbuild/Rspack, with no Vite.

| Check | Command |
|---|---|
| Types, lint, layers | `npx tsc --noEmit`, `npm run lint`, `npm run arch-lint` |
| Tests and the 95% gate | `npm run test:ci` |
| Built `remoteEntry.js` through a shell share scope | `npm run test:integration` |
| Adapters against the pinned IAM Swagger | `npm run test:contract`; `npm run contracts:check` compares the pin with IAM's folder |
| Whole-app flows against a fake IAM | `npm run test:e2e` |
| Accessibility of every screen (axe-core) | `npm run test:unit` (`test/unit/a11y`) |
| Browser: CSP, colour contrast, routes (Chromium) | `npx playwright install chromium`, then `npm run test:browser` |
| The served image or a deployment (GET only) | `SMOKE_BASE_URL=http://127.0.0.1:18080 npm run test:smoke` ([test/smoke/README.md](test/smoke/README.md)) |
| Bundle size budget (after a build) | `npm run budget` |
| Everything CI runs, locally | `/gate` in Claude Code (`.claude/skills/gate`), or the commands above |

## Where things are

| | |
|---|---|
| Design | [docs/lld](docs/lld) (LLD, handoffs, implementation prompt), [docs/adr](docs/adr), [ARCHITECTURE.md](ARCHITECTURE.md), [docs/architecture](docs/architecture), [docs/observability/metrics.md](docs/observability/metrics.md) |
| Source | `src/{app,presentation,application,domain,infrastructure,shared}` (layers in LLD §3, [ARCHITECTURE.md](ARCHITECTURE.md)); `dev/` (the harness and mock IAM, dev only); `test/{unit,integration,contract,e2e,browser,smoke}` |
| Claude Code | [`.claude/`](.claude): `CLAUDE.md` (rules), `architecture.md`, `request-flows.md`, `operations.md`, hooks, reviewer subagents, `/gate`, `/new-screen`, `/sdk-upgrade`, `/stack-sync` |
| Operations | [docs/runbooks/remote-load-failure.md](docs/runbooks/remote-load-failure.md), [docs/observability/metrics.md](docs/observability/metrics.md) |
| Siblings | `mfe-dashboard` (reference for build, image, CI), `mfe-tender`, `web-shell` (host) |

See [VERSIONING.md](VERSIONING.md) and [CHANGELOG.md](CHANGELOG.md).

## Routes, storage and configuration

| | |
|---|---|
| Routes (under `/t/<slug>/admin`, or `/admin` standalone) | `users`, `users/:userId`, `departments`, `group-mappings`, `settings`, `audit`, `audit/exports`; an unknown path goes to the users list. No SSO route (E4 is wireframe only). The Admin sub-menu that links them is web-shell's |
| Browser storage | One key, `auditExports` (audit export job IDs, newest 20), through the SDK's `storage('admin')`, namespaced per workspace. No token, no user data, no permissions. Raw `localStorage` is rejected by lint |
| `/config/runtime.json` | The SDK's runtime config, read by the standalone page. The image's default (`public/config/runtime.json`) names no `environment` and no `auth.signInUrl`; each deployment mounts its own. Inside web-shell the shell's config is used |
| Manifest entry | `dist/remote-manifest-entry.json`: `entry`, `version`, `ownerDomain: iam`, sha384 `integrity`; each deployment copies it into web-shell's manifest |
| Platform packages | `@bcbp-solutions-fzc-llc/{frontend-sdk,webpack-preset,eslint-plugin}` `1.0.0-alpha.10`, exact, one version; the SDK also as peer `^1.0.0-alpha.10`; never newer than web-shell's |
