# Metrics

The admin remote's metrics under the Enterprise Platform Observability Standard. **Status: implemented.** This page is the inventory the code must match: the metrics are defined in `src/infrastructure/telemetry/metrics.ts` and recorded through the platform SDK's `/metrics` (`getServiceMeter`), behind the `AdminTelemetry` port. Structure and rules follow [`mfe-dashboard`'s metrics page](../../../mfe-dashboard/docs/observability/metrics.md). `test/unit/metrics/metrics.test.tsx` fails when this page, the code and the SDK's rules disagree (§Rules).

## Tier

| Tier | Used here | Why |
|---|---|---|
| 1 `platform_*` | None of our own | The registry's platform metrics describe servers, messaging and databases. The browser's Core Web Vitals are recorded by web-shell's `startWebVitals()` for the whole page. The IAM services emit their own server-side metrics (for example request duration); this remote does not repeat them |
| 2 `iam_*` | None | Services must not invent shared metrics; a proposal goes to observability governance first. The registry has eight server-side `iam_*` entries and none overlaps (see "Checked against the SDK registry") |
| 3 `iam_admin_*` | All below | Behaviour only this remote has |

The SDK builds the scope: inside web-shell, `domain` is this remote's manifest `ownerDomain` (`iam`) and `service` is its name (`admin`), hence the prefix `iam_admin_`. It injects `domain`, `service` and `environment` on every point, so the code cannot omit or misspell them. The shell exports the points (`initializeMetrics`, OTLP to `/otel`, only with telemetry consent). The standalone page exports nothing. The registry's `iam` domain and the `admin` service name are valid (checked below); the remote must still be in the environment manifest with `ownerDomain: iam`, or the SDK drops the points and logs `admin metrics unavailable` once.

## Inventory

| Metric | Type | Labels (allowed values) | Meaning |
|---|---|---|---|
| `iam_admin_loads_total` | counter | `resource` (`members`, `user_profiles`, `invitations`, `seat_usage`, `departments`, `catalog`, `role_labels`, `group_mappings`, `settings`, `audit`, `audit_exports`), `outcome` (`success`, `error`) | Data loads that finished, by resource and outcome (`error` is an API, network or timeout fault). Loads superseded by a newer one are not counted |
| `iam_admin_load_duration_seconds` | histogram | `resource` (`members`, `user_profiles`, `invitations`, `seat_usage`, `departments`, `catalog`, `role_labels`, `group_mappings`, `settings`, `audit`, `audit_exports`), `outcome` (`success`, `error`) | Time from starting a load to its result. Superseded loads are not recorded |
| `iam_admin_actions_total` | counter | `action` (`invite`, `revoke_invitation`, `change_roles`, `suspend`, `reactivate`, `remove`, `resolve_removal`, `assign_department`, `remove_from_department`, `reset_mfa`, `update_profile`, `activate_department`, `retire_department`, `rename_role_labels`, `save_group_mappings`, `save_settings`, `save_delegation_policy`, `request_audit_export`), `outcome` (`success`, `failure`, `error`) | Admin writes that finished. `failure` is a business rejection (a rule refused it in the UI, or IAM answered a `4xx` such as `SEAT_LIMIT_REACHED`, `LAST_OWNER_REMOVAL`, a `409` conflict); `error` is a fault (`5xx`, network, timeout, `503` service unavailable) |
| `iam_admin_action_duration_seconds` | histogram | `action` (`invite`, `revoke_invitation`, `change_roles`, `suspend`, `reactivate`, `remove`, `resolve_removal`, `assign_department`, `remove_from_department`, `reset_mfa`, `update_profile`, `activate_department`, `retire_department`, `rename_role_labels`, `save_group_mappings`, `save_settings`, `save_delegation_policy`, `request_audit_export`), `outcome` (`success`, `failure`, `error`) | Time from sending an admin write to its result |
| `iam_admin_step_up_requests_total` | counter | `action` (`reset_mfa`) | Re-authentication (MFA step-up) requests started from an admin action. Other gateway-guarded actions join the label when they are built |

Plus `domain`, `service` and `environment` on every series (SDK).

**Labels never carry** a user, member, tenant, department or invitation ID, an email, a path or a free-text value (prohibited by the standard: `*_id`, `email`, `user`, `path`, …). `action` and `resource` come from closed sets in `domain/events/admin-events.ts` (`ADMIN_ACTIONS`, `LOAD_RESOURCES`, `ACTION_OUTCOMES`, `STEP_UP_ACTIONS`); a new value is added there and on this page in the same PR. E4 (SSO) has no entries this release because it is wireframe-only (LLD §2.1); its actions are added when it is built.

Cardinality per environment: at most 11 × 2 = 22 series for the load counter and 22 for its histogram; 18 × 3 = 54 for the action counter and 54 for its histogram; about 1 to 2 for step-up. Histogram buckets are the registry's `request_duration` preset. `outcome` uses the registry's vocabulary: `success`, `failure` (business rejections) and `error` (faults). A load has no business rejection, so it uses only `success` and `error`.

Not metrics, on purpose: page views and route changes (web-shell and the SDK name routes by template through `useRouteTemplate`), per-user or per-tenant activity (use the audit log, which IAM owns), and API latency by route (the SDK `/http` and the API's own `platform_http_request_duration_seconds` cover it).

Unlike `mfe-dashboard` (fixtures today), the admin remote has a real backend from its first commit, so these metrics measure real IAM calls from day one.

## Where the code records them

The application layer defines the `AdminTelemetry` port (`application/ports/telemetry.ts`); the closed value sets stay in `domain/events/admin-events.ts`. `infrastructure/telemetry/metrics.ts` is the adapter and the only file that imports `/metrics`. Presentation and application never import it (enforced by arch-lint and `test/unit/architecture/layers.test.ts`). Instruments are made per call, not at module scope (the SDK binds an instrument to the runtime it was made in; the SDK keeps one per name), as in `mfe-dashboard`.

| Event | Port call | Metric |
|---|---|---|
| A query starts and finishes | `loadStarted(resource)` then `success` / `error` | `loads_total`, `load_duration_seconds` |
| A command is sent | `actionStarted(action)` then `success` / `failure` / `error` | `actions_total`, `action_duration_seconds` |
| The user starts step-up | `stepUpRequested(action)` | `step_up_requests_total` |

The problem-to-outcome map in `infrastructure/api/problem.ts` (LLD §11) decides `failure` versus `error`, so the rule is in one place.

## Rules (checked in CI)

`npm test` runs `test/unit/metrics/metrics.test.tsx`. CI's `Validate / Test` job runs it on every PR. It checks:

| Rule | Check |
|---|---|
| Namespace | Every name starts with `iam_admin_`; none is a `platform_*`, a registry metric (any tier) or a legacy name |
| Suffix | Counters end in `_total`, histograms in `_seconds` |
| Required labels | `domain`, `service`, `environment` are not declared (the SDK injects them) and appear on every recorded series with `iam` / `admin` |
| Prohibited labels | No registry-prohibited name or suffix (`*_id`, `email`, `user`, `path`, …); at most 8 labels |
| Label vocabulary | Every label has a closed value set, enforced by `recordMetric`'s types; `outcome` values come from the registry's vocabulary, and the SDK drops a value outside it at run time (it also caps any other label at 100 values) |
| SDK compliance | With the remote in the manifest, the SDK accepts every definition |
| Inventory | This table matches `src/infrastructure/telemetry/metrics.ts` and `domain/events/admin-events.ts` |

## Dashboards, alerts, recording rules and SLOs (proposals)

This repository does not hold the platform's Prometheus or Grafana configuration. Whoever owns the frontend dashboards can start from these. Series arrive with OTLP delta temporality and are stored as Prometheus counters and histograms.

```promql
# Recording rules
iam_admin:loads:rate5m = sum by (environment, resource, outcome) (rate(iam_admin_loads_total[5m]))
iam_admin:load_errors:ratio5m =
  sum by (environment) (rate(iam_admin_loads_total{outcome="error"}[5m]))
  / sum by (environment) (rate(iam_admin_loads_total[5m]))
iam_admin:action_errors:ratio5m =
  sum by (environment) (rate(iam_admin_actions_total{outcome="error"}[5m]))
  / sum by (environment) (rate(iam_admin_actions_total[5m]))
iam_admin:load_duration:p95_5m =
  histogram_quantile(0.95, sum by (environment, le) (rate(iam_admin_load_duration_seconds_bucket{outcome="success"}[5m])))
```

| Proposal | Expression | Threshold |
|---|---|---|
| Alert: loads failing | `iam_admin:load_errors:ratio5m` | > 5% for 10 min, with at least 20 loads in the window |
| Alert: actions failing | `iam_admin:action_errors:ratio5m` (only `error`, never `failure`) | > 5% for 10 min, with at least 10 actions in the window |
| Alert: loads slow | `iam_admin:load_duration:p95_5m` | > 3 s for 15 min |
| SLO: availability | successful / all `iam_admin_loads_total` | 99.5% over 28 days |
| SLO: latency | share of successful loads under 2 s (`le="2"` bucket) | 95% over 28 days |

`failure` is deliberately outside every error ratio: a refused invitation at the seat limit is the product working, not an outage. A rise in `failure` for one `action` is a product signal (for example many `SEAT_LIMIT_REACHED`), not an alert. Thresholds are starting points, to be set once there is real traffic. Browser metrics depend on consent, so absolute counts undercount traffic: alert on ratios, not on volume.

**HPA:** not applicable. The remote is static files (S3/CloudFront, or nginx); nothing scales on these metrics.

## Runbook

| Symptom | Check |
|---|---|
| No `iam_admin_*` series at all | Is the remote in the environment's `/remotes/manifest.json` with `ownerDomain: "iam"`? Without it the SDK cannot scope the metrics and the console shows `admin metrics unavailable` once. Is the registry's `iam` domain accepting a service named `admin` (LLD §15 #9)? Is the shell's telemetry enabled (`runtime.json` `telemetry.enabled`) and is `/otel` routed to the collector? Did the user grant telemetry consent? |
| Series under another `domain` or `service` | The manifest key or `ownerDomain` changed. The SDK's prefix check then drops the points. Fix the manifest; renaming the metrics is a contract change |
| Load error ratio up | Look at the matching warn logs (same `resource`; they carry the SDK's problem type and request id), then the IAM service's own metrics for the same window |
| Action `error` ratio up | Same logs; check `503 *_UNAVAILABLE` codes (Workflow, Realm Provisioner, DB) in IAM |
| `failure` up for one action | Not an outage. Read the problem `errorCode` in the logs (seat limit, last owner, conflict) |
| p95 up | Compare with web-shell's Core Web Vitals and the API's `platform_http_request_duration_seconds` for the same window |

## Changing a metric

Names, labels and their values are part of the observability contract. Adding a metric or a label value: add it to `src/infrastructure/telemetry/metrics.ts`, `domain/events/admin-events.ts` and this table in the same PR. Renaming or removing one: emit old and new in parallel, move dashboards, alerts, recording rules and SLOs, then remove the old one after the agreed sunset (the standard's migration process), with a CHANGELOG entry at each step. A metric that other services could emit with the same meaning is proposed to the Platform Observability Registry, not added here as Tier 3.

## Checked against the SDK registry (2026-11-25)

Source: `platform-reactcommon/packages/frontend-sdk/contracts/{metric-registry,registry-vocab}.json`.

| Check | Result |
|---|---|
| `iam` is a registry domain | Yes (`iam, workflow, billing, tender_management, notifications, documents, bff, portal`) |
| `admin` fits the service pattern `^[a-z][a-z0-9_-]{0,62}$` | Yes |
| A registry metric named `iam_admin_*` | None. No collision |
| Tier 2 `iam_*` metrics that overlap | None. The eight entries (`iam_auth_events_total`, `iam_tenant_resolution_total`, `iam_identity_sync_total`, `iam_realm_operations_total`, `iam_rls_violations_total`, `iam_auth_session_revoke_failed_total`, `iam_lifecycle_event_skipped_total`, `iam_lifecycle_event_lag_seconds`) are server-side and status `proposed` |
| Prohibited labels and suffixes | `resource`, `action`, `outcome` are allowed (prohibited: `user_id`, `email`, `tenant_id`, `actor`, `path`, `url`, `subject`, any `*_id`, …) |
| `outcome` vocabulary | `success`, `failure`, `error`, as used here |
| Custom labels | `action` and `resource` are not registry labels, so the SDK caps each at 100 values (as the dashboard's `view` and `trigger`). The registry does define `operation` (pattern `^[A-Za-z][A-Za-z0-9_.-]{0,63}$`, max 100 values); using it instead of `action` is an option |
| Buckets | `request_duration` preset |

## Open (LLD §15 #9)

1. Decide: keep the custom `action` and `resource` labels, or use the registered `operation` label.
2. An owner for the recording rules, alerts, SLOs and the Grafana dashboard.
3. ~~Fix the final `ADMIN_ACTIONS` and `LOAD_RESOURCES` values.~~ Done: they are in `src/domain/events/admin-events.ts` (18 actions, 11 resources) and this page matches them; a change goes in the code first, then here (`metrics.test.tsx` fails otherwise).
