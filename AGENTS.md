# Developer Sandbox Dashboard

Backstage/RHDH frontend plugin (`@red-hat-developer-hub/backstage-plugin-sandbox`) providing the Developer Sandbox dashboard — a self-service portal where users sign up and access Red Hat cloud products (OpenShift, OpenShift AI, Dev Spaces, Ansible Automation Platform, OpenShift Virtualization).

## Repository layout

Yarn workspace monorepo (Backstage v1.36.1) with two workspace roots defined in the root `package.json`:

```
.
├── plugins/sandbox/          # Plugin source code
├── red-hat-developer-hub-backstage-plugin-sandbox/
│                             # Pre-built dynamic plugin bundle (dist + dist-scalprum),
│                             # loaded at runtime by RHDH without rebuilding the Backstage app
├── app-config.yaml           # Local development config
├── app-config.production.yaml
├── deploy/                   # Kubernetes deployment manifests
├── make/                     # Makefile helpers
└── openshift-ci/             # CI configuration
```

## Plugin architecture (`plugins/sandbox/`)

### Entry point chain

1. `src/index.ts` — configures MUI v5 class-name prefixing (`v5-`) to avoid style collisions, then re-exports everything from `plugin.ts`
2. `src/plugin.ts` — Backstage plugin definition via `createPlugin()`:
   - **Plugin ID**: `sandbox`
   - **Route**: single `rootRouteRef` (defined in `src/routes.ts`)
   - **5 API factories** registered with the Backstage dependency injection system

### API layer (`src/api/`)

| API ref | Client class | Purpose |
|---|---|---|
| `keycloakApiRef` | `OAuth2` (from `@backstage/core-app-api`) | OIDC auth via Keycloak/Red Hat SSO |
| `secureFetchApiRef` | `SecureFetchClient` | Wraps `fetch` with OAuth bearer tokens |
| `registerApiRef` | `RegistrationBackendClient` | Signup flow, phone/activation-code verification, reCAPTCHA, Segment analytics key, UI config, workspace reset |
| `kubeApiRef` | `KubeBackendClient` | Kubernetes API calls (secrets, etc.) |
| `aapApiRef` | `AnsibleBackendClient` | Ansible Automation Platform CRUD (create/idle/un-idle/delete instances) |

### Exported extensions

**Routable extensions (4):**
- `SandboxPage` — main catalog page showing product cards (OpenShift, AI, DevSpaces, AAP, Virt)
- `SandboxActivitiesPage` — activities/articles page
- `RHSSOSignInPage` — custom RHSSO sign-in page replacement
- `SandboxResetWorkspaces` — component extension (menu link + confirmation modal to reset user workspaces)

**Icons (2):**
- `SandboxHomeIcon` (HomeOutlinedIcon)
- `SandboxActivitiesIcon` (StarOutlineOutlinedIcon)

### State management (`src/hooks/useSandboxContext.tsx`)

A React Context (`SandboxProvider`) wraps all pages and manages:
- **User lifecycle** — signup status polling (unknown -> verify -> pending-approval -> provisioning -> ready)
- **Ansible AAP state** — instance creation, idling/un-idling, credential fetching
- **Analytics** — Segment tracking, Marketo webhook URL
- **UI config** — dynamically disabled integrations fetched from the registration service

### Configuration

Defined in `config.d.ts`, exposed under the `sandbox` key in `app-config.yaml`:

| Key | Required | Description |
|---|---|---|
| `sandbox.signupAPI` | Yes | Registration service URL |
| `sandbox.kubeAPI` | Yes | Kubernetes API URL |
| `sandbox.recaptcha.siteKey` | Yes | Google reCAPTCHA Enterprise site key |
| `sandbox.environment` | No | `DEV` skips analytics/reCAPTCHA; defaults to `PROD` |

### Dynamic plugin support (`app-config.dynamic.yaml`)

Configures the plugin for RHDH's dynamic plugin system via Scalprum:
- Replaces the default sign-in page with `RHSSOSignInPage`
- Mounts `SandboxPage` at `/` and `SandboxActivitiesPage` at `/activities`
- Registers custom sidebar icons
- Customizes the global header (hides search/create, adds profile dropdown with Settings + Logout)
- Disables unused built-in plugins (TechDocs, Dynamic Home Page)

### Component hierarchy (main page)

```
SandboxCatalogPage
  └── SandboxProvider (context)
       ├── SandboxHeader
       ├── SandboxCatalogBanner
       ├── SandboxCatalogGrid
       │    └── SandboxCatalogCard (x5 products)
       │         ├── SandboxCatalogCardButton (launch/open)
       │         └── SandboxCatalogCardDeleteButton (AAP only)
       └── SandboxCatalogFooter
```

### Modals (`src/components/Modals/`)

- `PhoneVerificationModal` — 2-step flow: phone number input -> verification code
- `AccessCodeInputModal` — activation code entry
- `AnsibleLaunchInfoModal` — AAP instance launch details
- `AnsibleDeleteInstanceModal` — AAP instance deletion confirmation

### Products (`src/components/SandboxCatalog/productData.tsx`)

Five products displayed as cards, each identified by the `Product` enum:
- `OPENSHIFT_CONSOLE` — OpenShift
- `OPENSHIFT_AI` — OpenShift AI
- `DEVSPACES` — Dev Spaces
- `AAP` — Ansible Automation Platform
- `OPENSHIFT_VIRT` — OpenShift Virtualization

### Utilities (`src/utils/`)

- `phone-utils.ts` — phone number and country code validation
- `recaptcha.ts` — reCAPTCHA Enterprise script loading
- `cookie-utils.ts` — cookie management
- `register-utils.ts` — signup data to status mapping
- `aap-utils.ts` — Ansible status helpers, base64 decoding
- `segment-analytics.ts` — Segment analytics integration
- `eddl-utils.ts` — EDDL (Event-Driven Data Layer) utilities
- `marketo-utils.ts` — Marketo form integration
- `common.ts` — shared helpers (error message extraction, etc.)

### Custom hooks (`src/hooks/`)

- `useSandboxContext` — access the SandboxContext (user status, AAP state, analytics)
- `useProductURLs` — resolve product launch URLs from config and user data
- `useRecaptcha` — load reCAPTCHA script in production mode
- `useGreenCorners` — UI styling hook

## Build and development

```bash
yarn install          # Install dependencies
yarn dev              # Start frontend + backend in parallel
yarn start            # Start frontend only
yarn build:all        # Build all packages
yarn test             # Run unit tests (jest via backstage-cli)
yarn lint:all         # Lint all packages
yarn prettier:check   # Check formatting
```

## Testing

- **Unit tests**: co-located in `__tests__/` folders, using `@testing-library/react` + MSW for API mocking
- **E2E tests**: Playwright, configured in `sandboxplaywright.config.ts` at the workspace root
