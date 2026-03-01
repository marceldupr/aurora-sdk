# @aurora-studio/sdk

Node.js SDK for Aurora Studio. Connect custom front-ends and storefronts to your Aurora data via the API. Features (store, site, holmes) are **discovered** from the API — only enabled capabilities expose methods.

**Spec-driven:** You can pass an OpenAPI spec URL (or use the default). The SDK fetches the tenant spec and uses it for the base URL and for generic methods (`request`, `search`, `me`, `events`, `webhooks`). Each tenant’s API surface is defined by their spec; the SDK adjusts accordingly.

**Aurora** is an all-in-one, no-code platform for stores, marketplaces, CRMs, and more. Design your data, generate your app, automate workflows. Ship in hours, not months.

[**Sign up for Aurora**](https://aurora.mandeville.digital) — currently in beta testing and free.

## Changelog

- **0.2.2** — **Provision schema:** `client.provisionSchema(schema, { base?: "marketplace-base" | "base" })` for template-first provisioning. Call on first run so your app provisions its tables (and optional reports/workflows) via `POST /v1/provision-schema`. Use `base: "marketplace-base"` for multi-vendor workspaces; omit or `"base"` for non-marketplace. Idempotent.
- **0.2.1** — Spec-driven SDK: optional `specUrl`, `getSpec()`, `request(method, path, opts)`. New methods from tenant OpenAPI: `search()`, `me()`, `events.emit()`, `webhooks.inbound()`. **Auth (app users):** `auth.signin()`, `auth.signup()`, `auth.session()`, `auth.signout()`, `auth.users()`. Tenant spec at `GET /v1/openapi.json` (with API key).
- **0.1.5** — Discovery-based: `client.capabilities()` fetches enabled features from `/v1/capabilities`. Store, site, holmes methods only available when installed.
- **0.1.4** — Site search, stores, delivery slots, checkout, Holmes infer
- **0.1.3** — Add repository field for provenance
- **0.1.2** — Trusted publishing (OIDC) configured
- **0.1.1** — CI/CD setup
- **0.1.0** — Initial release

## Install

```bash
npm install @aurora-studio/sdk
```

## Usage

```ts
import { AuroraClient } from "@aurora-studio/sdk";

const client = new AuroraClient({
  baseUrl: "https://api.youraurora.com",
  apiKey: "aur_xxx...",
  // optional: tenant OpenAPI spec URL (default: baseUrl + "/v1/openapi.json")
  // specUrl: "https://api.youraurora.com/v1/openapi.json",
});

// First run: provision your app's schema (tables, optional reports/workflows). Idempotent.
// Load your template schema (e.g. from aurora/schema.json) and call:
await client.provisionSchema(schema, { base: "marketplace-base" }); // multi-vendor; use "base" or omit for non-marketplace

// Capabilities (what's enabled for this tenant)
const caps = await client.capabilities();
// { tenantSlug: "acme", features: { store: true, site: true, holmes: true } }

// V1 APIs (always available)
const tables = await client.tables.list();
const config = await client.store.config();

// Auth (app users: storefront sign in/up, session, list customers)
const session = await client.auth.signin({ email: "u@example.com", password: "***" });
// session.access_token — use as Bearer for client.auth.session() and client.me({ userId: session.user.id })
const current = await client.auth.session(session.access_token);
await client.auth.signout(session.access_token);
const { data: appUsers } = await client.auth.users({ limit: 20, offset: 0 });

// Spec-driven: search, me, events (use tenant spec when loaded)
const results = await client.search({ q: "milk", limit: 20 });
const meta = await client.me({ userId: "user-uuid" }); // optional userId for addresses etc.
await client.events.emit({ type: "order.paid", entityType: "order", entityId: "ord_1" });

// Low-level: call any path from the tenant spec
const data = await client.request("GET", "/tables/products/records", { query: { limit: 10 } });

// Site/store/holmes (when enabled for the tenant)
if (caps.features.site) {
  await client.site.search({ q: "milk" });
  await client.site.stores();
}
if (caps.features.store) {
  await client.store.deliverySlots(51.5, -0.1);
  await client.store.checkout.sessions.create({ successUrl, cancelUrl, lineItems });
}
if (caps.features.holmes) {
  await client.holmes.infer("session_id");
}
```

## OpenAPI spec (spec-driven behaviour)

Each tenant has an OpenAPI spec that describes their API (tables, search, me, events, webhooks, etc.). The SDK can load this spec and use it so the client matches the tenant’s surface.

- **Default spec URL:** `baseUrl + "/v1/openapi.json"`. The spec is fetched with your API key; the server returns the tenant-specific spec for that key.
- **Custom spec URL:** Pass `specUrl` in the constructor if your spec is served elsewhere.
- **Loading:** The spec is fetched on first use of `request()`, `search()`, `me()`, `events`, or `webhooks`, and then cached. You can also call `client.getSpec()` explicitly.
- **Base URL:** After loading, `request()` and the spec-driven methods use the spec’s `servers[0].url` (e.g. `https://api.youraurora.com/v1`). If the spec cannot be loaded, they fall back to `baseUrl + "/v1"`.

Create API keys in Aurora Studio → Settings → API Keys.

## API surface

### Constructor options

| Option     | Type   | Description |
| ---------- | ------ | ----------- |
| `baseUrl`  | string | API base URL (e.g. `https://api.youraurora.com`). |
| `apiKey`   | string | API key (storefront or workspace). |
| `specUrl?` | string | Optional. Tenant OpenAPI spec URL. Default: `baseUrl + "/v1/openapi.json"`. |

### Provision schema (first run)

| Method | Description |
| ------ | ----------- |
| `client.provisionSchema(schema, options?)` | Provision tables (and optional `reports`, `workflows`) from your template. Call on first run. Requires valid API key. `schema`: `{ tables: [...], reports?: [...], workflows?: [...] }`. `options.base`: `"marketplace-base"` for multi-vendor workspaces (vendors, products, vendor_products already provisioned by Studio); `"base"` or omit for non-marketplace. Idempotent: only adds missing tables/columns. |

### Capabilities (discovery)

| Method | Description |
| ------ | ----------- |
| `client.capabilities()` | Fetch enabled features. Cached. Returns `{ tenantSlug, features: { store?, site?, holmes? } }`. |

### Spec-driven (tenant OpenAPI)

| Method | Description |
| ------ | ----------- |
| `client.getSpec()` | Fetch and cache the tenant OpenAPI spec. Returns the spec object. |
| `client.request(method, path, opts?)` | Low-level request. `path` is relative to the spec server (e.g. `/tables`, `/search`). `opts`: `{ body?, query?, headers? }`. |
| `client.search(params?)` | Search. Uses `GET /search`. Params: `q`, `limit`, `offset`, `vendorId`, `category`, `sort`, `order`. |
| `client.me(opts?)` | Current user metadata and related data (e.g. addresses). Uses `GET /me`. Optional `opts.userId` sent as `X-User-Id`. |
| `client.events.emit(body)` | Raise a domain event. Uses `POST /events`. Body: `type`, `entityType`, `entityId?`, `payload?`, `dedupeKey?`. |
| `client.webhooks.inbound(payload, headers?)` | Send payload to tenant inbound webhook. Uses `POST /webhooks/inbound`. Optional headers: `source`, `event`, `path`. |

### Auth (app users — storefront customers)

| Method | Description |
| ------ | ----------- |
| `client.auth.signin({ email, password })` | Sign in app user. Returns `{ access_token, refresh_token, user, expires_at }`. Use `access_token` as Bearer for `session` and `me`. |
| `client.auth.signup({ email, password, options? })` | Sign up app user. Returns session or `{ user, message }` when email confirmation is required. `options`: `data`, `emailRedirectTo`. |
| `client.auth.session(accessToken)` | Validate Bearer token and return current user. No API key. |
| `client.auth.signout(accessToken)` | Sign out; client should discard tokens. |
| `client.auth.users({ limit?, offset? })` | List app users (storefront customers) for the tenant. Paginated. Requires API key. |

### V1 APIs (always available)

| Method | Description |
| ------ | ----------- |
| `client.tables.list()` | List tables |
| `client.tables(slug).records.list(opts)` | List records |
| `client.tables(slug).records.get(id)` | Get record |
| `client.tables(slug).records.create(data)` | Create record |
| `client.tables(slug).records.update(id, data)` | Update record |
| `client.tables(slug).records.delete(id)` | Delete record |
| `client.tables(slug).sectionViews.list()` | List section views |
| `client.views.list()` | List report views |
| `client.views(slug).data()` | Get view data |
| `client.reports.list()` | List reports |
| `client.reports(id).data()` | Get report data |
| `client.store.config()` | Store config (enabled: false when no template) |
| `client.store.pages.list()` / `.get(slug)` | Store pages |

### Site APIs (when `features.site` is true)

| Method | Description |
| ------ | ----------- |
| `client.site.search(opts)` | Product/catalog search (tenant path) |
| `client.site.stores()` | List stores/vendors |

### Store APIs (when `features.store` is true)

| Method | Description |
| ------ | ----------- |
| `client.store.deliverySlots(lat, lng)` | Delivery slots for a location |
| `client.store.checkout.sessions.create(params)` | Create checkout session (Stripe or ACME) |
| `client.store.checkout.acme.get(sessionId)` | Get ACME session |
| `client.store.checkout.acme.complete(sessionId, addr?)` | Complete ACME checkout |

### Holmes (when `features.holmes` is true)

| Method | Description |
| ------ | ----------- |
| `client.holmes.infer(sid)` | Mission inference |

## Types

The package exports TypeScript types for responses and params, including:

- `AuroraClientOptions`, `OpenAPISpec`, `Capabilities`
- `SearchParams`, `SearchResult`, `SearchHit`
- `DeliverySlot`, `StoreItem`
- `CheckoutLineItem`, `CreateCheckoutSessionParams`, `CheckoutSessionResult`
- `AcmeSession`, `HolmesInferResult`
- Auth: `AuthSignInParams`, `AuthSignUpParams`, `AuthSessionResponse`, `AuthSignUpResponse`, `AuthSessionUser`, `AuthUserListItem`, `AuthUsersResponse`

`provisionSchema` returns `{ ok, base, tablesCreated, reportsCreated, workflowsCreated, message }`.

Use these for type-safe usage in your app.
