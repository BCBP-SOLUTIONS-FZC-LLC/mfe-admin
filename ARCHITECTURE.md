# Architecture

This document describes the internal structure, dependency rules and runtime flows of `mfe-admin`. The design is in the [LLD](docs/lld/mfe-admin-lld.md); the decisions are in the [ADRs](docs/adr); the metrics are in [docs/observability/metrics.md](docs/observability/metrics.md).

`mfe-admin` is the **Module Federation remote `admin`** (`ownerDomain: iam`). It exposes `./App` with no props, and web-shell mounts it at `/t/<slug>/admin/*`. The same code also runs as a **standalone page** (`npm run dev` on port 5006, and the image's `/`). It is built with React 19, React Router 7, TanStack Query 5, Tailwind 4 with daisyUI 5, and Rsbuild 2 using the platform preset. The image is nginx (unprivileged) on port 8080.

One build makes two environments: the **remote** (`remoteEntry.js` and chunks, the platform SDK taken from the shell) and the **standalone** page (the SDK bundled).

**Status (2026-11-26):** not released. web-shell `0.5.0` mounts it at `/t/<slug>/admin/*` (loaded and rendered in a real browser session) and draws the frame and the Admin sub-menu. Every in-scope screen is built and tested; E4 (SSO) is wireframe-only and E2a step 1 (the Workflow impact list) is out, because their backend routes do not exist ([LLD §15](docs/lld/mfe-admin-lld.md#15-open-items)).

**Owns:** the administration screens (users and invitations, member detail, departments and role labels, tenant settings and delegation policy, group mappings, audit log and exports), the `admin` message catalogue, the `iam_admin_*` metrics and the nginx image.

**Does not own:** sign-in, tokens, session and workspace switching (the SDK in web-shell); who may do what (IAM and the gateway decide, every check here is a hint); the role → permission map (web-shell); the frame: sidebar, user menu, workspace switcher and the Admin sub-menu (web-shell, [handoff](docs/lld/app-chrome-handoff.md) §9); the member's own profile (`mfe-me`); the manifest, SRI and kill switch (web-shell and the SDK).

---

## Layer model

`src/` follows the Frontend Architecture Constitution's layers. Dependencies point inward; `npm run arch-lint` (`.dependency-cruiser.cjs`) and `test/unit/architecture/layers.test.ts` enforce them.

| Layer | Holds | May import |
|---|---|---|
| `app` | Composition root: `App`, routes, layouts, providers, the one place adapters are chosen | everything |
| `presentation` | Pages, components, and `features/` (hooks that call use cases (ADR 0004), with `app/`, the only code that uses TanStack Query) | `application`, `domain`, `shared` |
| `application` | Use cases (`use-cases/`, one per repository-port operation), ports (`telemetry`, `problems`, `exportJobs`, `navigation`), query keys, `userBatcher`; no React, SDK or browser | `domain`, `shared` |
| `domain` | Entities, value objects, the rules (`admin-rules.ts`), the six IAM ports (and the interface-only `WorkflowImpactPort`); pure TypeScript | nothing |
| `infrastructure` | HTTP adapters on the SDK `ApiClient`, mappers, `problem.ts`, telemetry, storage (the export job list), `federation/` (the upgrade navigation), runtime start-up (`configuration/standalone.ts`) | `application`, `domain`, `shared` |
| `shared` | Constants and hooks | nothing |

Two consequences worth knowing: presentation never imports infrastructure (what a screen needs from it arrives through the services provider), and TanStack Query is bundled in this remote and imported only in `app/` and `presentation/features/` (ADR 0001).

## Data flow

```
screen (pages/)  →  feature hook (features/, TanStack Query)  →  port (domain/repositories)
                                                                       │
                       services provider (app/providers/composition)   ▼
                                                           HTTP adapter (infrastructure/api)
                                                                       │  mappers: JSON ⇄ domain
                                                                       ▼
                                                      SDK ApiClient  →  same-origin /api  →  IAM
```

- **Reads** are `useTrackedQuery` (and a paged variant): one measured load, keyed by `adminKeys(slug)` so a workspace switch cannot show another workspace's data. A list is paged by cursor; names are joined from User Profile in one lookup per set of IDs, each profile cached under its own key for about 60 seconds.
- **Writes** are `useTrackedMutation`: one measured write (success, `failure` for a rejection, `error` for a fault), then the keys it made stale are invalidated. The rules in the domain check what the UI knows first, and the service re-checks everything.
- **Errors** are read through the `ProblemReader` port: the metric outcome, whether to refresh the session or offer Reload, and a catalogue message for each known `errorCode`. A server's `detail` text is never shown.
- **The tenant ID** in a path comes from the session context at call time; no identity is ever sent in a header or a body.

## Runtime flows

- **Mounted by web-shell:** the shell loads `remoteEntry.js` (SRI), `init(shareScope)`, `get('./App')`, renders `App` at `/t/<slug>/admin/*`. `App` runs its own router under the workspace basename (the shell does not share `react-router-dom`), and one `QueryClient` per mount, cleared on unmount.
- **Between remotes:** SDK `navigate(appId, '/t/<slug>/…')` with the slug from the session context, never an `<a href>` (the Upgrade plan action does this). Inside the shell the sidebar and the Admin sub-menu are web-shell's; `AdminLayout` is the page outlet only.
- **Session refresh:** after the caller's own roles change, or on `403 DENY_ROLE_INSUFFICIENT`, `useSessionRefresh` asks the shell to reload P-35 (the SDK's `useRefreshSessionContext`); the shell also refreshes on focus.
- **Standalone:** loads `/config/runtime.json`, sets the page identity (`mfe-admin`, domain `iam`), and renders. With no shell there is no identity, so every section is "not permitted".

## Things that look odd and are on purpose

- **A "saved" notice lives in the page, not the card.** A card is keyed by its record's version so the form reloads when the server's version moves; a save moves it, the card remounts, and a notice kept inside would vanish. For the same reason a keyed card sends a save with `mutateAsync(...).then(...)`, not a callback passed to `mutate`, which is skipped for an unmounted component.
- **The last-owner count walks every member page** (P-4 has no filter), only for an active owner; if it fails the screen does not block and the service refuses the last owner itself.
- **An audit search takes one entry type, and exports are tracked by ID in storage**, both because of what the SDK client and the Audit Log API offer ([handoff](docs/lld/sdk-api-client-handoff.md), LLD §7.10).
- **`/users:batch` is sent as `users%3Abatch`** (the SDK's route templates read `:batch` as a parameter); unproven through the gateway.

## Testing

| Suite | What it proves |
|---|---|
| `test/unit` | Rules both ways at their boundaries, mappers, the problem reader, the use cases, telemetry, every screen in every state (and a `*-design.test.tsx` beside each redesigned one), the layer and SDK rules, the catalogue, the dev sample data |
| `test/contract` | Every adapter call against a vendored, SHA-256-pinned copy of the six IAM Swagger files |
| `test/integration` | The built `remoteEntry.js` through a shell share scope |
| `test/e2e` | The LLD §14 flows through the whole `App` against a fake IAM at the HTTP level |
| `test/unit/a11y` | axe-core over every screen and dialog (WCAG 2.1 A, AA and best practice; not colour contrast) |
| `test/browser` | The production standalone page in Chromium: CSP, colour contrast in both themes, routes, narrow width |
| `test/smoke` | GET-only (`npm run test:smoke`): the served image or a deployment: document and SPA rule, `remoteEntry.js` and its integrity, `runtime.json`, headers, nginx's exact 404s |

Gate: 95% of statements, branches, functions and lines, every `src/domain` file above 90%, and `npm run arch-lint`.

## What is not proven

The adapters conform to the pinned Swagger but have never met a running IAM service. The remote has been loaded by a real web-shell only by hand (2026-11-26); the automated joint browser suite in web-shell's contract tests is LLD §15 #10. Browser tests run in Chromium only. Screen-level behaviour behind a session is tested in jsdom, not in a browser.
