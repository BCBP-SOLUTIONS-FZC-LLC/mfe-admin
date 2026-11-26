# Architecture reference

The narrative with the data flow is [`ARCHITECTURE.md`](../ARCHITECTURE.md); the design is the [LLD](../docs/lld/mfe-admin-lld.md). This file is the lookup.

## Repository layout

```
src/
  app/                composition root
    App.tsx             default export ./App: providers, then the router (host's, or its own BrowserRouter standalone)
    bootstrap/          main.tsx (standalone entry), remote.ts (the remote build's placeholder entry)
    layouts/            AdminLayout (page outlet, each page in an MFEErrorBoundary; web-shell draws the frame and the Admin sub-menu)
    providers/          AdminProviders, composition.ts (the one place adapters are chosen), queryClient.ts
    routes/             index.tsx: /admin/* routes, each registers its route template
    styles/             index.css, aura.css, daisyAuraBridge.css (the dashboard's Aura tokens)
  presentation/       pages/ (Users, UserDetail, Departments, GroupMappings, Settings, Audit, AuditExports + their folders),
                      features/ (hooks: tracked queries and mutations, access, identity, services provider), components/
  application/        use-cases/ (one per repository-port operation), ports/ (telemetry, problems, exportJobs, navigation),
                      queries/ (keys, userBatcher)
  domain/             entities/, value-objects/, repositories/ (the six IAM ports), rules/admin-rules.ts, events/, vocabulary.ts
  infrastructure/     api/ (adapters + mappers + problem reading), configuration/ (messages, locales, standalone start-up),
                      storage/ (export job list), telemetry/ (metrics), federation/ (navigation)
  shared/             constants/app.ts (APP_ID), hooks/useFocusTrap.ts
config/               remote-manifest-entry.mjs, runtime.local.json
dev/                  harness.tsx, mock-iam/ (server.ts, sampleData.ts): dev only
nginx/                default.conf, security-headers.conf, document-headers.conf
public/               config/runtime.json (the image's default), favicon
scripts/              contracts.mjs (check/pin the Swagger), install-hooks.mjs
test/                 unit/, integration/, contract/ (+ swagger/), e2e/, browser/, smoke/, fixtures/, setup.ts
docs/                 lld/ (design + handoffs), adr/ (0001 to 0005), architecture/, observability/
```

## Module rules

| Layer | May import |
|---|---|
| `app` | everything |
| `presentation` | `application`, `domain`, `shared` (never `infrastructure` or `app`) |
| `application` | `domain`, `shared`; no React, SDK, browser API or package |
| `domain` | nothing of ours, no package |
| `infrastructure` | `application`, `domain`, `shared` |
| `shared` | nothing of ours |

Only `app/` and `presentation/features/` import TanStack Query. Only `infrastructure/telemetry/metrics.ts` creates metrics. Only `infrastructure/configuration/standalone.ts` reads the environment. The source of truth is `.dependency-cruiser.cjs` (`MAY_DEPEND_ON`, `VENDOR_ALLOWED`) and `test/unit/architecture/layers.test.ts`; keep this table equal to them.

## Build

`rsbuild.config.ts` has two environments sharing `dist/` (cleaned by `npm run build`):
- **remote:** `pluginPlatform({ role: 'remote', name: 'admin', exposes: { './App': './src/app/App.tsx' } })`, entry `src/app/bootstrap/remote.ts`, `splitChunks: { preset: 'none', chunks: 'async' }`, no HTML. Writes `remoteEntry.js` (`var __platform_mfe_admin`) and async chunks.
- **standalone:** `src/app/bootstrap/main.tsx` (+ `dev/harness.tsx` when `ADMIN_HARNESS=1`), `index.html`, `output.assetPrefix: '/'`, the SDK bundled.
Hashed CSS, fonts and images under `/assets/`. `config/remote-manifest-entry.mjs` writes `dist/remote-manifest-entry.json` (`entry`, `version`, `ownerDomain: iam`, sha384 `integrity`). Dev: port 5006, `hmr: false`, `liveReload: false`, `/config/runtime.json` from `config/runtime.local.json`.

## Hosting (nginx)

`nginx/default.conf` (port 8080): `/healthz`; `/remoteEntry.js` `no-cache` + CORS `*` + CORP `cross-origin`; hashed root `*.js|css` and `/assets/` immutable with CORS; `/config/runtime.json` `no-cache`, never the SPA fallback; dotfiles 404; `/api|otel|csp-report|config|remotes` 404 when missing; any file with a static extension `no-cache` or 404; everything else is `index.html` with the document headers (CSP, `X-Frame-Options`, noindex). No CSP in the image's other locations beyond the document's; the platform CSP and HSTS come from CloudFront (or the ingress until then). Proof: `test/smoke/deployment.test.ts`.

## Tests

| Folder | What |
|---|---|
| `test/unit/` | Domain rules, mappers, problem reading, use cases, the catalogue, metrics rules, the layers, the screens (`pages/`, `*-design.test.tsx` for the redesigned look), a11y over every screen (axe), the dev mock data |
| `test/integration/` | `remote-entry.test.tsx`: the built `remoteEntry.js` loaded through a share scope as the shell does it |
| `test/contract/` | Adapters through the real SDK client against the pinned Swagger (`swagger/`, `PIN.json`), errors, the harness |
| `test/e2e/` | The whole app (adapters, mappers, cache, router, screens) against the fake IAM at the HTTP level (`fixtures/fakeIamCore.ts`) |
| `test/browser/` | Playwright (Chromium) on `rsbuild preview` of the standalone build: routes, CSP, axe in both themes, a narrow width |
| `test/smoke/` | GET-only checks of a served image or deployment (not in `npm test`) |
| `test/fixtures/` | `platform.ts` (SDK test platform + permission sets), `services.tsx`, `pages.tsx`, `fakeIam*.ts`, `people.ts`, `audit.ts`, `domain.ts` |
