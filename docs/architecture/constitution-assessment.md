# Frontend Architecture Constitution: assessment (mfe-admin)

Assessment of `mfe-admin` against the Frontend Architecture Constitution 1.0, as of 2026-11-25. It is built to the constitution from the first commit, so there is no migration: this records where it complies, the deviations (with their ADRs), and what is still open.

## 1. Assessment

| Constitution section | State | Where |
|---|---|---|
| Domain ownership (bounded context) | Compliant: owns the IAM administration screens; IAM rules are re-checked by the services and the UI never grants more | LLD §2 |
| Required project structure | Compliant: `app/`, `presentation/`, `application/`, `domain/`, `infrastructure/`, `shared/` | ARCHITECTURE.md |
| Layers and dependency rules | Compliant and enforced: `npm run arch-lint`, `layers.test.ts`; domain and application are free of React, the SDK and browser APIs | `.dependency-cruiser.cjs` |
| Presentation, application, domain, infrastructure | Compliant: pages call feature hooks, which call use cases (`application/use-cases`, one per port operation, ADR 0004); rules in the domain; adapters in infrastructure; presentation imports no infrastructure | ARCHITECTURE.md, ADR 0004 |
| Server state: TanStack Query | **Compliant** (no deviation): used for every read and write, one `QueryClient` per mount, keys include the workspace slug | ADR 0001 |
| Client state: Zustand | **Approved deviation**: React state, the URL and the SDK's storage | ADR 0002 |
| Shared cross-MFE state from the shell | Compliant: user, permissions, session context, read-only and step-up come from SDK hooks and are not copied | LLD §5 |
| API access through repositories | Compliant: six domain ports, one HTTP adapter each on the SDK `ApiClient`, contract-tested against the pinned Swagger | `test/contract` |
| Runtime configuration | Compliant: nothing environment-specific is compiled in; the standalone page reads `/config/runtime.json` | LLD §12 |
| Module Federation, runtime-configurable remote | Compliant: manifest entry with SRI, `ownerDomain: iam`, the SDK taken from the shell | LLD §4 |
| Authentication centralised in the shell | Compliant: no token, cookie or identity header is seen or sent | LLD §13 |
| Shared libraries: no domain logic shared | Compliant today; the identity components are to move to a common package that holds no IAM rules | LLD §15 #5 |
| Design system | **Interim deviation**: Tailwind and daisyUI, with the identity components kept in one place | ADR 0003 |
| Testing standards | **Approved deviation**: Rstest instead of Vitest (ADR 0005). Otherwise compliant: unit, contract, integration, e2e, axe and browser suites, a 95% gate, domain files above 90% | ARCHITECTURE.md |
| Accessibility (WCAG 2.1 AA) | Verified in jsdom for every screen and dialog and in Chromium for the standalone page, colour contrast included; no real-session browser run yet | `test/unit/a11y`, `test/browser` |
| Observability standard | Compliant: five Tier 3 `iam_admin_*` metrics through the SDK, validated against the registry and the inventory page in CI | docs/observability/metrics.md |

The other required outputs (target diagram, folder restructuring plan, dependency cleanup plan, migration roadmap) are in [refactoring-plan.md](refactoring-plan.md).

## 2. Violations

None open. Three deviations are accepted and recorded: Zustand (ADR 0002), the design system (ADR 0003) and Vitest (ADR 0005).

## 3. Follow-ups

1. **Common identity package** (user chip, department label, member picker): name, home and owner are undecided; this remote builds against its own interim copies (ADR 0003, LLD §15 #5).
2. **A joint browser test** (LLD §15 #10): web-shell `0.5.0` has the `admin` route and header (loaded and rendered in Chromium 2026-11-26); its production-CSP contract suite is still dashboard-only.
3. **Session-context refresh** (LLD §15 #15): done with SDK alpha.10's `useRefreshSessionContext`; only IAM's P-35 cache lag is open.
4. **SDK `ApiClient` limits** (LLD §15 #18): `:batch` in a route template and a repeated query key.
5. **The audit entry-type taxonomy** (LLD §15 #19): the filter is a text box until the file is available.
6. **Browser coverage:** Chromium only; Firefox and WebKit are not installed or run here.
7. **A design system** when `platform-design-system` is published (ADR 0003).
