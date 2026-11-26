# CLAUDE.md

This file provides guidance to Claude Code when working with **mfe-admin**, the administration remote (`admin`, `ownerDomain: iam`) of the Tender Management SaaS platform that web-shell loads. Detailed reference lives in the sibling files listed under [See Also](#see-also). This file is what must always be in context.

## What This Repo Is

A **private Module Federation remote** (npm name `mfe-admin`, `"private": true`) built with Rsbuild and `@bcbp-solutions-fzc-llc/webpack-preset`. Container `__platform_mfe_admin`, exposing `./App` (`src/app/App.tsx`) with no props; web-shell mounts it at `/t/<slug>/admin/*`. The same code also runs **standalone** (`npm run dev`, port 5006; the image's `/`), where the SDK is bundled and every SDK API answers its anonymous defaults. It ships as a static bundle in an nginx image (`ghcr.io/bcbp-solutions-fzc-llc/mfe-admin`, port 8080, uid 101).

It holds the IAM administration screens: **E1** users and invitations (E1a invite), **E2** user detail (E2a removal resolution, step 2 only), **E3** departments and role labels, **E5** group mappings, **E6** workspace settings and delegation policy, **E7** audit log and exports. **E4 (SSO) is wireframe-only** and E2a step 1 (the Workflow impact check) is not built. Every check in the UI is a **hint**: IAM and the gateway decide.

Node 26 (`.nvmrc`; `engines` `>=22`), TypeScript, React 19.3, React Router 7, TanStack Query 5, Tailwind 4 + daisyUI 5 (the dashboard's Aura tokens in `src/app/styles/aura.css`), **Rsbuild 2 (Rspack), no Vite**, **Rstest** (not Vitest; ADR 0005) on happy-dom 21 pinned through `overrides`, Playwright + axe. Platform packages from **GitHub Packages** (`.npmrc`, `NODE_AUTH_TOKEN` with `read:packages`): `@bcbp-solutions-fzc-llc/frontend-sdk`, `webpack-preset`, `eslint-plugin`, **`1.0.0-alpha.10`, pinned exactly, on one version**, SDK also as peer `^1.0.0-alpha.10`.

**Status (2026-11-26):** not released. web-shell `0.5.0` mounts it at `/t/<slug>/admin/*` and draws the frame and the Admin sub-menu; every in-scope screen is built, tested (about 770 tests, coverage above the 95% gate) and styled in the dashboard's Aura look; the SDK is `1.0.0-alpha.10`. Open: the automated joint browser test in web-shell (LLD §15 #10), the shared identity package (interim copies, ADR 0003), IAM's P-35 cache lag, and the IAM questions in LLD §15 #8. Nothing is committed beyond the baseline.

**The remote owns:** `src/` (the layers below), `rsbuild.config.ts` (two environments: `remote` and `standalone`), `config/remote-manifest-entry.mjs` (the manifest entry with SRI), `nginx/`, `Dockerfile`, `dev/` (harness and mock IAM, dev only), `test/`, `docs/`.

**Does NOT own:** sign-in, tokens, session, workspace switching, the frame (web-shell's sidebar), the role → permission map (web-shell), PKCE, telemetry export, remote loading (all SDK / preset in `platform-reactcommon`); IAM services and their rules; other remotes' screens; the shared identity components (not yet a package: `src/presentation/components/identity/` are interim copies, ADR 0003).

## Common Commands

```bash
export NODE_AUTH_TOKEN=$(gh auth token)   # once per shell; needs read:packages
npm ci
npm run dev                # :5006 standalone + remote (HMR off on purpose: remoteEntry must stay a plain script)
npm run dev:harness        # ADMIN_HARNESS=1: /harness.html with a fake session and the seeded sample workspace on every screen
npm run dev:mock-iam       # :5090 mock IAM; run web-shell with DEV_API_URL=http://localhost:5090
npm run lint               # ESLint + platform rules
npm run arch-lint          # dependency-cruiser, .dependency-cruiser.cjs
npx tsc --noEmit
npm test                   # Rstest: unit, integration, contract, e2e
npm run test:ci            # + coverage gate 95% (+ every src/domain/ file above 90%)
npm run build              # tsc, rsbuild build, remote-manifest-entry.json
npm run test:browser       # build, then Playwright (Chromium, axe) on the standalone page
npm run contracts:check    # the pinned IAM Swagger files still match PIN.json
npm run test:smoke         # needs SMOKE_BASE_URL (test/smoke/README.md)
```

Run one test: `npx rstest run test/unit/pages/users-page.test.tsx -t "invite"`. Full list: [`operations.md`](operations.md).

## Architecture

`src/` uses the Frontend Architecture Constitution's folders: `app` (composition root) → `presentation` (pages, `features/` hooks, components) → `application` (use cases, ports, query keys) → `domain` (entities, value objects, rules, repository contracts); `infrastructure` implements the domain's ports; `shared` holds constants and hooks. `presentation` never imports `infrastructure`: adapters arrive through the services provider (`app/providers/composition.ts`). Feature hooks call **use cases** (`application/use-cases`, one per port operation, ADR 0004). `npm run arch-lint` (`.dependency-cruiser.cjs`) and `test/unit/architecture/layers.test.ts` enforce it; ESLint (`eslint.config.js`) enforces the platform rules (public SDK subpaths, no raw storage, and so on). Layout: **[`architecture.md`](architecture.md)**; flows: **[`request-flows.md`](request-flows.md)**; the narrative is [`ARCHITECTURE.md`](../ARCHITECTURE.md); the design is the [LLD](../docs/lld/mfe-admin-lld.md); the decisions are [ADR 0001 to 0005](../docs/adr); the constitution assessment is [`docs/architecture/constitution-assessment.md`](../docs/architecture/constitution-assessment.md).

## Critical Rules (do not break)

- **Never reimplement SDK behaviour.** HTTP client, retries and `Retry-After`, problem parsing, i18n and formatting, storage, metrics, logging, permissions (`useHasPermission`, `useReadOnly`), session (`useSessionContext`), step-up, `navigate()`: use the SDK; change it in `platform-reactcommon`. Before adding a helper, check the SDK's exports (`node_modules/@bcbp-solutions-fzc-llc/frontend-sdk/dist/<subpath>/index.d.ts`). The local helpers that stay are listed in LLD §5 (`utf8Bytes`, the user-batch chunker, the IAM error-code map, the focus trap, the datetime converters).
- **SDK imports through public subpaths only**, never the root or `dist/` internals. **The SDK is never bundled into the remote** (`pluginPlatform` shares it with `import: false`): do not import it from the standalone-only code in a way that changes that.
- **No raw platform APIs in `src/`:** no `fetch`, `localStorage`/`sessionStorage`, `console`, cookies, `window.location` assignment (cross-remote moves are SDK `navigate()` with the slug-prefixed path from `useSessionContext().slug`; never an `<a href>` into another remote). The only environment read is `src/infrastructure/configuration/standalone.ts`.
- **No identity in a header or a body.** The tenant ID in a path comes from the session context at call time (`requireTenant`); a call with no workspace is refused before it is sent (`MissingWorkspaceError`).
- **Authorization is a hint.** Gate with `useAdminAccess` / `useHasPermission` and the eight IAM permissions; never read role names from the session, never a department level as a role. A section a user may not open shows "not permitted", never a redirect. A `403 DENY_ROLE_INSUFFICIENT` or a change to the caller's own roles calls `useSessionRefresh` (the SDK's `useRefreshSessionContext`); never a private P-35 copy of the roles.
- **A server's `detail` text is never the main message.** Errors read through the `ProblemReader` port: catalogue messages by `errorCode`; `ProblemDetails` is the copyable technical part.
- **Writes use optimistic locking** (`recordVersion`); a `409` offers Reload (`ConflictDialog`), never a blind retry. Group-mapping saves are **full replacements**; the two-write partial failure says which part saved and retries only the rest.
- **State:** server state is TanStack Query (one `QueryClient` per mount, keys include the workspace slug, ADR 0001); client state is React state, the URL and the SDK's storage (no Zustand, ADR 0002). TanStack Query is imported only in `app/` and `presentation/features/`.
- **Domain and application are pure:** no React, SDK, browser API or package in `domain/`; none of React, SDK or browser in `application/`. Every `src/domain/` file stays above 90% (the gate); the rules in `domain/rules/admin-rules.ts` are held to the same, with both paths of each rule tested.
- **Metrics follow the Enterprise Platform Observability Standard** (`docs/observability/metrics.md`): only `iam_admin_*` Tier 3, only through the SDK's `getServiceMeter` in `src/infrastructure/telemetry/metrics.ts`; never `platform_*` or a shared `iam_*`, never a label the SDK injects or an unbounded one; every metric listed in the doc. `test/unit/metrics` enforces it.
- **Every user-facing word is a catalogue key** (`src/infrastructure/configuration/locales/`, `useT('admin')`); no key in two files, none unused. Dates and numbers through the SDK's `formatDate` / `formatNumber`.
- **CSP-safe:** no inline script or style (`inlineScripts`/`inlineStyles: false`), no `eval`, no `dangerouslySetInnerHTML`, no runtime CSS-in-JS, no third-party origin in `index.html`; fonts are self-hosted. An entry's own text (audit names, metadata) is shown as text, never markup.
- **Remote build rules:** `pluginPlatform({ role: 'remote', name: 'admin', exposes: { './App': … } })`; `splitChunks: { preset: 'none', chunks: 'async' }` and no dev client, so `remoteEntry.js` stays a synchronous script that defines `__platform_mfe_admin`; assets import from the bundle (no root-relative `/image/…`).
- **IAM contracts are pinned.** `test/contract/swagger/*.yaml` are copies of the services' Swagger; change them only by copying the new file and `npm run contracts:pin` after reading the diff. The adapters are tested against them (`test/contract`).
- **nginx SPA rule:** only extension-less paths get `index.html`; `/api`, `/otel`, `/csp-report`, `/config`, `/remotes`, `/assets` and any missing file with an extension stay 404; unhashed files `no-cache`, hashed `immutable`; `remoteEntry.js` revalidates and sends CORS. Change `test/smoke/deployment.test.ts` with it.
- **SDK upgrades:** all three packages together, exact pins, the peer range at the same version, **shell before remotes** (never newer than web-shell's SDK). Add a CHANGELOG entry. `/sdk-upgrade <version>`.
- **Registry token never in an image layer** (BuildKit secret `npm_token`). Dockerfile `FROM` lines stay digest-pinned.
- **Sibling repos are read-only from here:** `../web-shell`, `../mfe-dashboard`, `../../shared-library/platform-reactcommon`. Read them; change them in their own PRs, and record what they must do in a handoff under `docs/lld/`. (`guard.sh` blocks the edit; the user can ask for one explicitly.)
- **Architecture lint stays green.** A new module joins a layer; a new dependency is declared in `.dependency-cruiser.cjs`, never by widening what a layer may import. `test/unit/architecture/layers.test.ts` proves the rules fire.
- **Coverage gate stays at 95%** (statements, branches, functions, lines), every `src/domain/` file above 90%. Required checks keep their names: `Validate / Test / test`, `Validate / Quality / quality`, `Browser (Playwright, axe)`, `Smoke tests`, `changelog`.

## Conventions

- Tests: `test/unit` (small modules; the screens through `renderPage` and ports faked with `partial()`), `test/integration` (the built remote loaded the way the shell loads it), `test/contract` (adapters against the pinned Swagger), `test/e2e` (the whole app against the fake IAM in `test/fixtures/fakeIam*.ts`), `test/browser` (Playwright on the standalone build, axe in both themes), `test/smoke` (GET-only against a served image or deployment; not in `npm test`). Run `/gate` before calling a change done. A change only a real engine can check (CSP, contrast, fonts) needs a browser case. A new screen state needs a unit case; a changed flow needs an e2e case. Each redesign keeps accessible names, so existing tests keep passing; add a `*-design.test.tsx` for what is new.
- Wait on conditions with `waitFor` / `findBy*`, never on fixed sleeps. Under Rstest, import `react-router-dom` statically in tests (a dynamic import loads a second React), and stub `import.meta.env.DEV` with a string (`''` for false).
- Docs: plain, direct English; tables over prose; every claim checkable against the code. A change to routes, config keys, nginx paths, storage keys or the remote contract updates README, ARCHITECTURE, the LLD and CHANGELOG together. A redesign or behaviour change gets a `[Unreleased]` line.
- Commits: short imperative subject that says why. Branches `feat/ fix/ docs/ chore/ test/`; PRs into `main`.

## See Also

| File | Contents |
|---|---|
| [`architecture.md`](architecture.md) | Repository layout, module rules, build, hosting, tests |
| [`request-flows.md`](request-flows.md) | Mount in the shell, standalone start, a read, a write, 409, partial save, user names, step-up, session refresh, export polling, upgrade |
| [`operations.md`](operations.md) | Commands, CI jobs, registry access, image, smoke, dev harness and mock IAM, release; Claude Code settings and hooks |

**Subagents** (read-only; pass each a diff file): `invariant-reviewer` before a PR touching `src/`, `rsbuild.config.ts`, `nginx/`, `Dockerfile`, `index.html` or `config/`; `doc-sync-reviewer` before any PR that changes code the docs describe, or the docs; `a11y-reviewer` before a PR touching `src/presentation/`, the styles or a label; `contract-reviewer` before a PR touching `src/infrastructure/api/`, a port, `test/contract/`, the fake IAM or the sample data. **Skills** (user-invoked): `/gate [quick|full]` (the CI checks locally, every failure at once, with the known causes), `/new-screen <Name>` (scaffold and wire a new admin screen), `/sdk-upgrade <version>`, `/stack-sync <PR>`. **Hooks** (`.claude/settings.json`): `guard.sh` blocks edits to sibling repos, `node_modules/`, `dist/`, `coverage/`, `.env` / `docker.local.env`, and the pinned Swagger files; `post-edit.sh` runs ESLint, arch-lint, the SDK pin check and the catalogue check; `stop-gate.sh` (Stop) blocks the end of a turn once while `tsc --noEmit` or arch-lint fails, or while `CHANGELOG.md` is older than a file the changelog check watches.
