# ADR 0004: Use cases in the application layer; hooks call `execute()`

## Status

Accepted (2026-11-25). Supersedes an earlier draft of this ADR that kept hooks calling the repository ports directly. This follows the platform constitution.

## Context

The constitution has presentation call use cases (`ApproveTenderUseCase.execute()`), not repositories, and the application layer own them in `application/use-cases`. This remote first shipped with feature hooks calling the ports directly, which the earlier assessment hid.

## Decision

- `src/application/use-cases/` has one class per repository-port operation (35, one file each, for example `InviteUseCase`, `SetRolesUseCase`, `SearchAuditUseCase`), built over a `Pick<Port, 'method'>` of the domain's repository contracts. They have no React, SDK or browser imports (arch-lint enforces it).
- `createUseCases(ports)` builds them all; `useAdminUseCases()` (presentation/features/services.tsx) builds them from the injected services once per provided services object.
- Feature hooks call `useCases.<name>.execute(...)`. They never touch a port. Tests still inject ports; the use cases sit on top of them.
- Business rules stay in `domain/rules/admin-rules.ts` and are applied before a write. A use case may grow into orchestration (more than one call, a compensating step) without changing any caller.
- `test/unit/application/use-cases.test.ts` fails if a port operation has no use case or one does not forward its arguments and abort signal.

## Consequences

- Complies with the constitution's layering; hooks no longer know which port an operation lives on.
- Most use cases are pass-through today; that is the price of the uniform call shape. Add orchestration there (the two-write partial failure and retry flow is the first candidate), not in hooks.
- A new port operation needs a use case file and a line in `createUseCases` (the test catches a miss).
