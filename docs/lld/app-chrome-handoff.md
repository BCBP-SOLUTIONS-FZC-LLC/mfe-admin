# Handoff: App Chrome Ownership (mfe-admin LLD §15 #2)

| Field | Value |
|---|---|
| Date | 25 November 2026 |
| From | `mfe-admin` |
| To | Frontend platform, `web-shell`, `platform-reactcommon`; copied to `mfe-tender`, `mfe-dashboard`, `mfe-me` |
| Purpose | Record the `mfe-admin` position on app chrome and what the platform must decide. `mfe-admin` is not blocked by it |
| Related | [mfe-admin-lld.md](mfe-admin-lld.md) §2.1, §2.2, §7.12, §15 #2; [web-shell-iam-handoff.md](web-shell-iam-handoff.md) §1, §3.3 a |

## 1. Decision for `mfe-admin` (resolved 2026-11-25)

- The remote ships **only its own section navigation** inside `/t/<slug>/admin/*` (`AdminLayout`).
- The remote does **not** draw the global header, the user menu or the workspace switcher, and does not own the admin entry point in a global menu.
- Ownership of that chrome is **unassigned**. It is outside the IAM remotes' scope. The shell or platform layer takes it once ownership is decided.
- `mfe-admin` does not wait for the decision. It builds against SDK hooks only, so either outcome fits without a MAJOR change (§4).

## 2. Current state (checked 2026-11-25)

| Item | Finding |
|---|---|
| `web-shell` | Has **no** header, nav, user menu, sign-out control or workspace switcher. It owns sign-in, session screens, banners and a bottom notice stack (publishes `--shell-notices-height`) |
| `mfe-tender` | Draws its own chrome: sidebar, search, theme picker, language and profile dialogs, user menu, logout, signed-out banner (`AppShellLayout`) |
| `mfe-dashboard` | Draws its own fixed sidebar (`AppShellLayout`); web-shell LLD §15 #21 already notes it sits under the shell's notice stack |
| `mfe-admin` | Section nav only (decided above) |
| `mfe-me` | Not built; would need the same answer |

Result today: each remote that draws chrome has its own copy, and a user moving between `/dashboard`, `/tenders` and `/admin` sees different frames. Nothing links `/admin` or `/me` from anywhere.

## 3. What is unowned

| Chrome element | Needed by IAM | Today |
|---|---|---|
| Global header | Frame for all remotes | Per remote, or none |
| User menu (links to `/me`, sign-out) | Entry to G1–G6 | `mfe-tender` has its own; nothing else |
| Workspace switcher | Multi-workspace users (`useSwitchWorkspace`, SDK) | Not built in any remote or the shell |
| Admin entry point | Reach `/admin/users` for users with admin permissions | None. No link exists anywhere |
| Language and theme controls | Spec G-screens, all remotes | `mfe-tender` only |
| Signed-out banner | Shown after idle or expiry | `mfe-tender`; the shell shows its own sign-in screens |

**Consequence for IAM:** until an owner is named, there is no way for a user to *find* `/admin` or `/me` except typing the URL, and a tenant admin on a fresh workspace gets no visible path to invite users (E1a). This is a release-readiness gap, not a build blocker.

## 4. Contract `mfe-admin` assumes (so either owner can fit)

1. The remote is mounted with **no props** and gets nothing from the chrome (LLD §4.3). Chrome must not require a prop, a slot or a context from the remote.
2. Its section nav is **inside the page area**, under whatever global header exists. It never uses `position: fixed` against the viewport edge without honouring `--shell-notices-height` (web-shell LLD §15 #21 pattern).
3. It reads user, workspace, sign-out and switch through SDK hooks (`useCurrentUser`, `useWorkspace`, `useSignOut`, `useSwitchWorkspace`). If the shell or platform owns chrome, those same hooks are what the chrome uses.
4. Routes stay `/t/<slug>/admin/*`. The admin entry point, wherever it lives, links there by **full navigation** (separate routers, LLD §15 #6). The permission hint for showing the link is `manage:members` or any of the eight admin permissions via `useHasPermission` (the remote's own `useAdminAccess` rule; the chrome should reuse the same rule, not re-derive it from role names).
5. If the chrome later renders a global header, `AdminLayout` drops nothing and adds nothing; only the remote's own section nav stays.
6. Per-page `MFEErrorBoundary` and the read-only wrapper stay in the remote. The global header's read-only notice comes from the shell's banners, not from the remote (LLD §7.11).

## 5. Options for the platform

| | Option | Pros | Cons |
|---|---|---|---|
| A | **web-shell owns a global frame** (header, user menu, workspace switcher, admin and `me` entry points) around `RemoteBoundary` | One frame, one switcher, one place for `/admin` and `/me` links. Remotes shrink to section nav | web-shell gains UI beyond sign-in. Needs a design, i18n, nav registry. Existing remotes must drop their own chrome and their fixed sidebars |
| B | **Shared chrome component in the SDK or a platform package**, each remote renders it | Remotes stay self-contained. No shell change | Every remote must adopt it. Version skew across remotes. No UI library exists (`platform-design-system` unpublished; ADR 0003) |
| C | **Status quo**: each remote draws its own | No work | Divergent frames, no admin entry point, no workspace switcher; `mfe-admin` and `mfe-me` would each add a third and fourth copy |

Recommendation from `mfe-admin`'s side: **A**, with the shell reading a small **nav registry** from the manifest (label key, path, permission hint) so each remote declares its entries and the shell renders them. This is a suggestion; `mfe-admin` works under any option.

## 6. Decisions needed

| # | Decision | Owner |
|---|---|---|
| a | Who owns the global header, user menu and workspace switcher (A, B or C)? | Frontend platform |
| b | Who owns the admin entry point and the `/me` link, and what permission hint decides visibility? | Frontend platform, IAM |
| c | If A or B: a design and ownership of a shared nav registry or component | Frontend platform, design |
| d | Migration of `mfe-tender` and `mfe-dashboard` chrome, so there is no double header | `mfe-tender`, `mfe-dashboard` |
| e | Interim: should the shell add a **plain link list** (Dashboard, Tenders, Admin, Me) before the full design, so `/admin` is reachable at first release? | web-shell |

## 7. What `mfe-admin` does meanwhile

- Builds `AdminLayout` with the section nav only: Users, Departments, Single sign-on (hidden until E4 is built), Group mappings, Settings, Audit log, each gated by `useHasPermission`.
- Uses no global-header element, user menu or workspace switcher.
- Keeps sign-out available only through `useSignOut()` where a screen needs it (LLD §7.12), without a visible menu of its own.
- Re-checks this handoff when the owner is named; no `mfe-admin` code change is expected unless the owner picks option B.

## 8. References

- `mfe-admin/docs/lld/mfe-admin-lld.md` §2.1, §2.2, §3, §4.3, §7.11, §7.12, §15 #2 and #6
- `mfe-admin/docs/lld/web-shell-iam-handoff.md` §1, §3.3 a
- `mfe-tender/docs/lld/mfe-tender-lld.md` (`AppShellLayout`, chrome in §2)
- `web-shell/docs/lld/web-shell-lld.md` §4.5, §15 #21 (`--shell-notices-height`)
