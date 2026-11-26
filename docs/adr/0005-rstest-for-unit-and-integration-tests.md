# ADR 0005: Rstest instead of Vitest for unit, integration, contract and e2e tests

## Status

Accepted (2026-11-25). A deviation from the platform constitution, which names Vitest.

## Context

The remote builds with Rsbuild and Rspack. Vitest brings Vite back into the toolchain (`vite`, `@vitejs/plugin-react`) only to run tests, with a second transform pipeline that can differ from the one that ships.

## Decision

Run tests with Rstest (`@rstest/core`, Istanbul coverage through `@rstest/coverage-istanbul`) on happy-dom, with `@testing-library/*` and the same 95% gate. The test files use `rs` where Vitest uses `vi`. `happy-dom` is 21.x through `overrides`: Rstest's peer range lists 20.x, which carries open high-severity advisories.

## Consequences

- No Vite in `package-lock.json`.
- Rstest is 0.x; expect API movement. Pin it and upgrade deliberately.
- Under Rstest `import.meta.env.DEV` is stubbed with a string (`''` for false), and a dynamic `import('react-router-dom')` can load a second copy of React: import such packages statically in tests.
- Other remotes still use Vitest. Revisit if the platform standardises on one runner.
