# Versioning

This repository is a **deployed micro-frontend remote**, not an npm library. `package.json` is `"private": true`; its `name` (`mfe-admin`) identifies the repository. The versioned artifacts are the container image `ghcr.io/bcbp-solutions-fzc-llc/mfe-admin` and the release `dist` tarball. SemVer applies to the **runtime contract** with web-shell and the platform (LLD §4).

| Change | Version |
|---|---|
| Renaming the container (`admin`) or its global (`__platform_mfe_admin`); removing `./App` or adding a required prop; a route removed or renamed; `ownerDomain` changed; a metric renamed or removed (`docs/observability/metrics.md`) | **MAJOR** |
| A new route, screen, permission key the shell must grant, shared SDK subpath, or metric label value | **MINOR** |
| Fixes and changes inside a screen with no contract effect | **PATCH** |

The contract, in full, is `docs/lld/mfe-admin-lld.md` §4:

- **Container:** name `admin`, `remoteEntry.js`, `var __platform_mfe_admin` defined synchronously, `exposes['./App']`.
- **Routes:** `/t/<slug>/admin/{users,users/:userId,departments,group-mappings,settings,audit,audit/exports}`; standalone `/admin/*`.
- **Platform packages:** `webpack-preset`, `eslint-plugin` and `frontend-sdk` are equal, and never newer than web-shell's.
- **Release assets:** `mfe-admin_vX.Y.Z_dist.tar.gz`, `mfe-admin_vX.Y.Z_remote-manifest-entry.json` (`entry`, `version`, `ownerDomain` `iam`, sha384 `integrity`), `checksums.txt`, `provenance.slsa.json`, `sbom.cyclonedx.json`.
- **Metrics:** names, labels and label values in `docs/observability/metrics.md`.

## Compatibility

| mfe-admin | Container / manifest key | Platform packages | Needs web-shell |
|---|---|---|---|
| *next* (`main`) | `admin` | `1.0.0-alpha.10` | on alpha.10 (web-shell `0.5.0`), with the `/admin/*` route |

See [CHANGELOG.md](CHANGELOG.md) for what each release changed.
