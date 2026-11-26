# ADR 0003: Interim UI: Tailwind and daisyUI, and local identity components until the shared package exists

## Status

Accepted (2026-11-25). Interim: superseded when `platform-design-system` and the shared identity package are published.

## Context

- The platform has no published design system (`platform-design-system` does not exist yet), so the constitution's "use the design system" cannot be followed. The sibling remotes use Tailwind 4 with daisyUI 5; so does this one.
- The user chip, department label, member picker and role badges are needed by this remote, by `mfe-me`, and by `mfe-tender` and `mfe-dashboard` (LLD §15 #5). The decision is that they move to a common package before they are built twice. That package does not exist yet, and its name, home and owner are not set.

## Decision

- Use Tailwind and daisyUI directly, with the same class conventions as the siblings, until a design system is published.
- Keep the identity pieces (`UserChip`, `DepartmentLabel`, `RoleBadge`, `MemberPicker`, and the hooks `useUserProfiles` and `useDepartmentDirectory` behind them) in one place, `presentation/components/identity/` and `presentation/features/identity/`, written against the data they need and nothing else. They are the only code that moves when the shared package arrives.
- Do not copy other remotes' identity components.

## Consequences

- Each remote that shows people still has its own copy and its own Query cache until the package is adopted; profiles are asked of User Profile once per remote.
- Replacing them is a change of imports in those two folders and in the screens that use them, not a redesign.
- `MemberPicker` is minimal: it lists the member pages loaded so far (there is no server-side name search, IAM-FE-Q5).
