# Handoff: Session-Context Refresh (mfe-admin LLD §15 #15)

| Field | Value |
|---|---|
| Date | 25 November 2026 |
| From | `mfe-admin` |
| To | `platform-reactcommon` (SDK `/react`, `/auth`), `web-shell` |
| Purpose | A remote has no way to make the shell reload the P-35 session context. `mfe-admin` needs one. Decide who adds it and how |
| Status | **Implemented 2026-11-26** (SDK `1.0.0-alpha.10`, web-shell `0.5.0`); mfe-admin aligned. See the section "What shipped" at the end |
| Related | [mfe-admin-lld.md](mfe-admin-lld.md) §7.5, §8, §11, §15 #15; IAM-UX-2; [web-shell-iam-handoff.md](web-shell-iam-handoff.md) §3.1 item 8 |

## 1. Answer to the open question

**The SDK does not expose a refresh.** A remote cannot trigger one today.

| Evidence | Finding |
|---|---|
| `useSessionContext()` in `@bcbp-solutions-fzc-llc/frontend-sdk/react` | Returns `SessionContext \| undefined`. No setter, no `refresh`, no `reload` |
| `SessionContextSource` in `/auth` | One method, `load(signal?)`, implemented by the shell. Called by the shell's bootstrap; remotes cannot reach it |
| `/react` hooks that do have a `reload()` | `useApi` (a data call) and `useAppUpdate` (a new deployment). Neither touches the session context |
| web-shell `src/app/bootstrap/bootstrap.tsx` | Holds the context in a private store (`createStore`, `context.set(...)`) and runs `applyContext()` (authz subject, flag provider, `rememberWorkspace`). Loaded once at start-up. The only periodic refresh found is the hourly **banner** refresh (`BANNER_REFRESH_MS`), which is not the session context |

Caveat: this was checked against the SDK copy in `web-shell/node_modules`, which reports `1.0.0-alpha.6`, while `package.json` pins `alpha.9`. Run `npm install` in web-shell and re-check `dist/react/index.d.ts` before acting. A refresh added in alpha.7–9 would change the answer; nothing in the web-shell sources suggests one exists.

## 2. Why mfe-admin needs it

P-35 roles are not in the token (IAM-UX-2). The remote's gating is a hint, so a stale hint must be corrected:

| Trigger | LLD | What the remote needs |
|---|---|---|
| The admin changes **their own** roles (P-28) | §7.5 | Reload P-35 so nav and buttons match the new roles at once |
| `403 DENY_ROLE_INSUFFICIENT` on any call | §11 | Reload P-35, then re-render with the corrected hints |
| Window focus after about 60 s | §8 | Reload P-35 so a role change made elsewhere shows up |

Without it, the admin who demotes themselves keeps seeing admin controls until a full page reload.

## 3. Options

| | Option | Change | Verdict |
|---|---|---|---|
| A | **SDK hook** `useRefreshSessionContext(): () => Promise<void>` in `/react`. The shell's `PlatformProvider` takes a `refreshContext` callback and implements it with `sessionContextSource.load()`, `context.set()` and `applyContext()` | `platform-reactcommon`: new hook, provider prop, contract test. web-shell: pass the callback, wire `applyContext` to run on every refresh, re-run `setAuthzSubject` and `setFlagProvider` | **Recommended.** Matches "remotes use SDK hooks only, no props". Works for every remote. MINOR SDK change |
| B | Shell refreshes by itself on `403 DENY_ROLE_INSUFFICIENT`, on focus after about 60 s, and after a successful write to the caller's own membership. Remote triggers nothing | web-shell only: needs an SDK hook or event to see another remote's `403` and own-role writes | Cannot cover "own role change" without a signal from the remote. Good as a **complement** for the `403` and focus triggers, since every remote benefits |
| C | Remote calls P-35 itself and keeps a local copy of the roles | `mfe-admin` only | **Rejected.** Two sources of truth; `useHasPermission` and `<Can>` would disagree with the remote's own copy. Also breaks "no P-35 adapter in the remote" (LLD §2.2) |
| D | Remote forces a full page reload after a self role change | `mfe-admin` only | Fallback only. Loses form state and flashes the whole shell |

## 4. Requested work

### 4.1 `platform-reactcommon` (Option A)

1. Add `useRefreshSessionContext()` to `/react`. Returns a stable function. Calls are **coalesced** (one P-35 request in flight; later callers share it) and **never throw to the caller**: on failure it keeps the old context and resolves `false` (or reports through `/logging`).
2. `PlatformProvider` gains an optional `refreshContext?: () => Promise<boolean>`. With none given, the hook's function resolves `false` and does nothing.
3. Re-render consumers of `useSessionContext`, `useHasPermission`, `useFeatureFlag`, `useReadOnly` and `<Can>` when the context changes. The hook must change identity of the returned context only when the content changed.
4. A refresh answered with `403` (suspended member, trial expired, tenant suspended) must not leave the stale context in place. Define what the SDK does: surface the same signal the shell's bootstrap uses for the A6/A8 screens, or hand the error to the shell's callback.
5. Contract test in the shell-and-remote harness: a remote calls the hook, the shell's store updates, the remote re-renders with new permissions.
6. Document it in the SDK README and design doc §C1, and add it to the `/react` subpath list. Release as a new alpha. web-shell upgrades first; remotes follow (remotes' SDK is never newer than the shell's).

### 4.2 `web-shell`

1. Pass `refreshContext` to `PlatformProvider`. Implementation: `sessionContextSource.load()` (not the no-retry variant, so the SDK's own retry and `Retry-After` apply), then `context.set(next)` and `applyContext()`.
2. If the new `slug` differs from the current workspace, treat it as the existing wrong-workspace case; never silently rebind.
3. Handle a refusal (`403`, `404 MEMBER_NOT_FOUND`) with the same screens the first load uses (A6, A8, access paused). Without this, a user who has just been suspended keeps a working-looking UI.
4. Complement (Option B, optional but cheap): refresh on window focus after about 60 s. Leave `403` handling to the remote's call so the two do not double-fire; the SDK's coalescing covers any overlap.
5. Update the web-shell LLD (§15) and CHANGELOG, and add the hook to the remote-contract list.

### 4.3 `mfe-admin` (after 4.1 and 4.2)

1. `useAdminAccess` calls the refresh after a successful P-28 on the caller's own user, and on `403 DENY_ROLE_INSUFFICIENT`.
2. A focus listener with a 60 s floor, or rely on web-shell 4.2(4) if that ships.
3. Tests: self-demotion hides the admin controls without a reload; a `403` triggers one refresh, not a loop; a failed refresh keeps the old hints and shows the generic error.
4. Update LLD §5 (SDK usage), §7.5, §8, §11, and close #15.

## 5. Behaviour rules (all parties)

- **At most one refresh at a time**; a second request while one is running joins it.
- **A `403` on the call that triggered a refresh is not retried.** Refresh, re-render, let the user act again. Looping on `403` would hammer P-35.
- **Rate floor** of about 60 s for the focus trigger only. Explicit triggers (own role change, `403`) are not rate-limited.
- **Failure keeps the old context** and logs a warning. It never blanks the UI or flips to deny-all, except for a refusal that means the user has no access (4.2 item 3).
- **The refresh is a hint correction, not a security control.** IAM and the gateway still decide every request (spec §2.2).

## 6. Risks and unknowns

| Risk | Note |
|---|---|
| SDK version drift | Local web-shell SDK copy is alpha.6, pinned alpha.9. Re-check before designing against it |
| IAM P-35 cache lag | IAM's caches may lag a role change by up to the service cache time. A refresh right after P-28 may still return the old roles. Needs an IAM answer (extend IAM-FE-Q2 or ask separately); until then the remote should treat a refresh that still shows the old roles as "applying" and retry once after a short delay, not loop |
| Other remotes | `mfe-tender`, `mfe-dashboard` and `mfe-me` probably need the same hook (`mfe-me` after changing own availability or delegations). Raise it with them so the SDK change is general |
| Release ordering | The SDK change must ship before web-shell uses it, and web-shell before any remote calls it |

## 7. Decisions needed

| # | Decision | Owner |
|---|---|---|
| a | Option A (SDK hook), with B's focus refresh as a shell-side complement? | platform-reactcommon, web-shell |
| b | What the SDK does when a refresh is refused with `403` (item 4.1.4) | platform-reactcommon, web-shell |
| c | Is a refresh right after P-28 reliable, or does IAM's P-35 cache lag? | IAM |
| d | Target SDK alpha for the hook, so `mfe-admin` can pin its peer range | platform-reactcommon |

## 8. References

- `mfe-admin/docs/lld/mfe-admin-lld.md` §5, §7.5, §8, §11, §15 #15
- `web-shell/src/app/bootstrap/bootstrap.tsx` (context store, `applyContext`), `web-shell/src/infrastructure/api/iam.ts` (`sessionContextSource`, `loadSessionContextOnce`)
- `@bcbp-solutions-fzc-llc/frontend-sdk` `dist/react/index.d.ts` (`useSessionContext`), `dist/types-*.d.ts` (`SessionContextSource`)
- `iam-product-screen-spec.md` §8, IAM-UX-2, IAM-FE-Q2

## 9. What shipped (2026-11-26)

- **SDK `1.0.0-alpha.10` (option A):** `useRefreshSessionContext()` in `/react`, stable, coalesced, never rejecting (a failure or a shell without `refreshContext` resolves `false`, one `warn`); `createTestPlatform({ refreshContext })` counts calls (`contextRefreshes`).
- **web-shell `0.5.0`:** passes `refreshContext` (loads P-35 at once, applies it, `true` when a new context was applied) and refreshes on window focus, at most once a minute (4.2 item 4, option B's complement).
- **mfe-admin:** `useSessionRefresh` is the SDK hook; `useTrackedMutation` calls it on `DENY_ROLE_INSUFFICIENT` and `RolesCard` after a successful change to the caller's own roles (no retry loop). Pins SDK, webpack-preset and eslint-plugin `1.0.0-alpha.10`. Tests: `test/unit/features/tracked.test.tsx`, `test/unit/pages/user-detail.test.tsx`.
- **Still open:** decision 7c (IAM P-35 cache lag after P-28), and the other remotes adopting the hook.
