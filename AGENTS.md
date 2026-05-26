# AGENTS.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A Backstage frontend plugin (`@red-hat-developer-hub/backstage-plugin-sandbox`) providing the Developer Sandbox experience for Red Hat Developer Hub. It is a Yarn workspaces monorepo, though the sole workspace with source code is `plugins/sandbox`.

## Commands

### Development

```sh
yarn install              # install dependencies
yarn dev                  # start frontend + backend in parallel
yarn start                # start frontend only
```

### Build

```sh
yarn build:all            # build all packages
yarn tsc:full             # full type-check (no incremental)
```

### Test

```sh
yarn test                 # run unit tests (via backstage-cli repo test)
yarn test:all             # run all tests with coverage
yarn workspace @red-hat-developer-hub/backstage-plugin-sandbox test   # run plugin tests only
yarn backstage-cli package test -- --testPathPattern="<pattern>"      # run a single test file (from plugins/sandbox/)
```

Tests use Jest via `backstage-cli`, `@testing-library/react`, and MSW for API mocking. Test files live in `__tests__/` directories next to the code they test.

### Lint & Format

```sh
yarn lint                 # lint changed files (since origin/master)
yarn lint:all             # lint everything
yarn prettier:check       # check formatting
```

### E2E Tests (require OCP cluster + SSO credentials)

```sh
make test-e2e SSO_USERNAME=... SSO_PASSWORD=...        # clones toolchain-e2e and runs tests
make test-e2e-local SSO_USERNAME=... SSO_PASSWORD=...   # uses ../toolchain-e2e
```

### Local RHDH Deployment (requires podman)

```sh
make start-rhdh-local     # clone rhdh-local, build plugin, start via podman-compose
make stop-rhdh-local      # stop and clean up
```

## Architecture

### Plugin Structure (`plugins/sandbox/src/`)

**API layer** (`api/`): Backend service clients, all authenticated via `SecureFetchClient` which wraps OAuth2 tokens from Keycloak:

- `RegistrationBackendClient` — user signup, verification, status polling
- `KubeBackendClient` — Kubernetes API access (secrets)
- `AnsibleBackendClient` — Ansible Automation Platform (AAP) instance lifecycle

**State management** (`hooks/useSandboxContext.tsx`): `SandboxProvider` is the central React context. It manages user signup status (unknown → verify → pending-approval → provisioning → ready), AAP instance state, and polls backends at configurable intervals. Most components consume this via `useSandboxContext()`.

**Pages**: Two main pages — `SandboxCatalogPage` (product catalog grid, the home page) and `SandboxActivitiesPage` (learning resources). Both are lazy-loaded routable extensions.

**Plugin registration** (`plugin.ts`): Registers all API factories and exports the routable extensions (`SandboxPage`, `SandboxActivitiesPage`, `RHSSOSignInPage`, `SandboxResetWorkspaces`).

**Entry point** (`index.ts`): Configures MUI v5 class name prefixing (`v5-`) before re-exporting from `plugin.ts`.

### Configuration

Plugin config is defined in `app-config.yaml` under the `sandbox` key:

- `sandbox.signupAPI` — registration service URL
- `sandbox.kubeAPI` — Kubernetes API URL
- `sandbox.recaptcha.siteKey` — Google reCAPTCHA site key
- `sandbox.environment` — `DEV` or `PROD` (controls reCAPTCHA and Segment analytics)

Auth uses Red Hat SSO (Keycloak) via OIDC. Local dev config is in `deploy/base/app-config.yaml`.

### CI

GitHub Actions CI (`.github/workflows/ci.yml`) runs on PRs against `master`: install → fix check → config validation → tsc → prettier → API reports → build → lint (since origin/master) → test with coverage.
