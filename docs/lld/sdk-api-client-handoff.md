# Handoff: Two ApiClient limits found building the IAM adapters (mfe-admin LLD §15 #18)

| Field | Value |
|---|---|
| Date | 25 November 2026 |
| From | `mfe-admin` |
| To | `platform-reactcommon` (SDK `/http`) |
| Purpose | Two things the IAM services need that the SDK's `ApiClient` cannot send as written. Both have a workaround in `mfe-admin`; neither is a blocker |
| Checked against | `@bcbp-solutions-fzc-llc/frontend-sdk` `1.0.0-alpha.9`, `dist` of `/http` (`buildUrl`), and by running the adapters through the real client in `test/contract` |

## 1. `/users:batch`: a colon in a route template is read as a path parameter

**What IAM exposes:** User Profile's batch lookup is `POST /api/v1/users:batch` (a Google-style custom method). Every list screen needs it (E1, pickers, chips: IAM-UX-4).

**What the client does:** `buildUrl` replaces every `:name` in the template with a parameter (`/:([A-Za-z_][A-Za-z0-9_]*)/g`). So `/v1/users:batch` is the template `/v1/users` plus a parameter `:batch`: the call throws `route template … needs param :batch` unless `batch` is passed, and the replacement drops the colon (`/usersbatch`).

**Workaround in `mfe-admin`:** pass the literal `:batch` as that parameter. The client percent-encodes it, so the request goes to `/api/v1/users%3Abatch`. A server that decodes the path before routing serves it as `/users:batch`. Proven in `test/contract/adapters.contract.test.ts` ("the percent-encoded custom method"), but **only against the client**, not against the gateway or the service.

**Risk:** if the gateway (CloudFront, the ingress) or User Profile routes on the raw path, `users%3Abatch` is a 404 and no list screen can show a name.

**Ask:** treat `:name` as a parameter only at the start of a path segment (`(?<=/):name`), so `/users:batch` is a literal. A template that wants a colon after a slash can escape it. This is a non-breaking change for every template that exists today.

**To check, before first release:** call `POST /api/v1/users%3Abatch` through the real gateway in a dev environment and confirm `200`. Owner: IAM (User Profile) and platform deployment.

## 2. A query value cannot be repeated (`collectionFormat: multi`)

**What IAM exposes:** Audit Log's `GET /api/v1/audit/events` takes `entry_type` repeated (`?entry_type=a&entry_type=b`, `collectionFormat: multi`). Spec E7 filters by several entry types.

**What the client does:** `RequestOptions.query` is `Record<string, string | number | boolean | undefined>` and `buildUrl` appends `String(v)`, so an array would become one comma-joined value the service does not match.

**Workaround in `mfe-admin`:** a search takes **one** entry type (`MAX_SEARCH_ENTRY_TYPES = 1` in `domain/rules/admin-rules.ts`; `planAuditQuery` refuses more with `one-entry-type-only`). **Exports are not limited:** they take a JSON body (`entry_type: string[]`).

**Ask:** allow an array value in `query` and append each element under the same key. Non-breaking.

**When it ships:** raise `MAX_SEARCH_ENTRY_TYPES` and send the list in `toAuditQuery`; the contract test already checks the request against the Swagger.

## Also checked, and fine

- `DELETE` with a JSON body (revoke invitation sends `{ "record_version": n }`): sent as written.
- `PUT` and `PATCH` bodies, `202` answers, and `204` with no body: read correctly.
- The client's own retry does not retry a write (verified for `POST` on `503`): one request goes out.

## Decisions needed

| # | Decision | Owner |
|---|---|---|
| a | Fix the colon rule in `buildUrl` (section 1)? | platform-reactcommon |
| b | Allow repeated query keys (section 2)? | platform-reactcommon |
| c | Confirm `users%3Abatch` is served end to end | IAM, platform deployment |
