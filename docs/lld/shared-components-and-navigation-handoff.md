# Handoff: Shared Identity Components and Cross-Remote Navigation (mfe-admin LLD §15 #5 and #6)

| Field | Value |
|---|---|
| Date | 25 November 2026 |
| From | `mfe-admin` |
| To | Frontend platform, `platform-reactcommon`, `web-shell`; copied to `mfe-me`, `mfe-tender`, `mfe-dashboard` |
| Purpose | Record two decisions and what each team must do: (1) shared identity components move to a common package **before implementation**; (2) cross-remote navigation goes through the shell's router, not full-page loads |
| Related | [mfe-admin-lld.md](mfe-admin-lld.md) §2.3, §4.2, §4.4, §5, §15 #5 and #6; [app-chrome-handoff.md](app-chrome-handoff.md); [web-shell-iam-handoff.md](web-shell-iam-handoff.md) |

## 1. Decisions (resolved 2026-11-25)

| # | Decision | Reason |
|---|---|---|
| 5 | Because IAM is split into `admin` and `me`, the shared identity components are **extracted into a common package before implementation**. No remote builds its own copy | Two IAM remotes plus `mfe-tender` and `mfe-dashboard` all need the user chip and picker; bundled copies would duplicate code and the 60 s `users:batch` cache |
| 6 | The **shell owns top-level routing**. Cross-remote navigation goes through **shell-managed routes**, avoiding full-page navigations | One router at the top; remotes keep their own router only below their mount |

## 2. Part A: Shared identity components

### 2.1 Scope (from LLD §15 #5)

| Component | Used by | Notes |
|---|---|---|
| User chip (avatar, name, status) | admin, me, tender, dashboard | Resolves a user ID through `POST /users:batch` |
| Department label | admin, me, tender | Uses the tenant's level labels (P-12), not the catalogue's |
| Member picker | admin (E5, E2 header), tender (C16, approvers), me (delegations) | The largest shared piece |
| Seat meter | admin (E1) only today | Candidate; may stay in `mfe-admin` unless a second user appears |
| Role badges | admin, me | Closed role names only; display strings translated by the consumer |
| Conflict dialog and resolution dialogs (`409`, last owner, impact review) | admin, me | Candidates; check the second user before extracting |
| Read-only wrapper | all remotes | **Overlaps the shell's own read-only notice**; decide with web-shell whether it belongs in the SDK instead |
| Direct uploader | admin (E6 logo), me (G1 photo) | |

Rule for what moves: extract only what **two or more remotes** use. Seat meter and E1-only dialogs stay in `mfe-admin` until a second consumer exists. This keeps the package small and the first release unblocked.

### 2.2 Constraints on the package

| Constraint | Why |
|---|---|
| No UI library exists (`platform-design-system` unpublished; ADR 0003). Components use Tailwind 4 and daisyUI 5 class names, as each remote does today | Avoid inventing a design system here |
| Imports SDK public subpaths only, never deep paths; no direct `fetch`, storage or token access | Same lint rules as remotes (`no-sdk-duplicates`, raw-storage, identity headers) |
| Data comes in through **ports passed in** (an `IdentityDirectory` with `getUsers(ids)`, `search(query)`), not through a hardcoded HTTP client | Keeps the package free of IAM URLs; each remote wires `ApiClient` once |
| i18n: components take **message keys or a `messages` object**, with default English strings, and the consumer's namespace supplies the translations | The `admin` and `me` catalogues stay separate |
| Peer-depends on React, React DOM and the SDK; **no router import** | A router-free package works under any remote router |
| Not a federated remote and not a shared singleton by default | See 2.3 |
| A11y: keyboard, labels, focus return; one test suite owned by the package | Spec §7 shared components |
| Semver, with a CHANGELOG, published to the same registry as the SDK | Remotes pin ranges |

### 2.3 The cache question

"Common package" means shared **code**, not shared **state**. Each remote still has its own bundle copy and its own TanStack Query cache (ADR 0001: one `QueryClient` per mount). So the 60 s `users:batch` duplicate-request problem in LLD §15 #5 is **reduced** (one implementation) but **not removed**: moving from `/admin` to `/tenders` re-fetches the same profiles.

Choose one:

| | Option | Effect |
|---|---|---|
| 1 | **Accept it** | Simple. A user list reloads on cross-remote moves. Acceptable at the service's 60 s cache and 200-ID batches |
| 2 | Package is a **Module Federation shared singleton** (`sharedFor` in the preset) holding a shared cache | One cache across remotes. Needs a `platform-reactcommon` preset change and strict version alignment, and couples remotes at runtime |

`mfe-admin` assumes **option 1** and builds nothing that prevents option 2 later.

### 2.4 Package name, owner and home

| Item | Proposal | Owner |
|---|---|---|
| Name | `@bcbp-solutions-fzc-llc/iam-ui` (placeholder) | Frontend platform |
| Repo | New repo, or a package folder inside `platform-reactcommon` | Frontend platform |
| Maintainer | IAM frontend (the `mfe-admin` and `mfe-me` teams) with a platform reviewer | Frontend platform |
| Release | Alpha tags matching the SDK alpha train; shell is not involved, since it is bundled into each remote | Frontend platform |

### 2.5 Work

1. Decide the name, home, owner and the cache option (2.3).
2. **Before any `mfe-admin` or `mfe-me` code that renders a user, department or picker:** publish a first alpha with the user chip, department label and member picker, plus an in-memory fake `IdentityDirectory` for tests and Storybook-less development.
3. `mfe-tender` and `mfe-dashboard`: replace their local chip or picker with the package when convenient. Not a blocker; record it in their LLDs.
4. `mfe-admin` and `mfe-me`: depend on the package, supply the directory port (one `ApiClient` adapter each, or a shared adapter inside the package if the platform prefers), and keep nothing duplicate.
5. LLD edits in `mfe-admin` after publish: §3 layout (remove a local `components/identity` folder), §5 (add the package), §6 ports, §14 (contract test against the fake directory).

## 3. Part B: Cross-remote navigation through the shell

### 3.1 What the SDK and the shell already do (checked 2026-11-25)

| Piece | Finding |
|---|---|
| SDK `/nav` `navigate(appId, path, { replace? })` | Navigates **through the shell's router**. Without a registered router (a remote run standalone) it falls back to a full page load. An unsafe path throws `TypeError` (`isSafeRedirect`) |
| web-shell | Registers the navigator at bootstrap (`registerNavigator(shellNavigator(navigate, base))` in `bootstrap.tsx`; `src/infrastructure/federation/navigator.ts`) |
| Shell navigator behaviour | A path **under the router basename** (e.g. `/t/acme/...`) is a **router navigation** (no page load). Any other same-origin path, such as another workspace, is a **full page load**. It **ignores `appId`**; the path decides |
| Route ownership | Shell has `RemoteBoundary` routes per remote (`/dashboard/*`, `/tenders/*`, ...). `/admin/*` and `/me/*` are **not added yet** (web-shell handoff §3.1 item 2) |

**This corrects LLD §4.4**, which said the `/dashboard/user-management` redirect "must be a full navigation (SDK `/nav` `navigate`)". With the shell's navigator, `navigate()` is **not** a full page load for same-workspace paths. The LLD is edited accordingly.

### 3.2 Rules for `mfe-admin` and `mfe-me`

1. **Across remotes:** use SDK `navigate(appId, path)` with the **full path including the workspace prefix**, e.g. `navigate('me', '/t/acme/me/profile')`. Build the prefix from `useSessionContext().slug`; never hardcode it.
2. **Within a remote:** use the remote's own router (`Link`, `useNavigate`). Do not call SDK `navigate` for a same-remote move.
3. **Plain `<a href>` to another remote is a bug** (full page load, loses state). Lint or review should reject it. `window.location` assignments are limited to auth redirects handled by the SDK.
4. **No remote may import another remote's routes or `react-router-dom` singleton.** `react-router-dom` stays unshared.
5. **Standalone** (`npm run dev`): the SDK falls back to a full load; acceptable, and covered by a test.
6. Deep links into a remote (`/t/acme/admin/users/<id>`) must work on a cold load as well as on an in-app move.
7. Each route a remote advertises to others is part of its contract (§4.4 of the LLD); renaming one is a SemVer change.

### 3.3 Known gap to confirm: same-remote moves driven by the shell

The remote has its **own** `BrowserRouter` (LLD §4.4). When the shell's router handles a move **between two paths inside the same mounted remote** (for example the shell, or another remote, calls `navigate('admin', '/t/acme/admin/users')` while `admin` is already showing `/admin/settings`), the shell's router updates the URL and the shell's route stays mounted. The remote's own `BrowserRouter` is not told: React Router history listens to `popstate`, which `pushState` does not fire.

Likely effect: the address bar changes but the page does not. Cross-remote moves are fine (the old remote unmounts, the new one mounts and reads the URL).

To confirm (web-shell, `mfe-admin`) with a real mount, then pick one:

| | Fix | Where |
|---|---|---|
| a | Shell's navigator **remounts or keys** the `RemoteBoundary` by remote path when the target is inside a mounted remote | web-shell |
| b | Shell dispatches a `popstate` after a router navigation into a mounted remote | web-shell (small, but a platform-wide behaviour change) |
| c | Remotes do not call SDK `navigate` for their own paths (rule 2 above), and others avoid it for a mounted remote | convention only; fragile |
| d | The shell hands the remote's router the shell's own history (a shared router singleton) | `platform-reactcommon`, `web-shell`. **Largest change**: that was the original option in LLD §15 #6 and is not needed if a or b is enough |

`mfe-admin` assumes **(a) or (b)** is added by web-shell and builds nothing on option d.

### 3.4 Work

| Team | Work |
|---|---|
| web-shell | Add `/admin/*` and `/me/*` `RemoteBoundary` routes (handoff §3.1 item 2); verify and fix 3.3 with a browser contract spec (`admin` mounted, shell navigates inside it); keep the navigator ignoring `appId` or document the mapping |
| platform-reactcommon | Document the `navigate()` contract and the "path decides" rule in the SDK README; add a lint rule or test against root-relative `<a href>` between remotes if feasible |
| `mfe-admin` | Use `navigate()` for cross-remote links only, with the slug-prefixed path; contract test with a mocked navigator and a standalone fallback test; remove the "must be a full navigation" wording (done in the LLD) |
| `mfe-dashboard` | The `/dashboard/user-management` → `/admin/users` redirect uses `navigate('admin', '/t/<slug>/admin/users', { replace: true })`, kept for one release after E1 ships |
| `mfe-tender` | C16 and approver pickers link into IAM only through `navigate()`; open item #13 in its LLD closes with the same rule |
| `mfe-me` | Same rules as `mfe-admin` |

## 4. Order of work

1. Frontend platform names the package, its home and owner, and picks the cache option (2.4, 2.3).
2. Package alpha with user chip, department label, member picker and the fake directory (2.5 item 2).
3. web-shell adds the `/admin/*` and `/me/*` routes, and confirms or fixes 3.3.
4. `mfe-admin` and `mfe-me` start building on the package and `navigate()`.
5. Consumers in `mfe-tender` and `mfe-dashboard` migrate afterwards.

Steps 1 and 2 **block** IAM screens that show people. Step 3 blocks only cross-remote links and the mount itself.

## 5. Decisions needed

| # | Decision | Owner |
|---|---|---|
| a | Package name, repo or folder, maintainer | Frontend platform |
| b | Shared code only (assumed), or a federated singleton with a shared cache (2.3) | Frontend platform, platform-reactcommon |
| c | Which components move now, and whether the read-only wrapper becomes an SDK feature | Frontend platform, web-shell |
| d | The fix for same-remote moves driven by the shell (3.3 a, b or c) | web-shell |
| e | `appId` handling in the shell navigator: keep ignoring it, or map it to a prefix | web-shell |
| f | Whether to add lint enforcement against cross-remote `<a href>` | platform-reactcommon |

## 6. Risks

| Risk | Note |
|---|---|
| The package becomes a design system by accident | Keep scope to identity components used by two or more remotes (2.1 rule) |
| Package blocks IAM screens | Step 2 is on the critical path; ship a small alpha early and extend it |
| Version skew | Each remote bundles its own copy, so two remotes may ship different package versions on one page. Visible behaviour must not depend on the version (same props, same ports) |
| Same-remote navigation gap (3.3) not found until late | Add the browser contract spec first, before cross-remote links ship |
| Local SDK copy is alpha.6 while `package.json` pins alpha.9 | The `/nav` check was against the installed copy and the shell source. Reconfirm after `npm install` |

## 7. References

- `mfe-admin/docs/lld/mfe-admin-lld.md` §2.3, §4.2, §4.4, §5, §15 #5 and #6
- `web-shell/src/infrastructure/federation/navigator.ts`, `web-shell/src/app/bootstrap/bootstrap.tsx` (`registerNavigator`), `web-shell/src/app/routes/App.tsx` (`RouterBridge`)
- `@bcbp-solutions-fzc-llc/frontend-sdk` `dist/nav/index.d.ts`
- `mfe-tender/docs/lld/mfe-tender-lld.md` (open item #13, same router issue)
- [ADR 0001](../adr/0001-server-state-with-tanstack-query.md)
